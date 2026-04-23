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
    electronAPI.ipcRenderer.on('ollama-ready', (state) => {
      callback(state)
    })
  },
  onProgressUpdate: (callback) => {
    electronAPI.ipcRenderer.on('progress:update', (event, tasks) => {
      callback(tasks)
    })
  },
  onModelDownloaded: (callback) => {
    electronAPI.ipcRenderer.on('model-downloaded', (event, model) => {
      callback(model)
    })
  },
  deleteProgressTask: async (taskId) => {
    return await electronAPI.ipcRenderer.invoke('progress:delete-task', taskId)
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
  chat: async (model, topicId, fileIds, prompt) => {
    return await electronAPI.ipcRenderer.invoke('chat', { model, topicId, fileIds, prompt })
  },
  generateQuiz: async (model, topicId, fileIds, numberOfQuestions, difficulty) => {
    return await electronAPI.ipcRenderer.invoke('generate-quiz', { model, topicId, fileIds, numberOfQuestions, difficulty })
  },
  generateFlashcards: async (model, topicId, fileIds, numberOfCards, difficulty) => {
    return await electronAPI.ipcRenderer.invoke('generate-flashcards', { model, topicId, fileIds, numberOfCards, difficulty })
  },
  generateSummary: async (model, topicId, fileIds) => {
    return await electronAPI.ipcRenderer.invoke('generate-summary', { model, topicId, fileIds })
  },
  generateQuickSummary: async (model, topicId, fileIds) => {
    return await electronAPI.ipcRenderer.invoke('generate-quick-summary', { model, topicId, fileIds })
  },
  generateDetailedSummary: async (model, topicId, fileIds) => {
    return await electronAPI.ipcRenderer.invoke('generate-detailed-summary', { model, topicId, fileIds })
  },
  getChatHistory: async (topicId, pageSize) => {
    return await electronAPI.ipcRenderer.invoke('get-chat-history-page', { topicId, beforeId: null, pageSize })
  },
  getChatHistoryPage: async (topicId, beforeId, pageSize) => {
    return await electronAPI.ipcRenderer.invoke('get-chat-history-page', { topicId, beforeId, pageSize })
  },
  saveTimerSettings: async (timerValue, pomodoroWork, pomodoroBreak) => {
    return await electronAPI.ipcRenderer.invoke('save-timer-settings', { timerValue, pomodoroWork, pomodoroBreak })
  },
  loadTimerSettings: async () => {
    return await electronAPI.ipcRenderer.invoke('load-timer-settings')
  },
  saveLastModel: async (modelName) => {
    return await electronAPI.ipcRenderer.invoke('save-last-model', modelName)
  },
  getLastModel: async () => {
    return await electronAPI.ipcRenderer.invoke('get-last-model')
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
