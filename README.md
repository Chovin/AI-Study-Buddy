# AI-Study-Buddy

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)

## Project Setup

### Install

1. Install [Node.js](https://nodejs.org/)
2. Install [Python](https://www.python.org/)
3. In the project directory, run `npm install`

### Development

```bash
$ npm run dev
$ # or to test building
$ npm run start
```

This app is built with `electron-vite`. Vite acts as the build tool bundling the renderer up and provides hot reloading.
Electron is the framework that is used to make desktop apps with JS (Node.js). Electron architecture is split into 3 main components:
the main process, one or more renderer processes, and preload scripts. 

The main process acts as the app's backend. it manages the app's windows and the application's lifecycle. It runs in a Node.js environment so it has access to the OS's apis and file system.

The renderer processes hold the app's frontend logic and are responsible for displaying (rendering) stuff to the user. 

If you want to communicate between the main process and a renderer process, you'll need to expose dev-defined apis to the renderer. You do this in the preload scripts.

With this in mind, if you want to expose new functionality to the frontend, you will need to create the functionality in the main folder (most likely `main/index.js`), expose that as an api endpoint in the preload folder (`preload/index.js`), and then use it in the renderer folder (`renderer/src/App.svelte` or `renderer/src/components/<your_component>.svelte`).

For example we have this IPC (Inter-Process Communication) listener in the main process:

```js
ipcMain.handle('get-topics', async () => {
  try {
    const topics = await db.getTopics();
    return topics;
  } catch (err) {
    throw new Error(err.message);
  }
});
```
notice, we use ipcMain.handle and give it a name and function to execute when the listener is triggered.

In `preload/index.js` we expose it to the renderer processes:

```js
const api = {
  ...,

  getTopics: async () => {
    return await electronAPI.ipcRenderer.invoke('get-topics')
  },
}

...

contextBridge.exposeInMainWorld('api', api)
```
we then use this endpoint in `renderer/src/components/TopicManager.svelte`:
```html
<script>
  ...

  async function fetchTopics() {
    topics = await window.api.getTopics();
  }
</script>
```

The renderer is basically just rendering a webpage, so any HTML/CSS/JS should work. However, we are using Svelte (some files in V4, some in V5. see [migration guide](https://svelte.dev/docs/svelte/v5-migration-guide) for the differences) as our frontend framework, so it'll be easier if you learn that as you go. Try to organize things into components that you can reuse and place in different places.

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Architecture

### Backend

#### App

This is a desktop app built in [Electron](https://www.electronjs.org/) (Node.js).

#### AI

* The app downloads and runs an [Ollama](https://ollama.com/) server to handle LLM tasks and chat
* It also runs the Python library [Open WebUI](https://openwebui.com/) for a Retrieval-Augmented Generation (RAG) pipeline API. This handles uploaded file OCR, vectorizing, indexing, and offers it to the LLM for retrieval

### Frontend

The frontend of this desktop app is built on [Svelte](https://svelte.dev/) V4 and V5 and uses [Svelte Material UI](https://sveltematerialui.com/) as its [Material Design](https://m3.material.io/) component library

### Database

The database is a simple [SQLite](https://sqlite.org/) database as we don't need anything large or powerful since each user has their own copy of the app and database

## Diagrams

```mermaid
flowchart TD
    User[User] --> AppUI[Electron App UI]

    AppUI --> TopicManager[CRUD Topic Manager]
    AppUI --> FileUpload[File Upload/Delete]
    AppUI --> PomodoroTimer[Configurable Pomodoro Timer]
    AppUI --> StudyBuddyChat[Study Buddy Chat]

    PomodoroTimer --> TriggerChat[Trigger Chat Event After Timer Ends]
    PomodoroTimer --> PomodoroStats[Save Pomodoro Configuration in Database]
    PomodoroStats --> Database

    TopicManager --> Database[(SQLite Database)]

    FileUpload --> SaveToDisk[Save Uploaded File to Disk]
    SaveToDisk --> RecordFileMetadata[Record File Metadata in Database]
    RecordFileMetadata --> Database

    FileUpload --> OpenWebUI[Open WebUI → Ollama LLM]
    OpenWebUI --> GeneratedContent[Generate Summaries, Quizzes, and Flashcards Based on Files in Topic]

    GeneratedContent --> Database

    AppUI --> UseGeneratedContent[Read Summaries, Take Quizzes, Practice Flashcards]
    UseGeneratedContent --> Database

    StudyBuddyChat --> OpenWebUI
    OpenWebUI --> StoreChatHistory[Store Chat History in SQLite per Topic]

    StoreChatHistory --> Database

    Database --> AppUI
```

```mermaid
architecture-beta
    group studybuddy(server)[Study Buddy]

    service ollama(server)[Ollama Server] in studybuddy
    service webui(server)[Open WebUI Server] in studybuddy
    service db(database)[Database] in studybuddy
    service models(disk)[Models in ollama Folder] in studybuddy
    service dbfolder(disk)[DB in userData Folder] in studybuddy
    service electron(server)[Electron App Main Process] in studybuddy
    service renderer(internet)[Electron Renderer Process] in studybuddy
    service files(disk)[Uploaded Files in userData Folder] in studybuddy

    junction extra in studybuddy

    db:L -- R:electron
    models:T -- B:ollama
    dbfolder:T -- B:db
    electron:L -- R:ollama
    electron:B -- T:webui
    electron:T -- B:extra
    extra:R -- L:files
    extra:L -- R:renderer
```

```mermaid
flowchart LR
    %% Actor
    User(👤 User)

    %% System as a subgraph
    subgraph AI_Study_Buddy_App["AI Study Buddy App"]
        StartApp([Start App])

        %% Topic Management
        subgraph TopicManagement["Topic Management"]
            CreateTopic([Create / Edit / Select Topic])
        end

        %% File Management
        subgraph FileManagement["File Management"]
            UploadFiles([Upload / Delete Files])
        end

        %% Content Interaction
        subgraph ContentInteraction["Content Interaction"]
            GenerateContent([Request Summaries, Quizzes, Flashcards])
            UseGeneratedContent([Read Summaries, Take Quizzes, Practice Flashcards])
        end

        %% Pomodoro & Chat
        subgraph PomodoroAndChat["Pomodoro & Chat"]
            StartPomodoro([Start Pomodoro Timer])
            ConfigurePomodoro([Configure Pomodoro Settings])
            ReceiveMotivation([Receive Motivational Feedback])
            AskQuestions([Ask Questions in Chat])
            IncludeContent([Include Specific Files or Generated Content in Chat])
        end

        %% Model Selection
        subgraph ModelManagement["Model Management"]
            ChooseDownloadModel([Choose / Download Models])
        end
    end

    %% Actor interactions
    User --> StartApp
    User --> CreateTopic
    User --> UploadFiles
    User --> GenerateContent
    User --> UseGeneratedContent
    User --> StartPomodoro
    User --> ConfigurePomodoro
    User --> ReceiveMotivation
    User --> AskQuestions
    User --> IncludeContent
    User --> ChooseDownloadModel

    %% Database subgraph
    subgraph Database["SQLite Database"]
        DatabaseStorage[(Database in &lt;userData&gt;)]
    end

    %% File system subgraph
    subgraph FileSystem["Local File System"]
        SaveUploadedFiles([Save Uploaded Files to &lt;userData&gt;])
        SaveModels([Save Downloaded Models to &lt;home&gt;/.ollama])
    end

    %% LLM subgraph
    subgraph LLM["Open WebUI → Ollama LLM"]
        StartLLMServers([Download & Start Open WebUI & Ollama Servers])
        GenerateByLLM([Generate Summaries, Quizzes, Flashcards])
        SendQuestionToLLM([Send Question to Open WebUI → Ollama LLM])
        DownloadModel([Pull Models from Ollama])
        GenerateMotivation([Generate Motivational Feedback])
    end

    %% Backend connections
    StartApp --> StartLLMServers

    UploadFiles --> SaveUploadedFiles
    SaveFileMetadata([Save File Metadata to Database])
    UploadFiles --> SaveFileMetadata
    SaveFileMetadata --> DatabaseStorage

    CreateTopic --> DatabaseStorage
    GenerateContent --> GenerateByLLM
    GenerateByLLM --> DatabaseStorage
    UseGeneratedContent --> DatabaseStorage
    ConfigurePomodoro --> DatabaseStorage

    %% Chat & Motivation
    ReceiveMotivation --> GenerateMotivation
    AskQuestions --> SendQuestionToLLM
    IncludeContent --> SendQuestionToLLM

    %% Save chat history
    SaveChatHistory([Save Chat History by Topic])
    SendQuestionToLLM --> SaveChatHistory
    GenerateMotivation --> SaveChatHistory
    SaveChatHistory --> DatabaseStorage

    %% Model download flow
    ChooseDownloadModel --> DownloadModel
    DownloadModel --> SaveModels
```

## WishListed Features

* [ ] Summary improvements
  * [ ] Outline
  * [ ] Concept Explanations
* [ ] Quiz improvements
  * [ ] Difficulty chooser
  * [ ] Answer Explanations
* [ ] Exportable quizzes and flashcards to Quizlet
* [ ] Chat improvements
  * [ ] Suggest breaks (can just trigger on Pomodoro long break)
  * [ ] Give productivity tips
  * [ ] Customizable tone
* [ ] Gamify
  * [ ] Track Pomodoro stats (time spent, sessions finished)
  * [ ] Track Quiz / Flashcard stats like questions/cards finished, answers correct, correct streak
  * [ ] Overall points / lvl
  * [ ] Topic points / lvl
  * [ ] Achievements
* [ ] Highlight, add comments, ask questions about summary