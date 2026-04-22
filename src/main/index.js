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
  llmApi.setDatabase(db);

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

ipcMain.handle('get-chat-history-page', async (_, { topicId, beforeId, pageSize }) => {
  try {
    const history = await db.getChatHistoryPageBeforeId(topicId, beforeId, pageSize);
    if (history.length < pageSize) {
      // If we have fewer results than requested, it means we've reached the beginning
      return {
        messages: history,
        atStart: true
      };
    }
    return {
      messages: history,
      atStart: false
    };
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
      topicId,
      files: fileObjs,
      systemMessage: `You are a helpful assistant and study buddy with the purpose of helping the user study by answering questions about the provided context from uploaded documents.`,
      promptMessage: prompt
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
      topicId,
      saveToHistory: false,
      files,
      systemMessage: `
You are a study assistant that generates quizzes from provided document context.

Instructions:
- Generate high-quality multiple-choice questions based ONLY on the provided context.
- Each question must test understanding, not trivial recall.
- Each question must have exactly 4 choices.
- Only one correct answer.
- The "answer" must be the index (0–3).
- Provide a brief explanation for why the correct answer is correct.
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
    "answer": 1,
    "explanation": "<brief explanation for the correct answer>"
  },
  {
    "question": "<question2 text>",
    "choices": [
      "<choice 1>", 
      "<choice 2>", 
      "<choice 3>", 
      "<choice 4>"
    ],
    "answer": 0,
    "explanation": "<brief explanation for the correct answer>"
  }
]
      `,
      promptMessage: `generate a quiz with ${numberOfQuestions} ${difficulty}-difficulty questions`
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
    // replace <choice>/<p>/<context> tags
    // should be ok to remove <p> unless it's a html class :P
    if (response.match(/<(choice|p|context) ?\d*\/?>/)) console.log(response)
    response = response.replaceAll(/<\/?(choice|p) ?\d*\/?>/g, "")
    response = response.replaceAll(/"\[\d+\] ?/g, '"')
    // don't just remove these intances because sometimes the llm
    // references the context files as [1], etc

    // this happens so often, maybe we just live with it.. or remove all instances..
    // if (response.match(/\[\d+\]/)) {
    //   throw new Error("Incorrectly formatted quiz")
    // }

    let quiz
    
    try {
      quiz = JSON.parse(response)
    } catch (err) {
      const matches = response.matchAll(/^((#* ?\**(question)? ?(?<qn>\d+)\.?\**:?\**\n*(?<question>.*)$)|(#* ?\**(answer)\.?\**:?\**\s*\n*\**( ?\(?(?<answerchoice>[abcd1234])[.)] ?)?\n*(?<answer>.*)$)|(\** ?\(?(?<cn>[abcd1234])[.)] (?<choice>.*))|(#* ?\**(explanation)\.?\**:\**\n*(?<explanation>.*)$))/gim)
      quiz = []
      let currentQuestion = null
      for (const match of matches) {
        if (match.groups.question) {
          if (currentQuestion) {
            quiz.push(currentQuestion)
          }
          currentQuestion = {
            question: match.groups.question.trim(),
            choices: [],
            answer: null,
            explanation: null
          }
        } else if (match.groups.choice) {
          currentQuestion.choices.push(match.groups.choice.trim())
        } else if (match.groups.answer || match.groups.answerchoice) {
          let answerIndex
          if (match.groups.answerchoice) {
            const answerLetter = match.groups.answerchoice.trim()[0].toLowerCase()
            if (!['a', 'b', 'c', 'd'].includes(answerLetter)) {
              answerIndex = parseInt(answerLetter) - 1
            } else {
              answerIndex = answerLetter.charCodeAt(0) - 'a'.charCodeAt(0)
            }
          } else {
            answerIndex = currentQuestion.choices.indexOf(match.groups.answer.trim())
          }
          if (answerIndex !== -1) {
            currentQuestion.answer = answerIndex
          }
        } else if (match.groups.explanation) {
          currentQuestion.explanation = match.groups.explanation.trim()
        }
      }
      if (currentQuestion) {
        quiz.push(currentQuestion)
      }
    }
    if (quiz.some(q => !q.question.trim()) || quiz.some(q => q.choices.some(v => !v.trim()) || quiz.some((q) => q.answer === null || q.answer < 0 || q.answer > q.choices.length - 1))) {
      throw new Error("Empty question or answers")
    }
    if (quiz.length !== numberOfQuestions) {
      throw new Error(`Quiz is the wrong size. likely incorrectly formatted.`)
    }
    return quiz
  } catch (err) {
    if (err.error == 'unauthorized' || err.status_code == 401) {
      throw new Error("Cloud models require signing into Ollama")
    }
    throw err;
  }
}

let quizNumber = 1
ipcMain.handle('generate-quiz', async (_, { model, topicId, fileIds, numberOfQuestions, difficulty }) => {
  if (starting || !llmApi.running) throw new Error("Ollama and/or Open WebUI aren't running yet")
  const GQPID = `Generating Quiz ${quizNumber}`
  quizNumber += 1
  let tries = 0
  const {updateTask, finishTask, failTask} = progressManager.startFakeProgressTask(GQPID)
  while (true) {
    try {
      const quiz = await generateQuiz(model, topicId, fileIds, numberOfQuestions, difficulty)
      let qs = {}
      quiz.forEach(q => {
        if (qs[q.question]) throw new Error('Duplicate question')
        qs[q.question] = true
      });
      
      // Save quiz to database
      await db.saveGeneratedContent(topicId, 'quiz', JSON.stringify(quiz), fileIds || []);
      
      finishTask()
      return quiz
    } catch (error) {
      console.log('Error generating quiz. Trying again. ', error)
      updateTask({msg: `Error generating quiz. Trying again. ${error}`, progress: 0})
      tries += 1
      if (tries >= 5) {
        failTask(`Failed too many times to generate a quiz. Something is probably wrong.`, error)
        throw new Error(`Failed too many times to generate a quiz. Something is probably wrong. You may want to try a different model. ${error}`)
      }
      continue
    }
  }
})

async function generateFlashcards(model, topicId, fileIds, numberOfCards, difficulty) {
  try {
    const files = (await db.getFilesByTopic(topicId)).filter(f => fileIds.includes(f.id))

    let response = await llmApi.chatWithFileContext({
      model,
      topicId,
      saveToHistory: false,
      files,
      systemMessage: `
You are a study assistant that generates flashcards from provided document context.

Instructions:
- Generate high-quality flashcards based ONLY on the provided context.
- Each flashcard must test understanding, not trivial recall.
- No duplicate flashcards.
- Ensure the content is actually discussed in the provided context.

Output rules:
- Return ONLY valid JSON.
- No explanations, no markdown, no extra text.
- Ensure JSON is strictly valid and parsable. Do not include trailing commas.
- Escape double quotes, backslashes, and newlines.
- Don't use any markdown syntax.

Format:
[
  {
    "front": "<question or prompt>",
    "back": "<answer or explanation>"
  },
  {
    "front": "<question or prompt>",
    "back": "<answer or explanation>"
  }
]
        `,
      promptMessage: `generate ${numberOfCards} ${difficulty}-difficulty flashcards`
    })

    console.log(response)

    response = response.trim()

    if (response.startsWith('```json')) {
      response = response.substring(7)
    }
    if (response.endsWith('```')) {
      response = response.substring(0, response.length - 3)
    }

    response = response.trim()

    // cleanup tags
    if (response.match(/<(card|p|context) ?\d*\/?>/)) console.log(response)
    response = response.replaceAll(/<\/?(card|p) ?\d*\/?>/g, "")
    response = response.replaceAll(/"\[\d+\] ?/g, '"')

    // this happens so often, maybe we just live with it.. or remove all instances..
    // if (response.match(/\[\d+\]/)) {
    //   throw new Error("Incorrectly formatted flashcards")
    // }

    let flashcards;

    // try make sure it's json
    try {
      flashcards = JSON.parse(response)
    } catch (err) {
      // if not, recover if it's question/front: answer/back: pairs
      let matches = response.matchAll(/\**((?<front>question|front)|(?<back>answer|back))\** ?\d*:\** (?<content>.*)/gi)
      flashcards = []
      let card = {}
      let front = true
      matches.forEach(m => {
        if (front && m.groups.front) {
          card.front = m.groups.content
        } else if (!front && m.groups.back) {
          card.back = m.groups.content
          flashcards.push(card)
          card = {}
        } else {
          // if we get a back without a front or vice versa, the format is wrong
          throw new Error("Incorrectly formatted flashcards. " + err)
        }
        front = !front
      });
      if (flashcards.length !== numberOfCards) {
        throw new Error("Incorrectly formatted flashcards. Couldn't recover enough flashcards from response. " + err)
      }
    }

    // check if each flashcard is just an array of 2 strings
    if (flashcards.every(f => Array.isArray(f) && f.length === 2)) {
      // incorrect format but we can recover
      flashcards = flashcards.map(f => ({ front: f[0], back: f[1] })) 
    }

    if (
      flashcards.some(f => !f.front.trim()) ||
      flashcards.some(f => !f.back.trim())
    ) {
      throw new Error("Empty flashcard content")
    }

    return flashcards
  } catch (err) {
    if (err.error == 'unauthorized' || err.status_code == 401) {
      throw new Error("Cloud models require signing into Ollama")
    }
    throw err
  }
}

let flashcardNumber = 1
ipcMain.handle('generate-flashcards', async (_, { model, topicId, fileIds, numberOfCards, difficulty }) => {
  if (starting || !llmApi.running) throw new Error("Ollama and/or Open WebUI aren't running yet")

  const GFID = `Generating Flashcards ${flashcardNumber}`
  flashcardNumber += 1

  let tries = 0
  const { updateTask, finishTask, failTask } = progressManager.startFakeProgressTask(GFID)

  while (true) {
    try {
      const flashcards = await generateFlashcards(model, topicId, fileIds, numberOfCards, difficulty)

      let seen = {}
      flashcards.forEach(f => {
        if (seen[f.front]) throw new Error('Duplicate flashcard')
        seen[f.front] = true
      })

      // Save flashcards to database
      await db.saveGeneratedContent(topicId, 'flashcard', JSON.stringify(flashcards), fileIds || []);

      finishTask()
      return flashcards
    } catch (error) {
      console.log('Error generating flashcards. Trying again. ', error)
      updateTask({ msg: `Error generating flashcards. Trying again. ${error}`, progress: 0 })

      tries += 1
      if (tries >= 5) {
        failTask(`Failed too many times to generate flashcards. Something is probably wrong.`, error)
        throw new Error(`Failed too many times to generate flashcards. You may want to try a different model. ${error}`)
      }

      continue
    }
  }
})

async function generateSummaryBase(model, topicId, fileIds, style) {
  try {
    const files = (await db.getFilesByTopic(topicId)).filter(f => fileIds.includes(f.id))

    let systemMessage = ''
    if (style === 'quick') {
      systemMessage = `
You are a study assistant that creates concise summaries from provided document context.

Instructions:
- Create a short, clear summary based ONLY on the provided context.
- Focus on the most important ideas and key facts.
- Use bullet points or a brief paragraph.
- Keep the summary concise and easy to scan.

Output rules:
- Return a well-formatted markdown summary.
- Do not include any text outside the summary.
- Use headers and bullets only when helpful.`
    } else {
      systemMessage = `
You are a study assistant that creates in-depth summaries from provided document context.

Instructions:
- Create a detailed, well-organized summary based ONLY on the provided context.
- Highlight key concepts, supporting details, and important relationships.
- Use sections, headers, and bullet points where helpful.
- Make the summary comprehensive and easy to understand.

Output rules:
- Return a well-formatted markdown summary.
- Do not include any text outside the summary.
- Use headers, bullets, and bold text for clarity.`
    }

    let response = await llmApi.chatWithFileContext({
      model,
      topicId,
      saveToHistory: false,
      files,
      systemMessage,
      promptMessage: `Create a ${style} summary of the provided documents.`
    })

    console.log(response)

    response = response.trim()

    if (response.startsWith('```')) {
      response = response.substring(response.indexOf('\n') + 1)
    }
    if (response.endsWith('```')) {
      response = response.substring(0, response.lastIndexOf('```'))
    }

    response = response.trim()

    if (!response) {
      throw new Error("Empty summary generated")
    }

    // Save content summary to database
    await db.saveGeneratedContent(topicId, 'content_summary', response, fileIds || []);

    return response
  } catch (err) {
    if (err.error == 'unauthorized' || err.status_code == 401) {
      throw new Error("Cloud models require signing into Ollama")
    }
    throw err
  }
}

async function generateQuickSummary(model, topicId, fileIds) {
  return generateSummaryBase(model, topicId, fileIds, 'quick')
}

async function generateDetailedSummary(model, topicId, fileIds) {
  return generateSummaryBase(model, topicId, fileIds, 'detailed')
}

let summaryNumber = 1
ipcMain.handle('generate-summary', async (_, { model, topicId, fileIds }) => {
  if (starting || !llmApi.running) throw new Error("Ollama and/or Open WebUI aren't running yet")
  return await generateQuickSummary(model, topicId, fileIds)
})

ipcMain.handle('generate-quick-summary', async (_, { model, topicId, fileIds }) => {
  if (starting || !llmApi.running) throw new Error("Ollama and/or Open WebUI aren't running yet")

  const GSID = `Generating Quick Summary ${summaryNumber}`
  summaryNumber += 1

  let tries = 0
  const { updateTask, finishTask, failTask } = progressManager.startFakeProgressTask(GSID)

  while (true) {
    try {
      const summary = await generateQuickSummary(model, topicId, fileIds)
      finishTask()
      return summary
    } catch (error) {
      console.log('Error generating quick summary. Trying again. ', error)
      updateTask({ msg: `Error generating quick summary. Trying again. ${error}`, progress: 0 })

      tries += 1
      if (tries >= 5) {
        failTask(`Failed too many times to generate a quick summary. Something is probably wrong.`, error)
        throw new Error(`Failed too many times to generate a quick summary. Something is probably wrong. You may want to try a different model. ${error}`)
      }

      continue
    }
  }
})

ipcMain.handle('generate-detailed-summary', async (_, { model, topicId, fileIds }) => {
  if (starting || !llmApi.running) throw new Error("Ollama and/or Open WebUI aren't running yet")

  const GSID = `Generating Detailed Summary ${summaryNumber}`
  summaryNumber += 1

  let tries = 0
  const { updateTask, finishTask, failTask } = progressManager.startFakeProgressTask(GSID)

  while (true) {
    try {
      const summary = await generateDetailedSummary(model, topicId, fileIds)
      finishTask()
      return summary
    } catch (error) {
      console.log('Error generating detailed summary. Trying again. ', error)
      updateTask({ msg: `Error generating detailed summary. Trying again. ${error}`, progress: 0 })

      tries += 1
      if (tries >= 5) {
        failTask(`Failed too many times to generate a detailed summary. Something is probably wrong.`, error)
        throw new Error(`Failed too many times to generate a detailed summary. Something is probably wrong. You may want to try a different model. ${error}`)
      }

      continue
    }
  }
})
