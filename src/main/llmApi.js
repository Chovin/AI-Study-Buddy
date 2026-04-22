import { ElectronOllama } from 'electron-ollama'
import { app, safeStorage, net, dialog } from 'electron'
import { Ollama } from 'ollama'
import { runCommand, makeRequest, generateSecurePassword, sleep } from './helpers'
import models from './models'
import progressManager from './progressManager'
import AsyncQueue from './asyncQueue'
import fs from 'fs'
import path from 'path'
import mime from 'mime-types'
import kill from 'tree-kill'
import { EventSource } from 'eventsource'
import { tokenManager } from './tokenManager'

const isDev = !app.isPackaged

const WEBUI_BASE_URL = 'http://localhost:8080/api/v1';

const WEBUI_DIR = path.join(app.getPath('userData'), 'webui')
const VENV_PATH = path.join(WEBUI_DIR, 'venv')
const PIP_REQUIREMENTS_PATH = path.join(WEBUI_DIR, 'REQUIREMENTS.txt')

if (!fs.existsSync(WEBUI_DIR)) {
  fs.mkdirSync(WEBUI_DIR, { recursive: true })
}

const VENV_PYTHON = process.platform === 'win32'
  ? path.join(VENV_PATH, 'Scripts', 'python.exe')
  : path.join(VENV_PATH, 'bin', 'python')

const WUIPID = 'Setting up Open WebUI Server'


class LLMInterface {
  constructor(basePath) {
    this.electronOllama = new ElectronOllama({basePath})
    this.ollamaClient = new Ollama({baseURL: 'http://localhost:11434'})
    this._models = models

    this.summarizerModel = Object.entries(models).find(([_, o]) => o.summarizer)[0]
    this.selectedModel = this.summarizerModel

    this.downloadingModels = {}

    this.fileProcessingQueue = new AsyncQueue()
    this.currentFileProcessing = null
    this.db = null
  }

  setDatabase(db) {
    this.db = db
  }

  get models() {
    return { ...this._models }
  }

  async start(ollamaReadyCallback) {
    // we can download and start ollama at the same time we're downloading open webui
    await Promise.all([
      (async () => {
        console.log('starting ollama')
        await this.startOllama()
        console.log('ollama started')
        if (ollamaReadyCallback) ollamaReadyCallback()
        await this.downloadSummarizerModel()
      })(),
      this.installOpenWebUI()
    ])
    
    await this.startWebUI()
    this.running = true

    await this.registerPendingFiles()
  }

  async ensureVenv() {
    const PYTHON_CMDS = process.platform === 'win32' 
      ? ['python', 'python3', 'py -3.11', 'py -3.12'] 
      : ['python3', 'python3.11', 'python3.12', 'python']
    let python_cmd;

    for (let cmd of PYTHON_CMDS) {
      await runCommand(cmd, ['--version'], {
        stdoutCallback: (data) => {
          console.log('in python cmd', cmd, data, data.match(/Python 3.1[12]/))
          if (data.match(/Python 3.1[12]/)) {
            python_cmd = cmd
          }
        }
      })
      if (python_cmd) {
        break
      }
    }
    if (!python_cmd) {
      throw new Error('Python 3 not found. Please install Python 3.11/3.12 first.')
    }
    if (!fs.existsSync(VENV_PATH)) {
      await runCommand(python_cmd, ['-m', 'venv', VENV_PATH])
    }
  }

  async isWebUIInstalled() {
    // 1. venv must exist
    await this.ensureVenv()

    try {
      // 2. check if package exists inside venv
      await runCommand(VENV_PYTHON, ['-c', 'import open_webui'])
      return true
    } catch {
      return false
    }
  }

