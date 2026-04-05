<script>
  import Sidebar from './components/Sidebar.svelte'

  import TopicManager from './components/TopicManager.svelte'
  import FileUploader from './components/FileUploader.svelte'
  import ModelChooser from './components/ModelChooser.svelte'
  import TopicChooser from './components/TopicChooser.svelte'
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

  let collapsed = $state(false)
  let active = $state('topics')

  let ollamaReady = $state(false)
  let selectedTopic = $state(null)
  let files = $state([])

  let models = $state({})
  let selectedModel = $state('')

  let responseString = $state('')
  let question = $state('')
  let quiz = $state([])
  let generating = $state(false)

  let flashcards = $state([])
  let generatingFlashcards = $state(false)

  let topicChooserRef
  let topicsSearch = $state('')

  $effect(async () => {
    if (selectedTopic) {
      await fetchFiles(selectedTopic.id)
    } else {
      files = []
    }
  })

  async function fetchFiles(topicId) {
    files = await window.api.getFiles(topicId)
  }

  async function deleteFile(fileId) {
    if (confirm('Are you sure you want to delete this file?')) {
      await window.api.deleteFile(fileId)
      if (selectedTopic) {
        await fetchFiles(selectedTopic.id)
      }
    }
  }

  async function refreshTopics() {
    await topicChooserRef?.loadTopics()
  }

  onMount(() => {
    window.api.onOllamaReady(async () => {
      models = await window.api.getModels()
      selectedModel =
        Object.entries(models).find(([_, o]) => o.summarizer)?.[0] || ''
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
        responseString = ''
      }, 10_000)
      throw error
    } finally {
      generating = false
    }
  }

  const generateFlashcards = async () => {
    if (generatingFlashcards) return
    generatingFlashcards = true

    if (!selectedTopic) throw new Error('No topic selected')

    try {
      flashcards = await window.api.generateFlashcards(
        selectedModel,
        selectedTopic.id,
        files.map(f => f.id),
        10,
        'hard'
      )

      flashcards = flashcards.map(card => ({
        ...card,
        flipped: false
      }))
    } catch (error) {
      responseString = error.message
      setTimeout(() => {
        responseString = ''
      }, 10_000)
      throw error
    } finally {
      generatingFlashcards = false
    }
  }
</script>

