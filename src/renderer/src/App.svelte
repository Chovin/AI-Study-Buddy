<script>
  import Versions from './components/Versions.svelte'
  import TopicManager from './components/TopicManager.svelte'
  import FileUploader from './components/FileUploader.svelte'
  import ModelChooser from './components/ModelChooser.svelte'
  import ProgressNotifications from './components/ProgressNotifications.svelte'
  import TimerPanel from './components/TimerPanel.svelte'

  import List, { Item } from '@smui/list'
  import Button from '@smui/button'
  import IconButton from '@smui/icon-button'
  import Textfield from '@smui/textfield'
  import CircularProgress from '@smui/circular-progress'
  import { onMount } from 'svelte'

  import 'svelte-material-ui/themes/svelte.css'
  import 'material-icons/iconfont/material-icons.css'

  let ollamaReady = $state(false)
  let selectedTopic = $state(null)
  let files = $state([])

  let models = $state({})
  let selectedModel = $state('')

  let responseString = $state("")
  let question = $state("")
  let quiz = $state([])
  let generating = $state(false)

  $effect(async () => {
    if (selectedTopic) {
      await fetchFiles(selectedTopic.id)
    }
  })

  async function fetchFiles(topicId) {
    files = await window.api.getFiles(topicId)
  }

  async function deleteFile(fileId) {
    if (confirm('Are you sure you want to delete this file?')) {
      await window.api.deleteFile(fileId)
      await fetchFiles(selectedTopic.id)
    }
  }

  onMount(() => {
    window.api.onOllamaReady(async () => {
      models = await window.api.getModels()
      selectedModel = Object.entries(models).find(([_, o]) => o.summarizer)?.[0] || ''
      ollamaReady = true
    })

    window.api.onModelDownloaded(async () => {
      models = await window.api.getModels()
    })
  })

  const handleOnProgressUpdate = (id, attrs) => {
    if (String(attrs.error).includes('soffice command was not found')) {
      if (!attrs.msg.includes('LibreOffice')) {
        attrs.msg += '. These types of files require LibreOffice.'
      }
      attrs.delay = 30_000
    }
  }

  const handleChatKeyDown = async (event) => {
    if (event.key === 'Enter') {
      await sendChat()
    }
  }

  const sendChat = async () => {
    if (!selectedTopic || !question.trim()) return

    try {
      responseString = await window.api.chat(
        selectedModel,
        selectedTopic.id,
        files.map(f => f.id),
        question
      )
    } catch (error) {
      responseString = error.message
      throw error
    }
  }

  const generateQuiz = async () => {
    if (generating) return
    generating = true

    if (!selectedTopic) throw new Error('No topic selected')

    try {
      quiz = await window.api.generateQuiz(
        selectedModel,
        selectedTopic.id,
        files.map(f => f.id),
        10,
        'hard'
      )
    } catch (error) {
      responseString = error.message
      setTimeout(() => {
        responseString = ""
      }, 10_000)
      throw error
    } finally {
      generating = false
    }
  }
</script>

<div class="app-shell">
  <div class="top-nav">
    <div class="nav-left">
      <ModelChooser
        bind:models
        bind:selectedModel
        disabled={!ollamaReady}
      />
    </div>

    <div class="nav-right">
      <ProgressNotifications onProgressUpdate={handleOnProgressUpdate} />
    </div>
  </div>

  <div class="page-layout">
    <div class="main-content">
      <div class="using-text">
        Using {selectedModel || 'None'}
      </div>

      <div class="chat-row">
        <Textfield
          class="chat-input"
          bind:value={question}
          onkeydown={handleChatKeyDown}
        />
        <Button onclick={sendChat}>Send</Button>
      </div>

      {#if responseString}
        <div class="response-block">
          <p>{responseString}</p>
        </div>
      {/if}

      <div class="quiz-actions">
        <Button onclick={generateQuiz}>Generate Quiz</Button>
        <CircularProgress
          indeterminate
          style="height: 32px; width: 32px;"
          closed={!generating}
        />
      </div>

      {#each quiz as q, qi (q.question)}
        <h3>{q.question}</h3>
        <form>
          {#each q.choices as c, i (c)}
            <div
              class={{
                answer: q.answered && q.answer == i,
                guessed: q.answered && q.guessed == i
              }}
              on:click={() => {
                q.guessed = i
                q.answered = true
              }}
            >
              <input
                type="radio"
                id={`${qi}_${i}`}
                value={i}
                name={qi}
              />
              <label for={`${qi}_${i}`}>{c}</label>
            </div>
          {/each}
        </form>
      {/each}

      <div class="topic-section">
        <TopicManager bind:selectedTopic />

        {#if selectedTopic}
          <h3>Files in {selectedTopic.name}</h3>
          <FileUploader
            {selectedTopic}
            on:filesUpdated={() => fetchFiles(selectedTopic.id)}
          />

          <List>
            {#each files as file (file.id)}
              <Item>
                {file.file_name}
                <IconButton onclick={() => deleteFile(file.id)}>
                  <span class="material-icons-outlined">delete</span>
                </IconButton>
              </Item>
            {/each}
          </List>
        {/if}
      </div>
    </div>

    <aside class="right-sidebar">
      <TimerPanel />
    </aside>
  </div>
</div>

<style>
  .app-shell {
    min-height: 100vh;
    background: white;
  }

  .top-nav {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
    padding: 10px 16px;
    border-bottom: 1px solid #ddd;
    background: white;
    position: sticky;
    top: 0;
    z-index: 100;
    box-sizing: border-box;
    gap: 16px;
  }

  .nav-left {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
  }

  .nav-right {
    display: flex;
    justify-content: flex-end;
    flex: 1 1 auto;
    text-align: right;
  }

  .page-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
    gap: 24px;
    padding: 20px;
    box-sizing: border-box;
    align-items: start;
  }

  .main-content {
    min-width: 0;
  }

  .right-sidebar {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    position: sticky;
    top: 90px;
  }

  .using-text {
    font-size: 12px;
    color: #666;
    margin-bottom: 8px;
  }

  .chat-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .chat-input {
    flex: 1 1 auto;
  }

  .response-block {
    margin-bottom: 16px;
  }

  .quiz-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .topic-section {
    margin-top: 24px;
  }

  .answer {
    background-color: rgb(125, 222, 125);
  }

  .guessed {
    background-color: rgb(249, 112, 112);
  }

  .answer.guessed {
    background-color: rgb(125, 222, 125);
  }
</style>