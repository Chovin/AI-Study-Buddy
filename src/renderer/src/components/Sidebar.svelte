<script>
  import {
    PanelLeftClose,
    PanelLeftOpen
  } from 'lucide-svelte'
  import AppButton from './AppButton.svelte';

  let {
    collapsed = $bindable(false),
    active = $bindable('topics'),
    disabledTabs = [],
  } = $props()

  const items = [
    'topics', 'quiz', 'flashcards', 'summary', 'chat', 'timer'
  ]

  // Keep Topics active if something disabled becomes active
  $effect(() => {
    if (disabledTabs.includes(active)) {
      active = 'topics'
    }
  })

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
    {#each items as item (item)}
      <AppButton
        variant={item}
        onClick={() => setActive(item)}
        collapsed={collapsed}
        active={active == item}
        disabled={isDisabled(item)}
      ></AppButton>
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

</style>