<div class="app-shell">
  <Sidebar bind:collapsed bind:active />

  <div class="main" class:collapsed={collapsed}>
    <div class="top-nav">
      <div class="nav-left">
        <ModelChooser
          bind:models
          bind:selectedModel
          disabled={!ollamaReady}
        />

        <TopicChooser
          bind:this={topicChooserRef}
          bind:selectedTopic
        />
      </div>

      <div class="nav-right">
        <ProgressNotifications onProgressUpdate={handleOnProgressUpdate} />
      </div>
    </div>

    <div class="body-layout">
      <main
        class="page-content"
        class:grid-bg={active !== 'timer'}
      >
        {#if active === 'topics'}
          <section class="topics-page">
            <div class="topics-block">
              <h2 class="topics-block-title">Topics</h2>

              <div class="topics-card">
                <div class="topics-card-scroll">
                  <TopicManager
                    bind:selectedTopic
                    on:topicsUpdated={refreshTopics}
                  />
                </div>
              </div>
            </div>

            <div class="files-block">
              <div class="files-title-row">
                <h2 class="files-block-title">Files :</h2>
                <span class="files-topic-name">
                  {selectedTopic?.name || 'No topic selected'}
                </span>
              </div>

              <div class="files-card">
                <div class="files-card-scroll">
                  {#if selectedTopic}
                    <FileUploader
                      {selectedTopic}
                      on:filesUpdated={() => fetchFiles(selectedTopic.id)}
                    />

                    <div class="uploaded-files-section">
                      <h3>Uploaded Files</h3>

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
                    </div>
                  {:else}
                    <p class="helper-text">Please select a topic first.</p>
                  {/if}
                </div>
              </div>
            </div>
          </section>

        {:else if active === 'chat'}
          <section class="panel">
            <div class="section-header">
              <h2>Chat</h2>
              <p>Ask questions about the files in your selected topic.</p>
            </div>

            <div class="using-text">
              Using {selectedModel || 'None'}
            </div>

            <div class="chat-row">
              <Textfield
                class="chat-input"
                bind:value={question}
                onkeydown={handleChatKeyDown}
                disabled={!selectedTopic}
              />
              <Button onclick={sendChat} disabled={!selectedTopic}>Send</Button>
            </div>

            {#if !selectedTopic}
              <p class="helper-text">Please select a topic first.</p>
            {/if}

            {#if responseString}
              <div class="response-block">
                <p>{responseString}</p>
              </div>
            {/if}
          </section>

        {:else if active === 'flashcards'}
          <section class="panel">
            <div class="section-header">
              <h2>Flashcards</h2>
              <p>Generate flashcards from the selected topic and its files.</p>
            </div>

            <div class="using-text">
              Using {selectedModel || 'None'}
            </div>

            <div class="quiz-actions">
              <Button onclick={generateFlashcards} disabled={!selectedTopic || generatingFlashcards}>
                Generate Flashcards
              </Button>

              <CircularProgress
                indeterminate
                style="height: 32px; width: 32px;"
                closed={!generatingFlashcards}
              />
            </div>

            {#if !selectedTopic}
              <p class="helper-text">Please select a topic first.</p>
            {/if}

            <div class="flashcards-grid">
              {#each flashcards as f, fi (fi)}
                <div
                  class="flashcard"
                  on:click={() => (f.flipped = !f.flipped)}
                >
                  {#if f.flipped}
                    <h3>{f.back}</h3>
                  {:else}
                    <h3>{f.front}</h3>
                  {/if}
                </div>
              {/each}
            </div>
          </section>

        {:else if active === 'quiz'}
          <section class="panel">
            <div class="section-header">
              <h2>Quiz</h2>
              <p>Generate a quiz from the selected topic and its files.</p>
            </div>

            <div class="using-text">
              Using {selectedModel || 'None'}
            </div>

            <div class="quiz-actions">
              <Button onclick={generateQuiz} disabled={!selectedTopic || generating}>
                Generate Quiz
              </Button>

              <CircularProgress
                indeterminate
                style="height: 32px; width: 32px;"
                closed={!generating}
              />
            </div>

            {#if !selectedTopic}
              <p class="helper-text">Please select a topic first.</p>
            {/if}

            {#each quiz as q, qi (q.question)}
              <div class="quiz-card">
                <h3>{q.question}</h3>

                <form>
                  {#each q.choices as c, i (c)}
                    <div
                      class:answer={q.answered && q.answer == i}
                      class:guessed={q.answered && q.guessed == i}
                      class="choice-row"
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
              </div>
            {/each}
          </section>

        {:else if active === 'timer'}
          <section class="panel timer-page">
            <div class="section-header">
              <h2>Timer</h2>
              <p>Use your study timer here.</p>
            </div>

            <TimerPanel />
          </section>
        {/if}
      </main>
    </div>
  </div>
</div>

<style>
  .app-shell {
    min-height: 100vh;
    background: white;
  }

  .main {
    margin-left: 220px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    transition: margin-left 0.25s ease;
  }

  .main.collapsed {
    margin-left: 72px;
  }

  .top-nav {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
    padding: 10px 16px;
    border-bottom: 2px solid #5d80c4;
    background: white;
    box-sizing: border-box;
    gap: 16px;
    flex-shrink: 0;
  }

  .nav-left {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    gap: 12px;
    flex-wrap: wrap;
  }

  .nav-right {
    display: flex;
    justify-content: flex-end;
    flex: 1 1 auto;
    text-align: right;
  }

  .body-layout {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .page-content {
    flex: 1;
    min-width: 0;
    overflow: auto;
    padding: 24px;
    box-sizing: border-box;
    background-color: #ffffff;
  }

  .grid-bg {
    background-image:
      linear-gradient(#b7d4ec 1px, transparent 1px),
      linear-gradient(90deg, #b7d4ec 1px, transparent 1px);
    background-size: 40px 40px;
    background-position: 20px 0;
  }

  .panel {
    max-width: 1000px;
  }

  .section-header {
    margin-bottom: 20px;
  }

  .section-header h2 {
    margin: 0 0 6px 0;
    font-size: 28px;
  }

  .section-header p {
    margin: 0;
    color: #666;
    font-size: 14px;
  }

  .topics-page {
    max-width: 860px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .topics-search-row {
    display: flex;
    align-items: center;
  }

  .topics-search-input {
    width: 100%;
    max-width: 520px;
    height: 44px;
    padding: 0 14px;
    border: 1px solid #bcbcbc;
    border-radius: 0;
    outline: none;
    font: inherit;
    background: white;
    box-sizing: border-box;
  }

  .topics-block,
  .files-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .topics-block-title,
  .files-block-title {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
  }

  .files-title-row {
    display: flex;
    align-items: baseline;
    gap: 14px;
    flex-wrap: wrap;
  }

  .files-topic-name {
    font-size: 16px;
    font-weight: 600;
    color: #9ebfb9;
  }

  .topics-card,
  .files-card {
    background: rgba(255, 255, 255, 0.94);
    border: 1.5px solid #2f2f2f;
    border-radius: 48px;
    min-height: 420px;
    padding: 28px 26px;
    box-sizing: border-box;
  }

  .files-card {
    min-height: 380px;
  }

  .topics-card-scroll,
  .files-card-scroll {
    max-height: 100%;
    overflow: auto;
  }

  .uploaded-files-section {
    margin-top: 24px;
  }

  .uploaded-files-section h3 {
    margin: 0 0 14px 0;
    font-size: 16px;
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
    margin-bottom: 16px;
  }

  .chat-input {
    flex: 1 1 auto;
  }

  .response-block {
    margin-top: 16px;
    padding: 16px;
    border: 1px solid #ddd;
    border-radius: 12px;
    background: #fafafa;
  }

  .quiz-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .helper-text {
    color: #666;
    font-size: 14px;
    margin-top: 12px;
  }

  .quiz-card {
    margin-top: 18px;
    padding: 16px;
    border: 1px solid #ddd;
    border-radius: 12px;
    background: #fff;
  }

  .choice-row {
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;
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

  .flashcards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    margin-top: 20px;
  }

  .flashcard {
    min-height: 160px;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 16px;
    background: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    box-sizing: border-box;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .flashcard:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  }

  .flashcard h3 {
    margin: 0;
    font-size: 20px;
  }

  .timer-page {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
</style>