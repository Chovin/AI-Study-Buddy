import { ElectronOllama } from 'electron-ollama'
import { app } from 'electron'
import { Ollama } from 'ollama'
import { runCommand } from './terminalProcess'
import models from './models'
import progressManager from './progressManager'

class OllamaAPI {
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

  async startServer() {
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

  async stopOllama() {
    if (await this.ollamaIsRunning()) {
      await this.electronOllama.getServer()?.stop()
    }
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

export default new OllamaAPI(app.getPath('userData'))