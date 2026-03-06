import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  onOllamaStatus: (callback) => {
    electronAPI.ipcRenderer.on('ollama-status', (event, {state, message, progress}) => {
      callback({state, message, progress})
    })
  },
  onOllamaReady: (callback) => {
    electronAPI.ipcRenderer.once('ollama-ready', () => {
      callback()
    })
  }
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
