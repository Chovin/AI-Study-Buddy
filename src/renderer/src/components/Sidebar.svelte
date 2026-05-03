<script>
  import {
    Folder,
    ListCheck,
    MessageSquare,
    Clock3,
    SwatchBook,
    NotepadText,
    PanelLeftClose,
    PanelLeftOpen
  } from 'lucide-svelte'

  export let collapsed = false
  export let active = 'topics'
  export let disabledTabs = []

  const items = [
    { id: 'topics', label: 'Topics', icon: Folder },
    { id: 'quiz', label: 'Quiz', icon: ListCheck },
    { id: 'flashcards', label: 'Flashcards', icon: SwatchBook },
    { id: 'summary', label: 'Summary', icon: NotepadText },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'timer', label: 'Timer', icon: Clock3 }
  ]

  // Keep Topics active if something disabled becomes active
  $: if (disabledTabs.includes(active)) {
    active = 'topics'
  }

  function toggleSidebar() {
    collapsed = !collapsed
  }

  function isDisabled(tabId) {
    return disabledTabs.includes(tabId)
  }

  function setActive(tabId) {
    if (isDisabled(tabId)) return
    active = tabId
  }
</script>

<aside class="sidebar" class:collapsed={collapsed}>
  <div class="sidebar-top">
    <button
      class="toggle-btn"
      on:click={toggleSidebar}
      aria-label="Toggle sidebar"
    >
      {#if collapsed}
        <PanelLeftOpen size={20} />
      {:else}
        <PanelLeftClose size={20} />
      {/if}
    </button>
  </div>

  <nav class="nav">
    {#each items as item}
      <button
        type="button"
        class="nav-item"
        class:disabled={isDisabled(item.id)}
        class:selected-topics={active === item.id && item.id === 'topics'}
        class:selected-quiz={active === item.id && item.id === 'quiz'}
        class:selected-flashcards={active === item.id && item.id === 'flashcards'}
        class:selected-summary={active === item.id && item.id === 'summary'}
        class:selected-chat={active === item.id && item.id === 'chat'}
        class:selected-timer={active === item.id && item.id === 'timer'}
        disabled={isDisabled(item.id)}
        on:click={() => setActive(item.id)}
        title={collapsed ? item.label : ''}
      >
        <svelte:component this={item.icon} size={20} />

        {#if !collapsed}
          <span>{item.label}</span>
        {/if}
      </button>
    {/each}
  </nav>
</aside>

<style>
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    box-sizing: border-box;
    width: 220px;
    max-width: 220px;
    min-width: 220px;
    height: 100vh;
    background: #fff;
    border-right: 2px solid #dc5f5a;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: width 0.25s ease, min-width 0.25s ease, max-width 0.25s ease;
  }

  .sidebar.collapsed {
    width: 72px;
    max-width: 72px;
    min-width: 72px;
  }

  .sidebar-top {
    display: flex;
    justify-content: flex-end;
    padding: 12px 8px 6px;
    box-sizing: border-box;
  }

  .sidebar.collapsed .sidebar-top {
    justify-content: center;
    padding: 12px 0 6px;
  }

  .toggle-btn {
    width: 44px;
    height: 44px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 44px;
  }

  .toggle-btn:hover {
    background: #ececec;
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 25px 8px 12px;
    box-sizing: border-box;
    width: 100%;
  }

  .nav-item {
    width: 100%;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    text-align: left;
    box-sizing: border-box;
    text-transform: none;
    letter-spacing: normal;
    transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease;
  }

  .nav-item:hover {
    background: #ececec;
    color: black;
  }

  .nav-item.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nav-item.disabled:hover {
    background: transparent;
  }

  .selected-topics {
    background: #ec5f54 !important;
    color: white !important;
    font-weight: 600;
  }

  .selected-topics:hover {
    background: #ef7e76 !important;
    color: white !important;
  }

  .selected-quiz {
    background: #ef8c4a !important;
    color: white !important;
    font-weight: 600;
  }

  .selected-quiz:hover {
    background: #f2a36e !important;
    color: white !important;
  }

  .selected-flashcards {
    background: #f9df6f !important;
    color: #222 !important;
    font-weight: 600;
  }

  .selected-flashcards:hover {
    background: #fae58b !important;
  }

  .selected-summary {
    background: #5cb35a !important;
    color: white !important;
    font-weight: 600;
  }

  .selected-summary:hover {
    background: #7cc27a !important;
    color: white !important;
  }

  .selected-chat {
    background: #63b1f5 !important;
    color: white !important;
    font-weight: 600;
  }

  .selected-chat:hover {
    background: #82c0f7 !important;
    color: white !important;
  }

  .selected-timer {
    background: #d198f7 !important;
    color: white !important;
    font-weight: 600;
  }

  .selected-timer:hover {
    background: #daacf8 !important;
    color: white !important;
  }

  .sidebar.collapsed .nav-item {
    justify-content: center;
    padding: 12px 0;
  }
</style>