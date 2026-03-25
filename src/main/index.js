import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import llmApi from './llmApi'
import progressManager from './progressManager'
import fs from 'fs'
import path from 'path'
import Database from './database'


let db;
let mainWindow;
let starting = false

async function startThings() {
  // downloads and starts ElectionOllama server and Open WebUI server
  // also downloads the summarizer
  // sends ollama-ready once ollama server has started
  if (!starting && !llmApi.running) {
    starting = true
    await llmApi.start(() => {
      console.log('ollama ready')
      mainWindow.webContents.send('ollama-ready')
    })
    starting = false
  }


}

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

    await startThings()
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

  let isQuitting = false
  app.on('before-quit', (event) => {
    if (isQuitting) return; // prevent recursion if we call app.quit() again
    isQuitting = true;

    console.log('== before quit: cleaning up servers ==');
    event.preventDefault(); // stop Electron from quitting immediately

    // Stop both servers with a timeout in case something hangs
    const cleanupPromise = llmApi.stopServers();

    const timeout = new Promise((resolve) => {
      setTimeout(() => {
        console.warn('Server cleanup took too long, forcing quit...');
        resolve();
      }, 8000); // max wait 8 seconds
    });

    // Wait for either cleanup or timeout
    Promise.race([cleanupPromise, timeout])
      .then(() => {
        console.log('Cleanup done, quitting app now');
        app.quit(); // manually quit after cleanup
      })
      .catch((err) => {
        console.error('Error during cleanup, quitting anyway:', err);
        app.quit();
      });
  });

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
    await startThings()
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
    const file = await db.addFile(topicId, originalFileName);

    if (!fs.existsSync(topicDir)) {
      fs.mkdirSync(topicDir, { recursive: true });
    }

    const destination = path.join(topicDir, `${file.id}`);
    fs.copyFileSync(filePath, destination);

    await file.updatePath(destination)

    if (llmApi.running) {
      await llmApi.registerFile(file)
    }
    console.log('File upload complete: ', destination)
    return 'File uploaded successfully';
  } catch (err) {
    throw new Error(err.message);
  }
});

ipcMain.handle('delete-file', async (_, fileId) => {
  console.log('Deleting file:', fileId)
  try {
    await (await db.getFile(fileId)).delete()
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

ipcMain.handle('chat', async (_, { model, topicId, fileIds, prompt }) => {
  try {
    console.log('Received chat request:', { topicId, fileIds, prompt })
    const files = await db.getFilesByTopic(topicId);
    console.log('Files for topic:', files)
    const fileObjs = files.filter(f => fileIds.includes(f.id));
    console.log('Chat request:', { topicId, fileIds, prompt, fileObjs })
    const response = await llmApi.chatWithFileContext({
      model,
      files: fileObjs,
      messages: [
        { role: 'system', content: `You are a helpful assistant and study buddy with the purpose of helping the user study by answering questions about the provided context from uploaded documents.` },
        { role: 'user', content: prompt }
      ]
    })
    console.log(response);
    return response;
  } catch (err) {
    if (err.error == 'unauthorized' || err.status_code == 401) {
      throw new Error("Cloud models require signing into Ollama")
    }
    throw new Error(err.message);
  }
});

async function generateQuiz(model, topicId, fileIds, numberOfQuestions, difficulty) {
  try {
    const files = (await db.getFilesByTopic(topicId)).filter(f => fileIds.includes(f.id))
    let response = await llmApi.chatWithFileContext({
      model,
      files,
      messages: [
        { role: 'system', content: `
You are a study assistant that generates quizzes from provided document context.

Instructions:
- Generate high-quality multiple-choice questions based ONLY on the provided context.
- Each question must test understanding, not trivial recall.
- Each question must have exactly 4 choices.
- Only one correct answer.
- The "answer" must be the index (0–3).
- Don't make repeat any of the questions.
- Ensure the correctness of the answer and make sure the incorrect answers are actually incorrect.
- Ensure the question content is actually discussed in the provided context.

Output rules:
- Return ONLY valid JSON.
- No explanations, no markdown, no extra text.
- Ensure JSON is strictly valid and parsable. Do not include trailing commas after the last question and after the last choices. Escape double quotes, backslashes, and newlines
- Don't use any markdown syntax.

Format:
[
  {
    "question": "<question text>",
    "choices": [
      "<choice 1>", 
      "<choice 2>", 
      "<choice 3>", 
      "<choice 4>"
    ],
    "answer": 1
  },
  {
    "question": "<question2 text>",
    "choices": [
      "<choice 1>", 
      "<choice 2>", 
      "<choice 3>", 
      "<choice 4>"
    ],
    "answer": 0
  }
]
        ` },
        { role: 'user', content: `generate a quiz with ${numberOfQuestions} ${difficulty}-difficulty questions`}
      ]
    })
    console.log(response)
    response = response.trim()
    if (response.startsWith('```json')) {
      response = response.substring(7)
    }
    if (response.endsWith('```')) {
      response = response.substring(0, response.length-3)
    }
    response = response.trim()
    console.log('removed ticks', response)
    return JSON.parse(response)
  } catch (err) {
    if (err.error == 'unauthorized' || err.status_code == 401) {
      throw new Error("Cloud models require signing into Ollama")
    }
    throw new Error(err.message);
  }
}

ipcMain.handle('generate-quiz', async (_, { model, topicId, fileIds, numberOfQuestions, difficulty }) => {
  if (starting || !llmApi.running) throw new Error("Ollama and/or Open WebUI aren't running yet")
  while (true) {
    try {
      const quiz = await generateQuiz(model, topicId, fileIds, numberOfQuestions, difficulty)
      let qs = {}
      quiz.forEach(q => {
        if (qs[q.question]) throw new Error('Duplicate question')
        qs[q.question] = true
      });
      return quiz
    } catch (error) {
      console.log('Error generating quiz. Trying again. ', error)
      continue
    }
  }
})
