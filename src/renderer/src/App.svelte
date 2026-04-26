<script>
  import Sidebar from './components/Sidebar.svelte'

  import TopicManager from './components/TopicManager.svelte'
  import FileUploader from './components/FileUploader.svelte'
  import ModelChooser from './components/ModelChooser.svelte'
  import TopicChooser from './components/TopicChooser.svelte'
  import ProgressNotifications from './components/ProgressNotifications.svelte'
  import TimerPanel from './components/TimerPanel.svelte'
  import Chat from './components/Chat.svelte'
  import FloatingTimer from './components/FloatingTimer.svelte'
  import Flashcard from './components/Flashcard.svelte'

  import List, { Item } from '@smui/list'
  import Button from '@smui/button'
  import IconButton from '@smui/icon-button'
  import CircularProgress from '@smui/circular-progress'
  import { onMount } from 'svelte'

  import { renderMarkdown } from './utils/markdown.js'

  import 'svelte-material-ui/themes/svelte.css'
  import 'material-icons/iconfont/material-icons.css'

  let collapsed = $state(false)
  let active = $state('topics')

  let ollamaReady = $state(false)
  let webuiReady = $state(true)

  let selectedTopic = $state(null)
  let prevTopicId = $state(null)
  let files = $state([])

  let models = $state({})
  let selectedModel = $state('')

  let responseString = $state('')
  let question = $state('')

  let quiz = $state([])
  let generating = $state(false)

  let flashcards = $state([])
  let generatingFlashcards = $state(false)

  let quickSummary = $state('')
  let detailedSummary = $state('')
  let generatingQuickSummary = $state(false)
  let generatingDetailedSummary = $state(false)

  let chatHistory = $state([])
  let chatLoading = $state(false)
  let chatLoadingMore = $state(false)
  let pageSize = 50
  let chatInitialLoad = $state(true)
  let chatExhausted = $state(false)

  let ignoreScroll = $state(false)
  let topicChooserRef
  let webuiUnlockTimer = null

  let scrollPositions = $state(new Map([
    ['topics', 0],
    ['chat', 0],
    ['summary', 0],
    ['flashcards', 0],
    ['quiz', 0],
    ['timer', 0]
  ]))

  let disabledTabs = $derived.by(() => {
    return webuiReady ? [] : ['chat', 'summary', 'flashcards', 'quiz']
  })

  let selectedModelIsUsable = $derived.by(() => {
    if (!selectedModel || !models[selectedModel]) return false
    return models[selectedModel].installed || selectedModel.includes('-cloud')
  })

  function lockWebui() {
    webuiReady = false
    ollamaReady = false

    if (webuiUnlockTimer) {
      clearTimeout(webuiUnlockTimer)
    }

    webuiUnlockTimer = setTimeout(() => {
      unlockWebui()
    }, 12000)
  }

  function unlockWebui() {
    if (webuiUnlockTimer) {
      clearTimeout(webuiUnlockTimer)
      webuiUnlockTimer = null
    }

    webuiReady = true
    ollamaReady = true
  }

  async function loadModels() {
    try {
      const loadedModels = await window.api.getModels()

      if (loadedModels && Object.keys(loadedModels).length > 0) {
        models = loadedModels

        if (!selectedModel) {
          const lastModel = await window.api.getLastModel()

          if (lastModel && loadedModels[lastModel]) {
            selectedModel = lastModel
          } else {
            selectedModel =
              Object.entries(loadedModels).find(([_, o]) => o.summarizer)?.[0] || ''
          }
        }

        ollamaReady = true
      }
    } catch (err) {
      console.error('Could not load models:', err)
    }
  }

  const handleOnProgressUpdate = (id, attrs) => {
    const msg = String(attrs?.msg ?? '')
    const status = String(attrs?.status ?? '')
    const error = String(attrs?.error ?? '')

    const isStartingWebUI =
      msg.includes('Starting Open WebUI Server') ||
      msg.includes('Setting up Open WebUI Server')

    const isFinishedWebUI =
      msg.includes('Finished Starting Open WebUI') ||
      msg.includes('Finished Starting Open WebUI Server') ||
      msg.includes('removing Setting up Open WebUI Server') ||
      msg.includes('removing Starting Open WebUI Server')

    if (isStartingWebUI && status === 'running') {
      lockWebui()
    }

    if (isFinishedWebUI || (isStartingWebUI && status !== 'running')) {
      unlockWebui()
      loadModels()
    }

    if (attrs?.webuiReady === true) {
      unlockWebui()
      loadModels()
    }

    if (error.includes('soffice command was not found')) {
      if (!attrs.msg.includes('LibreOffice')) {
        attrs.msg += '. These types of files require LibreOffice.'
      }

      attrs.delay = 30_000
    }
  }

  $effect(() => {
    if (!webuiReady && ['chat', 'summary', 'flashcards', 'quiz'].includes(active)) {
      active = 'topics'
    }
  })

  $effect(() => {
    const onScroll = () => {
      if (ignoreScroll) return
      scrollPositions.set(active, window.scrollY)
    }

    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  })

  $effect(() => {
    const currentTab = active
    ignoreScroll = true

    queueMicrotask(() => {
      requestAnimationFrame(() => {
        const target = scrollPositions.get(currentTab) ?? 0

        window.scrollTo({
          top: target,
          behavior: 'auto'
        })

        requestAnimationFrame(() => {
          ignoreScroll = false
        })
      })
    })
  })

  $effect(async () => {
    if (selectedTopic) {
      await fetchFiles(selectedTopic.id)
      await fetchChatHistory(selectedTopic.id, prevTopicId != selectedTopic.id)

      if (prevTopicId != selectedTopic.id) {
        chatInitialLoad = true
      }

      prevTopicId = selectedTopic.id
    } else {
      files = []
      chatHistory = []
    }

    chatExhausted = false
  })

  $effect(() => {
    if (selectedModel) {
      window.api.saveLastModel(selectedModel).catch(err => {
        console.error('Failed to save last model:', err)
      })
    }
  })

  onMount(() => {
    loadModels()

    window.api.onOllamaReady(async () => {
      unlockWebui()
      await loadModels()
    })

    window.api.onModelDownloaded(async () => {
      await loadModels()
    })

    return () => {
      if (webuiUnlockTimer) {
        clearTimeout(webuiUnlockTimer)
      }
    }
  })

  async function fetchFiles(topicId) {
    files = await window.api.getFiles(topicId)
  }

  async function fetchChatHistory(topicId, replaceChatHistory = false) {
    try {
      const newChatHistory = (await window.api.getChatHistory(topicId, pageSize)).messages

      if (replaceChatHistory) {
        chatHistory = newChatHistory
      } else {
        const lastMsg = chatHistory[chatHistory.length - 1]
        let indexOfLastOldMsg = -1

        for (let i = 0; i < newChatHistory.length; i++) {
          if (newChatHistory[i].id == lastMsg?.id) {
            indexOfLastOldMsg = i
          }
        }

        const newMsgs = newChatHistory.slice(indexOfLastOldMsg + 1)
        chatHistory.push(...newMsgs)
      }
    } catch (err) {
      console.error('Error fetching chat history:', err)
      chatHistory = []
    }
  }

  async function loadMoreChatMessages() {
    if (!selectedTopic || chatLoadingMore || chatHistory.length === 0) return

    try {
      chatLoadingMore = true

      const oldestMessageId = chatHistory[0]?.id
      if (!oldestMessageId) return

      const resp = await window.api.getChatHistoryPage(
        selectedTopic.id,
        oldestMessageId,
        pageSize
      )

      const moreMessages = resp.messages
      chatExhausted = resp.atStart

      if (moreMessages.length > 0) {
        chatHistory = [...moreMessages, ...chatHistory]
      }
    } catch (err) {
      console.error('Error loading more chat messages:', err)
    } finally {
      chatLoadingMore = false
    }
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

  const sendChat = async () => {
    if (!webuiReady || !selectedTopic || !question.trim() || chatLoading) return

    try {
      chatLoading = true

      await window.api.chat(
        selectedModel,
        selectedTopic.id,
        files.map(f => f.id),
        question
      )

      await fetchChatHistory(selectedTopic.id)
      responseString = ''
    } catch (error) {
      responseString = error.message
      throw error
    } finally {
      chatLoading = false
    }
  }

  const handleOpenQuiz = (message) => {
    if (!webuiReady) return

    try {
      quiz = JSON.parse(message.content)
      active = 'quiz'
    } catch (err) {
      console.error('Failed to parse quiz:', err)
    }
  }

  const handleOpenFlashcards = (message) => {
    if (!webuiReady) return

    try {
      flashcards = JSON.parse(message.content).map(card => ({
        ...card,
        flipped: false
      }))

      active = 'flashcards'
    } catch (err) {
      console.error('Failed to parse flashcards:', err)
    }
  }

  const handleOpenSummary = (message) => {
    if (!webuiReady) return

    quickSummary = message.content
    active = 'summary'
  }

  const generateQuiz = async () => {
    if (!webuiReady || generating) return
    if (!selectedTopic) throw new Error('No topic selected')

    generating = true

    try {
      quiz = await window.api.generateQuiz(
        selectedModel,
        selectedTopic.id,
        files.map(f => f.id),
        10,
        'hard'
      )

      await fetchChatHistory(selectedTopic.id)
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
    if (!webuiReady || generatingFlashcards) return
    if (!selectedTopic) throw new Error('No topic selected')

    generatingFlashcards = true

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

      await fetchChatHistory(selectedTopic.id)
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

  const generateQuickSummary = async () => {
    if (!webuiReady || generatingQuickSummary) return
    if (!selectedTopic) throw new Error('No topic selected')

    generatingQuickSummary = true

    try {
      quickSummary = await window.api.generateQuickSummary(
        selectedModel,
        selectedTopic.id,
        files.map(f => f.id)
      )

      await fetchChatHistory(selectedTopic.id)
    } catch (error) {
      responseString = error.message

      setTimeout(() => {
        responseString = ''
      }, 10_000)

      throw error
    } finally {
      generatingQuickSummary = false
    }
  }

  const generateDetailedSummary = async () => {
    if (!webuiReady || generatingDetailedSummary) return
    if (!selectedTopic) throw new Error('No topic selected')

    generatingDetailedSummary = true

    try {
      detailedSummary = await window.api.generateDetailedSummary(
        selectedModel,
        selectedTopic.id,
        files.map(f => f.id)
      )

      await fetchChatHistory(selectedTopic.id)
    } catch (error) {
      responseString = error.message

      setTimeout(() => {
        responseString = ''
      }, 10_000)

      throw error
    } finally {
      generatingDetailedSummary = false
    }
  }
</script>

<div class="app-shell">
  <Sidebar
    bind:collapsed
    bind:active
    {disabledTabs}
  />

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

    <div class="body-layout" class:grid-bg={active !== 'timer'}>
      <main class="page-content">
        {#if active !== 'timer'}
          <FloatingTimer />
        {/if}

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
          <Chat
            {selectedTopic}
            {selectedModel}
            {chatHistory}
            bind:ignoreScroll
            bind:question
            bind:responseString
            bind:chatInitialLoad
            chatIsSelected={active === 'chat'}
            loadedAllChat={chatExhausted}
            scrollableContainer={window}
            loading={chatLoading}
            loadingMore={chatLoadingMore}
            onSendChat={sendChat}
            onLoadMoreMessages={loadMoreChatMessages}
            onOpenQuiz={handleOpenQuiz}
            onOpenFlashcards={handleOpenFlashcards}
            onOpenSummary={handleOpenSummary}
          />

        {:else if active === 'summary'}
          <section class="panel">
            <div class="section-header">
              <h2>Summary</h2>
              <p>Generate quick or detailed summaries from the selected topic and its files.</p>
            </div>

            <div class="using-text">
              Using {selectedModel || 'None'}
            </div>

            <div class="summary-actions">
              <Button
                onclick={generateQuickSummary}
                disabled={!webuiReady || !selectedTopic || generatingQuickSummary}
              >
                Generate Quick Summary
              </Button>

              <CircularProgress
                indeterminate
                style="height: 32px; width: 32px;"
                closed={!generatingQuickSummary}
              />

              <Button
                onclick={generateDetailedSummary}
                disabled={!webuiReady || !selectedTopic || generatingDetailedSummary}
              >
                Generate Detailed Summary
              </Button>

              <CircularProgress
                indeterminate
                style="height: 32px; width: 32px;"
                closed={!generatingDetailedSummary}
              />
            </div>

            {#if !selectedTopic}
              <p class="helper-text">Please select a topic first.</p>
            {/if}

            {#if quickSummary}
              <div class="summary-block">
                <h3>Quick Summary</h3>
                <div class="markdown-content">
                  {@html renderMarkdown(quickSummary)}
                </div>
              </div>
            {/if}

            {#if detailedSummary}
              <div class="summary-block">
                <h3>Detailed Summary</h3>
                <div class="markdown-content">
                  {@html renderMarkdown(detailedSummary)}
                </div>
              </div>
            {/if}
          </section>

        {:else if active === 'flashcards'}
          <Flashcard
            bind:flashcards
            {generatingFlashcards}
            {selectedTopic}
            {selectedModel}
            onGenerateFlashcards={generateFlashcards}
          />

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
              <Button
                onclick={generateQuiz}
                disabled={!webuiReady || !selectedTopic || generating || !selectedModelIsUsable}
              >
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
                <h3 class="markdown-content">
                  {@html renderMarkdown(q.question)}
                </h3>

                <form>
                  {#each q.choices as c, i (c)}
                    <div
                      class:answer={q.answered && q.answer == i}
                      class:guessed={q.answered && q.guessed == i}
                      class="choice-row"
                      onclick={() => {
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

                      <label for={`${qi}_${i}`} class="markdown-content">
                        {@html renderMarkdown(c)}
                      </label>
                    </div>
                  {/each}
                </form>

                {#if q.answered && q.explanation}
                  <div class="explanation">
                    <p><strong>Explanation:</strong></p>
                    <div class="markdown-content">
                      {@html renderMarkdown(q.explanation)}
                    </div>
                  </div>
                {/if}
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
  html, body {
    height: 100%;
    overflow: hidden;
  }

  .app-shell {
    height: 100vh;
    background: white;
  }

  .main {
    margin-left: 220px;
    min-height: 0;
    display: flex;
    flex-direction: column;
    transition: margin-left 0.25s ease;
  }

  .main.collapsed {
    margin-left: 72px;
  }

  .top-nav {
    position: fixed;
    top: 0;
    left: 220px;
    right: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    z-index: 100;
    padding: 10px 16px;
    border-bottom: 2px solid #5d80c4;
    background: white;
    box-sizing: border-box;
    gap: 16px;
    flex-shrink: 0;
  }

  .main.collapsed .top-nav {
    left: 72px;
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
    min-height: calc(100vh - 60px);
    display: flex;
    margin-top: var(--top-nav-height, 60px);
    height: calc(100vh - 60px);
    overflow: hidden;
  }

  .page-content {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow: auto;
    padding: 24px;
    box-sizing: border-box;
    height: 100%;
    overflow-y: auto;
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
    padding-left: 20px;
  }

  .files-title-row {
    display: flex;
    align-items: baseline;
    gap: 14px;
    flex-wrap: wrap;
  }

  .files-topic-name {
    font-size: 30px;
    font-weight: 600;
    color: #ec5f54;
  }

  .topics-card,
  .files-card {
    background: rgba(255, 255, 255, 0.94);
    border: 1.5px solid #2f2f2f;
    border-radius: 20px;
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

  .response-block,
  .summary-block {
    margin-top: 16px;
    padding: 16px;
    border: 1px solid #ddd;
    border-radius: 12px;
    background: #fafafa;
  }

  .summary-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .summary-block h3 {
    margin-top: 0;
    margin-bottom: 12px;
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
    display: flex;
    align-items: center;
    gap: 12px;
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

  .timer-page {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .explanation {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #f9f9f9;
  }

  .explanation p {
    margin: 0;
    font-size: 14px;
    color: #333;
  }

  .markdown-content {
    font-size: 14px;
    line-height: 1.6;
    color: #333;
  }

  .markdown-content h1 {
    font-size: 24px;
    margin: 16px 0 12px 0;
    font-weight: 600;
  }

  .markdown-content h2 {
    font-size: 20px;
    margin: 14px 0 10px 0;
    font-weight: 600;
  }

  .markdown-content h3 {
    font-size: 18px;
    margin: 12px 0 8px 0;
    font-weight: 600;
  }

  .markdown-content strong {
    font-weight: 600;
  }

  .markdown-content em {
    font-style: italic;
  }

  .markdown-content code {
    background: #f4f4f4;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
  }

  .markdown-content pre {
    background: #f4f4f4;
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 8px 0;
  }

  .markdown-content pre code {
    background: none;
    padding: 0;
    font-size: 12px;
  }

  .markdown-content ol,
  .markdown-content ul {
    margin: 8px 0;
    padding-left: 24px;
  }

  .markdown-content li {
    margin: 4px 0;
  }

  .markdown-content p {
    margin: 8px 0;
  }
</style>