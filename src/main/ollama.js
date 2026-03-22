import { ElectronOllama } from 'electron-ollama'
import { app, safeStorage } from 'electron'
import { Ollama } from 'ollama'
import { runCommand, makeRequest, generateSecurePassword, sleep } from './helpers'
import models from './models'
import progressManager from './progressManager'
import fs from 'fs'
import path from 'path'
import kill from 'tree-kill'

const WEBUI_BASE_URL = 'http://localhost:8080/api/v1';
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

const WEBUI_DIR = path.join(app.getPath('userData'), 'webui')
const VENV_PATH = path.join(WEBUI_DIR, 'venv')

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
  }

  async ensureVenv() {
    try {
      // check Python version first
      await runCommand(PYTHON_CMD, ['--version'])
    } catch {
      throw new Error('Python 3 not found. Please install Python 3.11+ first.')
    }

    if (!fs.existsSync(VENV_PATH)) {
      await runCommand(PYTHON_CMD, ['-m', 'venv', VENV_PATH])
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
    await this.ensureVenv()

    if (await this.isWebUIInstalled()) {
      console.log(`Open WebUI installed`)
      return
    }

    console.log('Starting Open WebUI installation...')
    let lastLibrary = null
    // let lastProgress = 0;
    try {
      await runCommand(VENV_PYTHON, ['-m', 'pip', 'install', '--upgrade', 'pip'])
      const output = await runCommand(VENV_PYTHON, ['-m', 'pip', 'install', 'open-webui'], {
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
      progressManager.failTask(WUIPID)
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

    let lastProgress = null
    // for some reason, open webui shows the download percentage in stderr
    let lastErrProgress = null
    const webuiProcess = await runCommand(scriptPath, ['serve'], {
      env,
      stdoutCallback: (str, process, resolve) => {
        // Parse progress from stdout lines
        // Example: "[  3%] ..." or "Downloading ... 45%"
        const matchProgress = str.match(/(\d{1,3})%/);
        let progress = lastProgress
        if (matchProgress) {
          progress = parseInt(matchProgress[1], 10) / 100;
        }
        if (progress != lastProgress) {
          lastProgress = progress
          progressManager.updateTask(WUIPID, {progress})
        }
        console.log(`[WebUI]: ${str}`)

        if (str.includes('Started server process')) {
          console.log('Open WebUI is ready!')
          setTimeout(() => {
            resolve(process)
          }, 5000)
        }
      },
      stderrCallback: (str, process, resolve) => {
        const matchProgress = str.match(/(\d{1,3})%/);
        let progress = lastErrProgress
        if (matchProgress) {
          progress = parseInt(matchProgress[1], 10) / 100;
        }
        if (progress != lastErrProgress) {
          lastErrProgress = progress
          progressManager.updateTask(WUIPID, {progress})
        }
        console.error(`[WebUI Error]: ${str}`)

        // for some reason this message is in stderr!
        if (str.includes('Started server process')) {
          console.log('Open WebUI is ready!')
          setTimeout(() => {
            resolve(process)
          }, 5000)
        }
      }
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

  async promptLogin() {
    await runCommand("ollama", ["signin"])
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
    }
  }
}

export default new LLMInterface(app.getPath('userData'))