  async installOpenWebUI() {
    progressManager.startTask(WUIPID, 'Downloading Open WebUI...', {progress: null})
    try {
      await this.ensureVenv()
    } catch (error) {
      progressManager.failTask(WUIPID, null, error)
      return
    }

    if (await this.isWebUIInstalled()) {
      console.log(`Open WebUI installed`)
      return
    }

    console.log('Starting Open WebUI installation...')
    let lastLibrary = null
    // let lastProgress = 0;
    try {
      const reqsPath = isDev
        ? path.join(process.cwd(), 'REQUIREMENTS.txt')
        : path.join(process.resourcesPath, 'app.asar', 'REQUIREMENTS.txt')
      const requirements = fs.readFileSync(reqsPath, 'utf-8')
      
      fs.writeFileSync(PIP_REQUIREMENTS_PATH, requirements)
      
      await runCommand(VENV_PYTHON, ['-m', 'pip', 'install', '--upgrade', 'pip'])
      const output = await runCommand(VENV_PYTHON, ['-m', 'pip', 'install', '-r', PIP_REQUIREMENTS_PATH], {
        stdoutCallback: (data) => {
          // pip install doesn't give percentage
          const matchLibrary = data.match(/Downloading (.+?)-/)
          let library = lastLibrary
          if (matchLibrary) {
            library = matchLibrary[1]
          }

          if (
            // progress !== lastProgress || 
            library != lastLibrary
          ) {
            // lastProgress = progress;
            lastLibrary = library
            let msg = `Downloading Open WebUI (${library})...`
            progressManager.updateTask(WUIPID, { status: 'running', progress: null, msg });
          }
        }
      })
      console.log('Installation successful!', output)
    } catch (error) {
      console.error('Installation failed:', error)
      progressManager.failTask(WUIPID, null, error)
      throw error
    }
    
    console.log(`Open WebUI installed`)
  }

  async startWebUI() {
    progressManager.updateTask(WUIPID, {msg: "Starting Open WebUI Server..."})
    this.webuiProcess = await this.startOpenWebUIProcess()
    progressManager.updateTask(WUIPID, {msg: "Getting Open WebUI API Key..."})
    for (let i = 0; i<5; i++) {
      try {
        this.webUIAPIKey = await this.ensureWebUIApiKey()
      } catch (error) {
        if (error.message?.includes("You do not have permission")) {
          console.log('Trying again. recieved error:', error)
          await sleep(5000)
          continue
        }
        throw error
      }
    }
    if (!this.webUIAPIKey) {
      throw new Error("Unable to get Open WebUI API Key")
    }
    progressManager.finishTask(WUIPID, "Finished Starting Open WebUI")
  }

  async startOpenWebUIProcess() {
    const env = {
      ...process.env,
      DATA_DIR: app.getPath('userData'),
      OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
      WEBUI_AUTH: 'True',
      DEFAULT_USER_ROLE: 'admin',
      // these are needed to allow API key creation without GUI interaction
      ENABLE_API_KEYS: 'True',
      USER_PERMISSIONS_FEATURES_API_KEYS: 'True'
    }

    const scriptPath = process.platform === 'win32'
      ? path.join(VENV_PATH, 'Scripts', 'open-webui.exe')
      : path.join(VENV_PATH, 'bin', 'open-webui');

    const stdioCallbackMaker = (error = false) => {
      let lastProgress = null
      return (str, process, resolve) => {
        // Parse progress from stdout lines
        // Example: "[  3%] ..." or "Downloading ... 45%"
        const matchProgress = str.match(/(\d{1,3})%/);
        let progress = lastProgress
        if (matchProgress) {
          progress = parseInt(matchProgress[1], 10) / 100;
        }
        const progressChanged = progress != lastProgress
        if (progressChanged) {
          lastProgress = progress
          if (!this.running) {
            progressManager.updateTask(WUIPID, {progress})
          }
        }
        if (str.match('address already in use')) {
          progressManager.failTask(WUIPID, 'Failed to start Open WebUI', new Error('Port 8080 is already in use. Please close any application using this port and try again.'))
        }
        console.log(`[WebUI${error ? ' Error' : ''}]: ${str}`)

        if (str.includes('Started server process')) {
          console.log('Open WebUI is ready!')
          setTimeout(() => {
            resolve(process)
          }, 5000)
        }

        // Only update if there is a current file
        if (this.running && this.currentFileProcessing) {
          const match = str.match(/Batches:\s*(\d+)%/);
          if (match) {
            if (this.currentFileProcessing.timeout) {
              this.currentFileProcessing.refresh()
            }
            if (progressChanged) {
              progress = parseInt(match[1], 10) / 100;
              progressManager.updateTask(this.currentFileProcessing.taskId, { progress });
            }
          }
        }
      }
    }

    const webuiProcess = await runCommand(scriptPath, ['serve'], {
      env,
      // for some reason, open webui shows the download percentage in stderr
      // and errors in stdout
      stdoutCallback: stdioCallbackMaker(),
      stderrCallback: stdioCallbackMaker(true)
    })

    return webuiProcess
  }

