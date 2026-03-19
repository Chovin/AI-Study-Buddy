import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import models from '../main/models'

// Custom APIs for renderer
const api = {
  onOllamaStatus: (callback) => {
    electronAPI.ipcRenderer.on('ollama-status', (event, {state, message, progress}) => {
      callback({state, message, progress})
    })
  },
  onOllamaReady: (callback) => {
    electronAPI.ipcRenderer.on('ollama-ready', (state) => {
      callback(state)
    })
  },
  onProgressUpdate: (callback) => {
    electronAPI.ipcRenderer.on('progress:update', (event, tasks) => {
      callback(tasks)
    })
  },
  getTopics: async () => {
    return await electronAPI.ipcRenderer.invoke('get-topics')
  },
  getFiles: async (topicId) => {
    return await electronAPI.ipcRenderer.invoke('get-files', topicId)
  },
  deleteFile: async (fileId) => {
    return await electronAPI.ipcRenderer.invoke('delete-file', fileId)
  },
  createTopic: async (name) => {
    return await electronAPI.ipcRenderer.invoke('create-topic', name)
  },
  updateTopic: async (topicId, newName) => {
    return await electronAPI.ipcRenderer.invoke('update-topic', { topicId, newName })
  },
  deleteTopic: async (topicId) => {
    return await electronAPI.ipcRenderer.invoke('delete-topic', topicId)
  },
  uploadFile: async (topicId, filePath) => {
    return await electronAPI.ipcRenderer.invoke('upload-file', { topicId, filePath })
  },
  getModels: async () => {
    return await electronAPI.ipcRenderer.invoke('get-models')
  },
  downloadModel: async (modelName) => {
    return await electronAPI.ipcRenderer.invoke('download-model', modelName)
  },
  models
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
