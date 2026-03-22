import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import llmApi from './ollama'
import progressManager from './progressManager'
import fs from 'fs'
import path from 'path'
import Database from './database'


let db;
let mainWindow;

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', async () => {
    mainWindow.show()

    progressManager.on('update', (tasks) => {
        mainWindow.webContents.send('progress:update', tasks);
    });

    // downloads and starts ElectionOllama server and Open WebUI server
    // also downloads the summarizer
    // sends ollama-ready once ollama server has started
    await llmApi.start(() => {
      console.log('ollama ready')
      mainWindow.webContents.send('ollama-ready')
    })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  db = new Database();
  app.db = db;

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('will-quit', async () => {
    await llmApi.stopServers()
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  mainWindow = createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
ipcMain.handle('progress:delete-task', (_, taskId) => {
  progressManager.removeTask(taskId)
})

ipcMain.handle('get-models', () => {
  return llmApi.models
});

ipcMain.handle('download-model', async (_, model) => {
  if (!(await llmApi.ollamaIsRunning())) {
    await llmApi.start()
  }
  let success = await llmApi.downloadModel(model);
  mainWindow?.webContents.send('model-downloaded', model)
  return success
})

ipcMain.handle('create-topic', async (_, topicName) => {
  try {
    await db.createTopic(topicName);
    return 'Topic created successfully';
  } catch (err) {
    throw new Error(err.message);
  }
});

ipcMain.handle('upload-file', async (_, { topicId, filePath }) => {
  const originalFileName = path.basename(filePath);
  const userDataPath = app.getPath('userData'); // Get the user data directory
  const topicDir = path.join(userDataPath, 'uploads', `topic_${topicId}`);

  console.log('Uploading file:', { topicId, filePath, originalFileName, topicDir })
  try {
    const fileId = await db.addFile(topicId, originalFileName);

    if (!fs.existsSync(topicDir)) {
      fs.mkdirSync(topicDir, { recursive: true });
    }

    const destination = path.join(topicDir, `${fileId}`);
    fs.copyFileSync(filePath, destination);

    await db.updateFilePath(fileId, destination);
    console.log('File upload complete: ', destination)
    return 'File uploaded successfully';
  } catch (err) {
    throw new Error(err.message);
  }
});

ipcMain.handle('delete-file', async (_, fileId) => {
  console.log('Deleting file:', fileId)
  try {
    await db.deleteFile(fileId);
    return 'File deleted successfully';
  } catch (err) {
    throw new Error(err.message);
  }
});

ipcMain.handle('get-topics', async () => {
  try {
    const topics = await db.getTopics();
    return topics;
  } catch (err) {
    throw new Error(err.message);
  }
});

ipcMain.handle('get-files', async (_, topicId) => {
  try {
    const files = await db.getFilesByTopic(topicId);
    return files;
  } catch (err) {
    throw new Error(err.message);
  }
});

ipcMain.handle('update-topic', async (_, { topicId, newName }) => {
  try {
    await db.updateTopic(topicId, newName);
    return 'Topic updated successfully';
  } catch (err) {
    throw new Error(err.message);
  }
});

ipcMain.handle('delete-topic', async (_, topicId) => {
  try {
    await db.deleteTopic(topicId);
    return 'Topic deleted successfully';
  } catch (err) {
    throw new Error(err.message);
  }
});

ipcMain.handle('chat', async (_, { model, topicId, fileIds, question }) => {
  try {
    console.log('Received chat request:', { topicId, fileIds, question })
    const files = await db.getFilesByTopic(topicId);
    console.log('Files for topic:', files)
    const filePaths = files.filter(f => fileIds.includes(f.id)).map(f => f.file_path);
    console.log('Chat request:', { topicId, fileIds, question, filePaths })
    const response = await llmApi.chat({
      model,
      messages: [
        { role: 'system', content: `You are an assistant for the following files: ${filePaths.join(', ')}. Use only the information from these files to answer the question. If you don't know the answer, say you don't know.` },
        { role: 'user', content: question }
      ]
    })
    console.log(response);
    return response.message.content;
  } catch (err) {
    if (err.error == 'unauthorized' || err.status_code == 401) {
      throw new Error("Cloud models require signing into Ollama")
    }
    throw new Error(err.message);
  }
});
