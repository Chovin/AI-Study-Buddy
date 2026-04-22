<script>
  import Button from '@smui/button'
  import CircularProgress from '@smui/circular-progress'
  import { tick } from 'svelte'

  let {
    selectedTopic = null,
    selectedModel = '',
    chatHistory = [],
    question = $bindable(''),
    messageSending = $bindable(''),
    responseString = $bindable(''),
    loading = false,
    loadingMore = false,
    onSendChat = null,
    onLoadMoreMessages = null,
    onOpenQuiz = null,
    onOpenFlashcards = null,
    onOpenSummary = null,
    chatInitialLoad = $bindable(true),
    scrollableContainer = null,
    loadedAllChat = false,
    ignoreScroll = $bindable(false),
    chatIsSelected = false
  } = $props()

  let chatContainer
  let textareaRef
  let isAtTop = true
  // let isInitialLoad = true   // Track if animating initial load
  const loadMoreThreshold = 200 // pixels from top

  let newMessages = $state([])
  let messageList = $derived(messageSending ? [...chatHistory, messageSending] : chatHistory);
  let lastMsgId = $state(messageList[messageList.length-1]?.id)

  // Auto-scroll to bottom when chat history updates
  $effect(() => {
    let newLastMsgId = messageList[messageList.length-1]?.id
    if ((lastMsgId != newLastMsgId || responseString) && !isAtTop && !chatInitialLoad) {
      lastMsgId = newLastMsgId
      ;(async () => {
        // wait for svelte to finish reacting
        await tick()

        // trying to make it scroll to the bottom on errors too, but I give up
        requestAnimationFrame(() => 
          setTimeout(() => {
            if (!responseString) newMessages.push(newLastMsgId)
            scrollableContainer?.scrollTo({
              top: (scrollableContainer == window ? document.body : scrollableContainer).scrollHeight,
              behavior: 'smooth'
            })
          }, 0)
        )
      })()
    }
  })

  // Auto-scroll to bottom on first chat load
  $effect(() => {
    // need to ping it here since we take the read out of the flow by putting it in a timeout
    void chatInitialLoad
    // settimeout 0 to prevent this from executing twice
    setTimeout(() => {
      if (messageList && messageList.length > 0 && chatInitialLoad) {
        lastMsgId = messageList[messageList.length-1].id
        messageList.slice(messageList.length-5).forEach(m => newMessages.push(m.id))
        setTimeout(() => {
          if (chatContainer) {
            scrollableContainer?.scrollTo({
              top: (scrollableContainer == window ? document.body : scrollableContainer).scrollHeight,
              behavior: 'instant'
            })
            // After scroll completes, disable initial load animation
            setTimeout(() => {
              chatInitialLoad = false
            }, 500)
          }
        }, 0)
      }
    }, 0)
  })

  $effect(() => {
    // remove new message mark
    newMessages.forEach(mid => {
      setTimeout(() => {
        newMessages.pop(newMessages.indexOf(mid))
      }, 1000)
    })
  })

  // // Reset hasLoadedChat when topic changes
  // $effect(() => {
  //   void selectedTopic
  //   hasLoadedChat = false
  //   // isInitialLoad = true
  // })

  // Auto-resize textarea as content grows
  $effect(() => {
    // Reference question to create a dependency
    void question
    if (textareaRef) {
      textareaRef.style.height = 'auto'
      textareaRef.style.height = Math.min(textareaRef.scrollHeight, 200) + 'px'
    }
  })

  const handleScroll = async (event) => {
    if (ignoreScroll || !chatIsSelected) return
    const scrollTop = (event.target == document ? window.scrollY : event.target.scrollTop)
    
    // Update isAtTop state
    isAtTop = scrollTop < 50
    
    // Load more messages if user scrolls near top
    if (scrollTop < loadMoreThreshold && !loadingMore && onLoadMoreMessages && !loadedAllChat) {
      const oldScrollBottom = (scrollableContainer == window ? document.body : scrollableContainer).scrollHeight 
      const scrollPosToEnd = oldScrollBottom - scrollTop

      await onLoadMoreMessages()

      scrollableContainer?.scrollTo({
        top: (scrollableContainer == window ? document.body : scrollableContainer).scrollHeight - scrollPosToEnd,
        behavior: 'instant'
      })
    }
  }
  scrollableContainer.addEventListener('scroll', handleScroll)

  const handleKeyDown = async (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      await handleSend()
    }
  }

  const handleSend = async () => {
    if (!selectedTopic || !question.trim() || loading) return

    try {
      loading = true
      messageSending = {
        id: chatHistory[chatHistory.length-1]?.id + 100,
        content: question,
        topic_id: chatHistory[0]?.topic_id,
        role: "user",
        timestamp: formatDate(new Date()),
        files_referenced: "[]"
      }
      newMessages.push(messageSending.id)
      await onSendChat?.()
      messageSending = null
      question = ''
    } finally {
      loading = false
    }
  }

  const getContentDisplay = (message) => {
    if (!message.role) return null

    // For generated content, show as button
    if (message.role === 'quiz') {
      return {
        type: 'quiz',
        label: 'Generated Quiz',
        onClick: () => onOpenQuiz?.(message)
      }
    }
    if (message.role === 'flashcard') {
      return {
        type: 'flashcard',
        label: 'Generated Flashcards',
        onClick: () => onOpenFlashcards?.(message)
      }
    }
    if (message.role === 'content_summary') {
      return {
        type: 'content_summary',
        label: 'Generated Summary',
        onClick: () => onOpenSummary?.(message)
      }
    }

    return null
  }

  function formatDate(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0')

    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())

    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())
    const seconds = pad(date.getSeconds())

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
</script>

