<script>
  import CircularProgress from '@smui/circular-progress'
  import { tick } from 'svelte'
  import { renderMarkdown } from '../utils/markdown.js'
  import AppButton from './AppButton.svelte';
  import { AlarmClockCheck } from 'lucide-svelte'

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

  let cornerIconSize = 25

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

    const variants = {
      quiz: {
        label: 'Generated Quiz', topic: 'quiz', onClick: () => onOpenQuiz?.(message)
      },
      flashcard: {
        label: 'Generated Flashcards', topic: 'flashcards', onClick: () => onOpenFlashcards?.(message)
      },
      content_summary: {
        label: 'Generated Summary', topic: 'summary', onClick: () => onOpenSummary?.(message)
      }
    }

    return variants[message.role]
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
      {#if ['user', 'assistant', 'motivation'].includes(message.role)}
        <div 
          class={{
            message: true, 
            [`${message.role == 'motivation' ? 'assistant' : message.role}-message`]: true, 
            ["new-message"]: newMessages.includes(message.id),
            motivation: message.role == 'motivation'
          }} 
          style:animation-delay={`${newMessages.includes(message.id) ? newMessages.indexOf(message.id) * 100 : 0}ms`}
          style:--corner-icon-size={`${cornerIconSize}px`}
        >
          <div class="message-content markdown-content">
            {@html renderMarkdown(message.content)}
            {#if message.role == 'motivation'}
              <span class="corner-icon">
                <svelte:component this={AlarmClockCheck} size={cornerIconSize} />
              </span>
            {/if}
          </div>
        </div>
      {:else}
        {#if getContentDisplay(message)}
          <div 
              class={{
                message: true, 
                ["content-message"]: true, 
                ["new-message"]: newMessages.includes(message.id)
              }} 
              style:animation-delay={`${newMessages.includes(message.id) ? newMessages.indexOf(message.id) * 100 : 0}ms`}>
            <div class="message-content">
              <AppButton
                type="raised"
                variant={getContentDisplay(message).topic}
                onClick={getContentDisplay(message).onClick}
                label={getContentDisplay(message).label}
              ></AppButton>
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

  .user-message .message-content,
  .assistant-message .message-content {
    padding: 0px 16px;
    max-width: 70%;
    word-wrap: break-word;
  }

  /* llms sometimes don't put lists in ol/ul which
    means they don't get indented, so we'll indent
    them here and revert the style for li with ol/ul
  */
  .assistant-message .message-content :global(li),
  .user-message .message-content :global(li) {
    padding-inline-start: 25px;
    list-style-position: inside;
  }

  .assistant-message .message-content :global(ol li),
  .assistant-message .message-content :global(ul li),
  .user-message .message-content :global(ol li),
  .user-message .message-content :global(ul li) {
    padding-inline-start: revert;
    list-style-position: revert;
  }

  .assistant-message .message-content :global(pre),
  .user-message .message-content :global(pre) {
    overflow: scroll;
  }

  .user-message .message-content {
    background: #667eea;
    color: white;
    border-radius: 12px 12px 0 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .assistant-message {
    justify-content: flex-start;
  }

  .assistant-message .message-content {
    background: white;
    color: #333;
    border-radius: 12px 12px 12px 0;
    border: 1px solid #e0e0e0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .message.assistant-message.motivation .message-content {
    background: hsl(from #d198f7 h s calc(l + 15));
  }

  .message.assistant-message.motivation .message-content{
    position: relative;
  }

  .message.assistant-message.motivation .message-content .corner-icon {
    position: absolute;
    top: calc(-0.4 * var(--corner-icon-size));
    right: calc(-0.4 * var(--corner-icon-size));
    width: var(--corner-icon-size);
    height: var(--corner-icon-size);
    transform: rotate(10deg);
    background: white;
    border-radius: 50%;
    padding: 4px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    animation: rock 2s ease-in-out infinite;
  }

  @keyframes rock {
    0%   { transform: rotate(10deg) }
    25%  { transform: rotate(20deg) }
    50%  { transform: rotate( 0deg) }
    75%  { transform: rotate(10deg) }
    100% { transform: rotate(10deg) }
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
  .content-icon {
    display: inline-flex;
    align-items: center;
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

  /* Markdown content styling for chat */
  .message-content.markdown-content h1 {
    font-size: 18px;
    margin: 8px 0 4px 0;
    font-weight: 600;
  }

  .message-content.markdown-content h2 {
    font-size: 16px;
    margin: 6px 0 3px 0;
    font-weight: 600;
  }

  .message-content.markdown-content h3 {
    font-size: 15px;
    margin: 4px 0 2px 0;
    font-weight: 600;
  }

  .message-content.markdown-content strong {
    font-weight: 600;
  }

  .message-content.markdown-content em {
    font-style: italic;
  }

  .message-content.markdown-content code {
    background: rgba(0, 0, 0, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
  }

  .user-message .message-content.markdown-content code {
    background: rgba(255, 255, 255, 0.2);
  }

  .message-content.markdown-content pre {
    background: #f4f4f4;
    padding: 8px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 4px 0;
    font-size: 12px;
  }

  .message-content.markdown-content pre code {
    background: none;
    padding: 0;
  }

  .message-content.markdown-content ol,
  .message-content.markdown-content ul {
    margin: 4px 0;
    padding-left: 20px;
  }

  .message-content.markdown-content li {
    margin: 2px 0;
  }

  .message-content.markdown-content p {
    margin: 4px 0;
  }
</style>