  async ensureWebUIApiKey() {
    let encryptedBuffer

    // overwrite WEBUI_EMAIL, WEBUI_NAME, WEBUI_PASS from env
    const env = {
      WEBUI_EMAIL: 'nowhere@noemail.nodomain',
      WEBUI_NAME: 'Admin',
      WEBUI_PASS: generateSecurePassword(),
      ...process.env
    }

    try {
      const user = await app.db.getUserByEmail(env.WEBUI_EMAIL)
      encryptedBuffer = user?.encrypted_api_key
    } catch (err) {
      console.warn('No WebUI user, generating a new one...')
    }

    if (encryptedBuffer) {
      try {
        const apiKey = safeStorage.decryptString(encryptedBuffer)

        // test key
        await makeRequest(`${WEBUI_BASE_URL}/models`, 'GET', apiKey)

        return apiKey // valid
      } catch (err) {
        console.warn('Stored API key invalid, regenerating...')
      }
    }

    // create new key
    const email = env.WEBUI_EMAIL
    const password = env.WEBUI_PASS
    const name = env.WEBUI_NAME

    await makeRequest(`${WEBUI_BASE_URL}/auths/signup`, 'POST', null, { email, password, name })

    const loginData = await makeRequest(`${WEBUI_BASE_URL}/auths/signin`, 'POST', null, { email, password })
    const jwt = loginData.token

    const keyData = await makeRequest(`${WEBUI_BASE_URL}/auths/api_key`, 'POST', jwt)
    const apiKey = keyData.api_key

    const encryptedKey = safeStorage.encryptString(apiKey)
    app.db.saveUser(email, password, encryptedKey)

    return apiKey
  }

  async startOllama() {
    // download/start Ollama server
    const OLSPID = 'Setting Up Ollama Server'
    progressManager.startTask(OLSPID, 'Downloading server...')

    let eo = this.electronOllama

    if (!(await this.ollamaIsRunning())) {
      let metadata
      try {
        metadata = await eo.getMetadata('latest')
      } catch (error) {
        console.error('Failed to fetch Ollama metadata:', error)
        progressManager.failTask(OLSPID, error)
        return null
      }
      await eo.serve(metadata.version, {
        serverLog: (message) => console.log('[Ollama]', message),
        downloadLog: (percent, message) => {
          console.log('[Ollama Download]', `${percent}%`, message)
          progressManager.updateTask(OLSPID, {msg: 'Downloading Server...', progress: percent/100})
        },
      })
    } else {
      console.log('Ollama server is already running')
    }

    // version check
    const liveVersion = await fetch('http://localhost:11434/api/version').then(res => res.json())
    console.log('Currently running Ollama', liveVersion);

    // record installed models
    (await this.listModels()).forEach(({name, size}) => {
      if (!this._models[name]) {
        // add ones that are installed and not in models.js
        this._models[name] = {size}
      }
      this._models[name].installed = true
    })

    // update here in case the eo.serve doesn't block until fully downloaded
    progressManager.finishTask(OLSPID)
  }

  async ollamaIsRunning() {
    return await this.electronOllama.isRunning()
  }

  async stopServers() {
    console.log('quitting openwebui')
    await this.stopOpenWebUI()
    console.log('quitting ollama')
    await this.stopOllama()
    this.running = false
  }

  async stopOllama() {
    if (await this.ollamaIsRunning()) {
      await this.electronOllama.getServer()?.stop()
    }
  }

  async stopOpenWebUI() {
    if (!this.webuiProcess) return

    return new Promise((resolve) => {
      let finished = false

      const cleanup = () => {
        if (!finished) {
          finished = true
          this.webuiProcess = null
          resolve()
        }
      }

      // Exit listener
      this.webuiProcess.once('exit', (code, signal) => {
        console.log('WebUI exited with code', code, 'signal', signal)
        cleanup()
      })

      // Trying to catch close
      this.webuiProcess.on('close', (code, signal) => {
        console.log('WebUI closed with code', code, 'signal', signal)
        cleanup()
      })

      // Try graceful shutdown
      // const sigTermSent = this.webuiProcess.kill('SIGTERM')
      kill(this.webuiProcess.pid)

      // for some reason, webui doesn't send the exit event, so have to poll for it
      // Poll for the process to exit
      const pollExit = () => {
        try {
          process.kill(this.webuiProcess.pid, 0) // check if alive
          setTimeout(pollExit, 200)
        } catch {
          // process no longer exists
          cleanup()
        }
      }

      pollExit()

      // Force kill after 5s if still running
      setTimeout(() => {
        if (!finished && !this.webuiProcess.killed) {
          console.warn('WebUI did not exit, force killing...')
          kill(this.webuiProcess.pid, 'SIGKILL')
          cleanup()
        }
      }, 5000)
    })
  }

