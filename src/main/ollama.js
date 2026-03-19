import { ElectronOllama } from 'electron-ollama'
import { app } from 'electron'
import { Ollama } from 'ollama'
import path from 'path'
import fs from 'fs'
import models from './models'

export async function setupElectronOllama(mainWindow) {
  const eo = new ElectronOllama({
    basePath: app.getPath('userData'),
    modelsPath: path.join(app.getPath('userData'), 'models')
  })

  // download/start Ollama server
  mainWindow.webContents.send('ollama-status', {state: 'starting', message: 'Downloading server...', progress: 0})

  if (!(await eo.isRunning())) {
    let metadata
    try {
      metadata = await eo.getMetadata('latest')
    } catch (error) {
      console.error('Failed to fetch Ollama metadata:', error)
      mainWindow.webContents.send('ollama-status', {state: 'error', message: 'Failed to download Ollama server.', progress: 0})
      return null
    }
    await eo.serve(metadata.version, {
      serverLog: (message) => console.log('[Ollama]', message),
      downloadLog: (percent, message) => {
        console.log('[Ollama Download]', `${percent}%`, message)
        mainWindow.webContents.send('ollama-status', {state: 'starting', message: 'Downloading server...', progress: percent/100})
      },
    })
  } else {
    console.log('Ollama server is already running')
  }
  return eo
}

export async function setupOllama(mainWindow, modelName) {
  // version check
  const liveVersion = await fetch('http://localhost:11434/api/version').then(res => res.json())
  console.log('Currently running Ollama', liveVersion)

  console.log('Loading model...')


  // can't figure out a way to grab the model list and sizes, so hardcode them from the models file
  const model = modelName || 'deepseek-r1:8b'

  // get client
  const ollama = new Ollama({baseURL: 'http://localhost:11434'})

  // check if model is installed
  let installedModels
  try {
    installedModels = await ollama.list()
  } catch (error) {
    console.error('Failed to list models:', error)
    mainWindow.webContents.send('ollama-status', {state: 'error', message: 'Failed to communicate with Ollama server.', progress: 0})
  }

  const modelInstalled = installedModels.models.some(m => m.name === model)

  if (!modelInstalled) {
    // start downloading model
    mainWindow.webContents.send('ollama-status', {state: 'starting', message: `Downloading model...`, progress: 0})

    let pulled = false
    while (!pulled) {
      try {
        for await (const event of await ollama.pull({model, stream: true})) {
          if (event.total && event.completed) {
            const progress = event.completed / event.total
            mainWindow.webContents.send('ollama-status', {state: 'starting', message: `Downloading model...`, progress})  
          }
        }
        pulled = true
      } catch (error) {
        console.warn('Failed to pull model, retrying in 5 seconds...', error)
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  }

  mainWindow.webContents.send('ollama-status', {state: 'ready', message: 'Model is ready!', progress: 1})
  mainWindow.webContents.send('ollama-ready')

  return ollama
}
