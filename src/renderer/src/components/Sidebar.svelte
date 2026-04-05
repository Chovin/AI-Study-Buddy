<script>
  import { Home, ListCheck, MessageSquare, Clock3,  SwatchBook, PanelLeftClose, PanelLeftOpen } from 'lucide-svelte'

  export let collapsed = false
  export let active = 'topics'

  const items = [
  { id: 'topics', label: 'Topics', icon: Home },
  { id: 'quiz', label: 'Quiz', icon: ListCheck },
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
    position: fixed;
    top: 0;
    left: 0;
    right: auto;
    bottom: auto;
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