  async listModels() {
    return (await this.ollamaClient.list()).models
  }

  async modelInstalled(model) {
    // downloadModel sets the .installed attr
    if (this._models[model]?.installed) {return true}

    let models = (await this.listModels())
    if (models.some(m => m.name === model)) {
      this._models[model].installed = true
      return true
    }

    return false
  }

  async downloadSummarizerModel() {
    let msg = `Downloading summarizer model ${this.summarizerModel} (${this._models[this.summarizerModel].size})`
    await this.downloadModel(this.summarizerModel, msg)
  }

  async downloadModel(model, msg = null) {
    if (this._models[model].downloading) {
      return false
    }
    this._models[model].downloading = true

    const OLMPID = 'Downloading ' + model
    progressManager.startTask(OLMPID, msg)

    const getErrorType = (error) => {
      // Ollama errors often have a message
      // this particular error happens when the model name isn't in the Ollama database
      // not sure if it happens because of other reasons
      if (error.message?.includes('pull model manifest: file does not exist')) {
        return new Error(`Model ${model} likely not found in Ollama database`)
      }

      return false
    }

    let didDownload = false
    if (!(await this.modelInstalled(model))) {
      // start downloading model
      let pulled = false
      while (!pulled) {
        try {
          for await (const event of await this.ollamaClient.pull({model, stream: true})) {
            if (event.total && event.completed) {
              const progress = event.completed / event.total
              progressManager.updateTask(OLMPID, { status: 'running', progress, error: undefined })
            }
          }
          pulled = true
        } catch (error) {
          let descriptiveError = getErrorType(error)
          if (descriptiveError) {
            progressManager.failTask(OLMPID, null, descriptiveError)
            throw error
          }

          console.warn('Failed to pull model, retrying in 5 seconds...', error)
          progressManager.updateTask(OLMPID, { error })
          await new Promise(resolve => setTimeout(resolve, 5000))
        } finally {
          this._models[model].downloading = false
        }
      }
      didDownload = true
    }

    this._models[model].installed = true
    this._models[model].downloading = false
    progressManager.finishTask(OLMPID, 'Model ' + model + ' is ready!')
    return didDownload
  }

  async selectModel(model) {
    if (await this.modelInstalled(model)) {
      this.selectedModel = model
    } else {
      throw new Error(`Model ${model} not installed`)
    }
  }

