<script>
  import { Home, FileText, MessageSquare, Clock3,  SwatchBook, PanelLeftClose, PanelLeftOpen } from 'lucide-svelte'

  export let collapsed = false
  export let active = 'topics'

  const items = [
  { id: 'topics', label: 'Topics', icon: Home },
  { id: 'quiz', label: 'Quiz', icon: FileText },
  { id: 'flashcards', label: 'Flashcards', icon: SwatchBook },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'timer', label: 'Timer', icon: Clock3 }
]

  function toggleSidebar() {
    collapsed = !collapsed
  }
</script>
<aside class="sidebar" class:collapsed={collapsed}>
  <div class="sidebar-top">
    <button class="toggle-btn" on:click={toggleSidebar} aria-label="Toggle sidebar">
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
      class="nav-item"
      class:active={active === item.id}
      on:click={() => (active = item.id)}
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
    width: 220px;
    min-width: 220px;
    background: #f8f8f8;
    border-right: 1px solid #ddd;
    display: flex;
    flex-direction: column;
    transition: width 0.25s ease, min-width 0.25s ease;
    overflow: hidden;
  }

  .sidebar.collapsed {
    width: 72px;
    min-width: 72px;
  }

  .sidebar-top {
    display: flex;
    justify-content: flex-end;
    padding: 12px;
    border-bottom: 1px solid #ddd;
  }

  .toggle-btn {
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 8px;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-btn:hover {
    background: #eaeaea;
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 8px;
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
  }

  .nav-item:hover {
    background: #ececec;
  }

  .nav-item.active {
    background: #dfead5;
    font-weight: 600;
  }

  .sidebar.collapsed .nav-item {
    justify-content: center;
    padding: 12px 0;
  }
</style>