<section class="chat-container">
  <div class="chat-header">
    <h2>Chat</h2>
    <p>Ask questions about the files in your selected topic.</p>
    <div class="using-text">Using {selectedModel || 'None'}</div>
  </div>

  <div class="chat-messages" bind:this={chatContainer}>
    {#if loadingMore}
      <div class="loading-indicator">
        <CircularProgress indeterminate style="height: 32px; width: 32px;" />
        <p>Loading previous messages...</p>
      </div>
    {/if}

    {#if messageList.length === 0}
      <div class="chat-empty">
        <p>No messages yet. Start a conversation!</p>
      </div>
    {/if}

    {#each messageList as message, index (message.id || index)}
      {#if ['user', 'assistant'].includes(message.role)}
        <div 
            class={{message: true, [`${message.role}-message`]: true, ["new-message"]: newMessages.includes(message.id)}} 
            style:animation-delay={`${newMessages.includes(message.id) ? newMessages.indexOf(message.id) * 100 : 0}ms`}>
          <div class="message-content">
            {message.content}
          </div>
        </div>
      {:else}
        {#if getContentDisplay(message)}
          <div 
              class={{message: true, ["content-message"]: true, ["new-message"]: newMessages.includes(message.id)}} 
              style:animation-delay={`${newMessages.includes(message.id) ? newMessages.indexOf(message.id) * 100 : 0}ms`}>
            <div class="message-content">
              <Button
                variant="raised"
                class="content-button"
                onclick={getContentDisplay(message).onClick}
              >
                <span class="content-icon">
                  {#if getContentDisplay(message).type === 'quiz'}
                    <span class="material-icons">quiz</span>
                  {:else if getContentDisplay(message).type === 'flashcard'}
                    <span class="material-icons">library_books</span>
                  {:else if getContentDisplay(message).type === 'content_summary'}
                    <span class="material-icons">summarize</span>
                  {/if}
                </span>
                <span>{getContentDisplay(message).label}</span>
              </Button>
            </div>
          </div>
        {/if}
      {/if}
    {/each}

    {#if responseString}
      <div class="message error-message new-message"
        style:animation-delay={`${newMessages.length * 100}ms`}
      >
        <div class="message-content">
          {responseString}
        </div>
      </div>
    {/if}
  </div>

  <div class="chat-input-area">
    {#if !selectedTopic}
      <p class="helper-text">Please select a topic first.</p>
    {/if}

    <div class="chat-row">
      <textarea
        bind:this={textareaRef}
        class="chat-input-textarea"
        class:loading
        bind:value={question}
        onkeydown={handleKeyDown}
        disabled={!selectedTopic || loading}
        placeholder="Type your question..."
      />
    </div>
  </div>
</section>

<style>
  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
    border-radius: 0;
  }

  .chat-header {
    padding: 16px 20px;
    border-bottom: none;
    background: transparent;
    color: inherit;
    border-radius: 0;
  }

  .chat-header h2 {
    margin: 0 0 8px 0;
    font-size: 24px;
  }

  .chat-header p {
    margin: 0 0 8px 0;
    opacity: 0.9;
  }

  .using-text {
    font-size: 12px;
    opacity: 0.8;
  }

  .chat-messages {
    flex: 1;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: transparent;
  }

  .chat-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #999;
    text-align: center;
  }

  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    color: #999;
    text-align: center;
  }

  .message {
    opacity: 1;
    display: flex;
    white-space: pre-wrap;
  }

  .message.new-message {
    opacity: 0;
    animation: fadeInUp 0.5s ease-out forwards;
    animation-delay: inherit;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .user-message {
    justify-content: flex-end;
  }

  .user-message .message-content {
    background: #667eea;
    color: white;
    border-radius: 12px 12px 0 12px;
    padding: 12px 16px;
    max-width: 70%;
    word-wrap: break-word;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .assistant-message {
    justify-content: flex-start;
  }

  .assistant-message .message-content {
    background: white;
    color: #333;
    border-radius: 12px 12px 12px 0;
    padding: 12px 16px;
    max-width: 70%;
    word-wrap: break-word;
    border: 1px solid #e0e0e0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .content-message {
    justify-content: flex-start;
  }

  .content-message .message-content {
    padding: 0;
  }

  .error-message {
    justify-content: flex-start;
  }

  .error-message .message-content {
    background: #ffebee;
    color: #c62828;
    border-radius: 12px 12px 12px 0;
    padding: 12px 16px;
    max-width: 70%;
    word-wrap: break-word;
    border: 1px solid #ef5350;
  }

  .content-button {
    text-transform: none;
    font-size: 14px;
    padding: 8px 16px;
    border-radius: 6px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .content-icon {
    display: inline-flex;
    align-items: center;
    margin-right: 8px;
  }

  .content-icon .material-icons {
    font-size: 20px;
  }

  .chat-input-area {
    padding: 16px 20px 20px 20px;
    border-top: none;
    background: transparent;
    border-radius: 0;
  }

  .chat-row {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    width: 100%;
  }

  .chat-input-textarea {
    padding: 12px 16px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    color: #333;
    background: white;
    resize: none;
    outline: none;
    flex: 1;
    min-height: 44px;
    max-height: 200px;
    overflow-y: auto;
    transition: border-color 0.2s;
  }

  .chat-input-textarea:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }

  .chat-input-textarea:disabled {
    background: #f5f5f5;
    color: #999;
    cursor: not-allowed;
  }

  .chat-input-textarea.loading {
    animation: borderPulse 2s infinite;
    border-color: #667eea;
  }

  @keyframes borderPulse {
    0% {
      border-color: #667eea;
      box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.3);
    }
    50% {
      border-color: #667eea;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
    }
    100% {
      border-color: #667eea;
      box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.3);
    }
  }

  .helper-text {
    color: #999;
    font-size: 12px;
    margin-bottom: 12px;
    text-align: right;
  }
</style>
