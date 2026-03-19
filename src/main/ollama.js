import { ElectronOllama } from 'electron-ollama'
import { app } from 'electron'
import { Ollama } from 'ollama'
import path from 'path'
import fs from 'fs'
import models from './models'
import progressManager from './progressManager'


export async function setupElectronOllama() {
  const eo = new ElectronOllama({
    basePath: app.getPath('userData')
  })

  // download/start Ollama server
  const OLSPID = 'Setting Up Ollama Server'
  progressManager.startTask(OLSPID, 'Downloading server...')

  if (!(await eo.isRunning())) {
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
  console.log('Currently running Ollama', liveVersion)
  // update here in case the eo.serve doesn't block until fully downloaded
  progressManager.finishTask(OLSPID)

  mainWindow.webContents.send('ollama-ready')
  
  return eo
}

export async function setupOllama(modelName) {
  console.log('Loading model...')


  // can't figure out a way to grab the model list and sizes, so hardcode them from the models file
  const model = modelName || 'deepseek-r1:8b'

  // get client
  const OLCPID = 'Setting Up Ollama Client'
  progressManager.startTask(OLCPID)

  const ollama = new Ollama({baseURL: 'http://localhost:11434'})

  // check if model is installed
  let installedModels
  try {
    installedModels = await ollama.list()
    console.log('Installed models:', installedModels)
  } catch (error) {
    console.error('Failed to list models:', error)
    progressManager.failTask(OLCPID, 'Failed to communicate with Ollama server.', error)
  }

  const modelInstalled = installedModels.models.some(m => m.name === model)

  if (!modelInstalled) {
    // start downloading model
    progressManager.updateTask(OLCPID, {msg: 'Downloading ' + model + '...'})

    let pulled = false
    while (!pulled) {
      try {
        for await (const event of await ollama.pull({model, stream: true})) {
          if (event.total && event.completed) {
            const progress = event.completed / event.total
            progressManager.updateTask(OLCPID, { progress })
          }
        }
        pulled = true
      } catch (error) {
        console.warn('Failed to pull model, retrying in 5 seconds...', error)
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  }


  progressManager.finishTask(OLCPID, 'Model ' + model + ' is ready!')

  return ollama
}
