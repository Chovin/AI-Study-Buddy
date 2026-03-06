import { ElectronOllama } from 'electron-ollama'
import { app } from 'electron'
import { Ollama } from 'ollama'
import path from 'path'
import fs from 'fs'
import models from './models'

export default async function setupOllama(mainWindow, modelName) {
  const eo = new ElectronOllama({
    basePath: app.getPath('userData'),
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

  // version check
  const liveVersion = await fetch('http://localhost:11434/api/version').then(res => res.json())
  console.log('Currently running Ollama', liveVersion)

  console.log('Loading model...')


  // can't figure out a way to grab the model list and sizes, so hardcode them from the models file
  const model = modelName || 'deepseek-r1:8b'
  const modelSize = models[model]?.size || 5225376047

  const modelPath = path.join(eo.config.basePath, 'models', model.replace(':', '_'))

  console.log('model path: ', modelPath)

  const pollInterval = 500
  let lastProgress = -1
  const progressInterval = setInterval(() => {
    let size = 0
    if (fs.existsSync(modelPath)) {
      size = fs.readdirSync(modelPath).reduce((acc, file) => {
        const filePath = path.join(modelPath, file)
        return acc + fs.statSync(filePath).size
      }, 0)
    }
    const progress = Math.min(size / modelSize, 1)
    if (progress !== lastProgress) {
      console.log(`Model download progress: ${(progress * 100).toFixed(2)}%`)
      mainWindow.webContents.send('ollama-status', {state: 'starting', message: 'Downloading model...', progress})
      lastProgress = progress
    }

    if (progress >= 1) {
      clearInterval(progressInterval)
      mainWindow.webContents.send('ollama-status', {state: 'ready', message: 'Ollama server is running.', progress: 1})
      mainWindow.webContents.send('ollama-ready')
    }
  }, pollInterval)


  // get client and do a test query
  // test query is necessary to trigger the model download, which is required before the server is considered "ready"
  const ollama = new Ollama({baseURL: 'http://localhost:11434'})
  let result
  try {
    result = await ollama.pull({model})
  } catch (error) {
    clearInterval(progressInterval)
    console.error('Failed to pull model:', error)
    mainWindow.webContents.send('ollama-status', {state: 'error', message: 'Failed to download model.', progress: 0})
    return null
  }
  console.log('Ollama pull result:', result)
  
  return ollama
}