  async _uploadFile(apiKey, file) {
    
    return new Promise((resolve, reject) => {
      const url = new URL(`${WEBUI_BASE_URL}/files/`);  // Open WebUI file upload endpoint
      url.searchParams.set('process_in_background', 'false');

      const request = net.request({
        method: 'POST',
        url: url.toString()
      });
  
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      request.setHeader('Authorization', `Bearer ${apiKey}`);
      request.setHeader('Content-Type', `multipart/form-data; boundary=${boundary}`);
  
      // Construct multipart form data
      // don't use filename as on disk since we lose ext
      // and lose name context that the model could use
      // const file.file_name = path.basename(file.file_path);
      const fileContent = fs.readFileSync(file.file_path);
      
      const mimeType = mime.lookup(file.file_name) || 'application/octet-stream'
      let payload = `--${boundary}\r\n`;
      payload += `Content-Disposition: form-data; name="file"; filename="${file.file_name}"\r\n`;
      payload += `Content-Type: ${mimeType}\r\n\r\n`;
  
      request.on('response', (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => resolve(JSON.parse(data)));
      });
  
      request.write(payload);
      request.write(fileContent);
      request.write(`\r\n--${boundary}--\r\n`);
      request.end();
    });
  }

  async registerPendingFiles() {
    let files = await app.db.getPendingFiles()
    for (let file of files) {
      try {
        if (!file.canRetry()) continue
        await file.markPending()
        await this.registerFile(file)
      } catch (err) {
        console.log(`error registering ${file.file_name}: ${err}`)
        // throw err
        continue
      }
    }
  }

  async registerFile(file) {
    await this.enqueueRegisterFile(file)
  }

  // enqueue promise to ensure _registerFile is only executed once at a time
  async enqueueRegisterFile(file) {
    return this.fileProcessingQueue.enqueue(async () => {
      const taskId = `Uploading file ${file.id}`
      this.currentFileProcessing = { file, taskId, timeout: null, refresh: null };
      try {
        progressManager.startTask(taskId, `Reading file ${file.file_name}`)
        const result = await this._registerFile(file);
        progressManager.finishTask(taskId, `${file.file_name} registered`)
        this.currentFileProcessing = null;
        return result;
      } catch (err) {
        progressManager.failTask(taskId, `had troubles reading ${file.file_name}`, err)
        this.currentFileProcessing = null;
        throw err;
      }
    });
  }

  async _registerFile(file) {
    const result = await this._uploadFile(this.webUIAPIKey, file)
    console.log('file', result)

    const webuiId = result.id || result.data?.id

    if (!webuiId) {
      throw new Error('No WebUI file ID returned')
    }

    // TODO: maybe delete file after it's registered to save space
    // since webui also saves a copy of the file
    await file.setWebUIID(webuiId)

    await this.ensureFileRegistered()

    await file.markReady()

    return result
  }

  async ensureFileRegistered() {
    let { file, taskId } = this.currentFileProcessing
    

    await new Promise((resolve, reject) => {
      const url = `${WEBUI_BASE_URL}/files/${file.webui_id}/process/status?stream=true`
      // https://www.npmjs.com/package/eventsource#user-content-setting-http-request-headers
      // need to give it a custom fetch in order to add headers
      const es = new EventSource(url, {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            headers: {
              ...init.headers,
              Authorization: `Bearer ${this.webUIAPIKey}`,
            },
          }),
      })

      let error_code = null

      // Function to create/reset the timeout
      const fp = this.currentFileProcessing
      const resetTimeout = () => {
        if (fp.timeout) clearTimeout(fp.timeout)
        fp.timeout = setTimeout(async () => {
          es.close()
          if (error_code != null) {
            await file.markErrored(`${error_code}`)
          }
          progressManager.failTask(taskId, `${file.file_name} stalled or timed out${error_code ? 'with error code ' + error_code : ''}`)
          reject(new Error('File processing timed out'))
        }, 30_000) // 30 seconds of inactivity
      }
      fp.refresh = resetTimeout

      // Start initial timeout
      resetTimeout()

      es.onmessage = async (event) => {
        const data = JSON.parse(event.data)
        console.log('== data ==', data)

        // Refresh the stall timeout whenever we get an update
        resetTimeout()

        // Update progress if available
        if (data.progress != null) {
          progressManager.updateTask(taskId, { progress: data.progress })
        }

        // Completion / failure
        const completed = data.status === 'completed'
        const failed = data.status === 'failed'
        if (completed || failed) {
          clearTimeout(fp.timeout)
          es.close()
          if (completed) {
            resolve()
          } else {
            await file.markErrored(data.error)
            progressManager.failTask(taskId, `${file.file_name} failed processing`, data.error)
            reject(new Error(data.error || 'File processing failed'))
          }
        }
      }

      es.onerror = (err) => {
        console.warn('SSE error', err)

        error_code = err.code
        // keep listening until completion or timeout
      }
    })
  }

  async promptLogin() {
    await runCommand("ollama", ["signin"])
  }

  async chatWithFileContext({files = [], systemMessage = null, promptMessage = null, model = null, topicId = null, saveToHistory = true}) {
    if (!this.running) throw new Error("LLM not loaded yet")

    model = model || this.selectedModel

    if (!(topicId && this.db)) { throw new Error("topicId and database are required to fetch chat history") }

    // Fetch chat history from database after the most recent summary
    // Get the most recent summary
    const recentSummary = await this.db.getRecentSummary(topicId)
    
    let chatMessages = []
    if (recentSummary) {
      // Get all chat messages after the summary
      chatMessages = await this.db.getChatHistoryAfterTimestamp(topicId, recentSummary.timestamp)

      // Prepend the summary as a system message
      systemMessage = `${systemMessage ? systemMessage : ""}

Here is a condensed memory of earlier messages:
---
${recentSummary.content}
---

Use this as context, but prioritize recent messages.
`.trim()
    } else {
      // No summary exists, get all chat history
      chatMessages = await this.db.getAllChatHistory(topicId)
    }

    // Build messages array from chat history and new prompt
    let messages = []

    // Add system message
    if (systemMessage) {
      messages.unshift({ role: 'system', content: systemMessage })
    }
      
    // Filter to only include user and assistant messages (skip generated content)
    for (const msg of chatMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
    

    // Add the new prompt message
    if (promptMessage) {
      messages.push({ role: 'user', content: promptMessage })
    }

    // If model has a context window, check and summarize if needed
    messages = await this._ensureContextWithinLimit(messages, model, topicId)

    const url = `${WEBUI_BASE_URL}/chat/completions`

    const fileNames = files.map(f => {
      return `- ${f.file_name} (id: ${f.webui_id})`
    }).join('\n')

    const filePrompt = `
You have access to the following files:
${fileNames}
When referencing information, use the filename explicitely.
Do NOT say "the context".
`
    messages = JSON.parse(JSON.stringify(messages)) // deep copy to avoid mutating original
    const systemMsg = messages.find(m => m.role === 'system')
    if (systemMsg) {
      systemMsg.content = `${systemMsg.content}\n\n${filePrompt}`
    } else {
      // If no system message was provided, create one with the file prompt
      messages.unshift({ role: 'system', content: filePrompt })
    }

    files = files.map(f => {
      return { type: 'file', id: f.webui_id }
    })

    const payload = { model, messages, files, stream: false };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.webUIAPIKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WebUI chat failed: ${text}`);
    }

    const data = await response.json();
    let assistantReply =
      data?.choices?.[0]?.message?.content ||
      data?.response ||
      data?.message ||
      '';

    console.log(response)
    console.log(data)
    // remove this later
    if (data == null) {
      if (model.toLowerCase().endsWith('cloud')) {
        const options = {
          type: 'error',
          buttons: ['Sign in', 'Cancel'],
          defaultId: 0,
          title: 'Likely not signed in',
          message: 'The LLM did not return anything.',
          detail: 'This is likely because you are not signed into Ollama, which is required for cloud models.'
        }
        const { response } = await dialog.showMessageBox(options)
        if (response === 0) {
          await this.promptLogin()
        }
        throw new Error("The LLM didn't return anything. This is a cloud model. You are likely not logged into Ollama.")
      }
      assistantReply = "The LLM didn't return anything"
    }

    // Save chat history only if saveToHistory is true
    if (saveToHistory) {
      const fileIds = files.map(f => f.id);
      // Save user message (the prompt message we just sent)
      if (promptMessage) {
        await this.db.saveChatMessage(topicId, 'user', promptMessage, fileIds);
      }
      // Save assistant response
      await this.db.saveChatMessage(topicId, 'assistant', assistantReply, fileIds);
    }

    return assistantReply;
  }

  async _ensureContextWithinLimit(messages, model, topicId = null) {
    const contextWindow = this._models[model]?.context || 128
    if (!contextWindow) {
      return messages
    }

    // Context windows in models.js are in thousands (e.g., 128 = 128k tokens)
    // use 85% of the context window as the threshold to start summarizing, 
    // to leave room for any prompt overhead and incorrect tokenization estimation
    const contextPerc = 0.85
    const maxTokens = contextWindow * 1000 * contextPerc

    const totalTokens = messages.reduce((acc, msg) => {
      return acc + tokenManager.countTokens(model, msg.content)
    }, 0)

    // If we're within the context window, return messages as-is
    if (totalTokens <= maxTokens) {
      return messages
    }

    console.log(`Context exceeded: ${totalTokens} tokens > ${maxTokens} window, summarizing oldest messages`)

    // Find non-system messages to summarize
    const systemMsg = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    if (chatMessages.length === 0) {
      throw new Error(`No chat messages to summarize, but context is still too large. That means the system message is too large. This shouldn't happen.`)
    }

    // Recursively summarize oldest messages until we're within context
    const summarizerModel = this.summarizerModel
    const summarizerWindow = this._models[summarizerModel]?.context || 128
    const summarizerMaxTokens = summarizerWindow * 1000 * contextPerc

    // Start with all messages and recursively summarize the oldest half
    // probably bad code smell to pass something to mutate but eh, it's easy
    const flags = { summary: null }
    const newMessages = await this._recursivelySummarize(chatMessages, summarizerModel, summarizerMaxTokens, model, maxTokens, systemMsg, flags)
    if (flags.summary) {
      await this.db.saveSummary(topicId, flags.summary)
    }
    return newMessages
  }

  async _recursivelySummarize(messages, summarizerModel, summarizerMaxTokens, model, maxTokens, systemMsg, flagsWritable) {
    const systemMsgTokens = systemMsg ? tokenManager.countTokens(model, systemMsg.content) : 0
    if (systemMsgTokens >= maxTokens) {
      throw new Error(`System message alone (${systemMsgTokens} tokens) exceeds the maximum allowed tokens (${maxTokens}). This shouldn't happen.`)
    }
    const totalTokens = messages.reduce((acc, msg) => acc + tokenManager.countTokens(model, msg.content), 0) + systemMsgTokens

    // If we're within limits, return messages as-is
    if (totalTokens <= maxTokens) {
      const result = systemMsg ? [systemMsg] : []
      result.push(...messages)
      return result
    }

    // If only one message, need to summarize it
    if (messages.length <= 1) {
      const summary = await this._summarizeMessages(messages, summarizerModel, summarizerMaxTokens, flagsWritable)
      // check again to see if it's still too large and keep summarizing as needed
      return await this._recursivelySummarize([summary], summarizerModel, summarizerMaxTokens, model, maxTokens, systemMsg, flagsWritable)
    }

    // Split messages in half and summarize the oldest half
    const mid = Math.floor(messages.length / 2)
    const oldestHalf = messages.slice(0, mid)
    const newestHalf = messages.slice(mid)

    // Summarize the oldest half
    const summary = await this._summarizeMessages(oldestHalf, summarizerModel, summarizerMaxTokens, flagsWritable)
    const combinedNewerHalf = [summary, ...newestHalf]

    // Recursively process the old half summary + the newer half until it fits in the context window
    return await this._recursivelySummarize(combinedNewerHalf, summarizerModel, summarizerMaxTokens, model, maxTokens, systemMsg, flagsWritable)
  }

  async _summarizeMessages(messages, summarizerModel, summarizerMaxTokens, flagsWritable) {
    const messageString = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')
    let summaryPrompt = `Summarize the following conversation history. Be concise but preserve important information:

${messageString}

Summary:`

    // Check if prompt fits in summarizer's context window
    // Context windows are in thousands (e.g., 128 = 128k tokens)
    const promptTokens = tokenManager.countTokens(summarizerModel, summaryPrompt)

    if (promptTokens > summarizerMaxTokens) {
      // If prompt is too large, recursively summarize the older half,
      // then combine with the newer half to preserve recent context
      const mid = Math.floor(messages.length / 2)
      const olderHalf = messages.slice(0, mid)
      const newerHalf = messages.slice(mid)

      // Recursively summarize the older half
      const olderHalfSummary = await this._summarizeMessages(olderHalf, summarizerModel, summarizerMaxTokens, flagsWritable)

      // Prepend the older summary to the newer half and recursively process
      // ensures we keep trying to fit everything while preserving recent context
      const combinedMessages = [olderHalfSummary, ...newerHalf]
      return await this._summarizeMessages(combinedMessages, summarizerModel, summarizerMaxTokens, flagsWritable)
    }

    const result = await this.chat({
      model: summarizerModel,
      messages: [
        { role: 'system', content: "Summarize the following conversation. Be concise, preserve key facts, and avoid repetition." },
        { role: 'user', content: summaryPrompt }
      ],
      stream: false
    })

    let summaryContent = 
      result?.choices?.[0]?.message?.content || 
      result?.message?.content || 
      result?.message || 
      ''

    summaryContent = `This is a summary of the previous conversation:\n\n${summaryContent.trim()}`

    // this should keep rewriting itself and end up as the last one
    flagsWritable.summary = summaryContent


    return { role: 'assistant', content: summaryContent }
  }

  async chat(args) {
    if(!args.model) args.model = this.selectedModel
    try {
      return await this.ollamaClient.chat(args)
    } catch (error) {
      if (error.error == 'unauthorized' || error.status_code == 401) {
        await this.promptLogin()
        throw error
      }
      throw error
    }
  }
}

export default new LLMInterface(app.getPath('userData'))