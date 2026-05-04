<div>
  {#if type=="raised"}
    <Button
      variant="raised"
      class={`content-button raised active ${className ?? ''}`}
      style={variantStyles}
      onclick={onClick}
      disabled={disabled}
    >
      <span class="content-icon">
        <svelte:component this={dIcon} size={20} />
      </span>
      <span>{dLabel}</span>
    </Button>
  {:else}
    <button
      type="button"
      class={`content-button depressed ${className ?? ''} `}
      class:active={active}
      class:collapsed={collapsed}
      class:disabled={disabled}
      disabled={disabled}
      style={active ? variantStyles : ''}
      on:click={onClick}
      title={collapsed ? (dLabel) : ''}
    >
      <svelte:component this={dIcon} size={20} />

      {#if !collapsed}
        <span>{dLabel}</span>
      {/if}
    </button>
  {/if}
</div>

<script>
  import {
    Folder,
    ListCheck,
    MessageSquare,
    Clock3,
    SwatchBook,
    NotepadText,
  } from 'lucide-svelte'
  import Button from '@smui/button'

  let {
    active = true,
    disabled = false,
    variant,
    type = 'depressed',
    collapsed = false,
    label,
    icon,
    onClick,
    className,
  } = $props()

  const variants = {
    'topics':     { label: 'Topics',     background: '#ec5f54', hover: '#ef7e76', color: 'white', icon: Folder },
    'quiz':       { label: 'Quiz',       background: '#ef8c4a', hover: '#f2a36e', color: 'white', icon: ListCheck },
    'flashcards': { label: 'Flashcards', background: '#f9df6f', hover: '#fae58b', color: '#222',  icon: SwatchBook },
    'summary':    { label: 'Summary',    background: '#5cb35a', hover: '#7cc27a', color: 'white', icon: NotepadText },
    'chat':       { label: 'Chat',       background: '#63b1f5', hover: '#82c0f7', color: 'white', icon: MessageSquare },
    'timer':      { label: 'Timer',      background: '#d198f7', hover: '#daacf8', color: 'white', icon: Clock3 }
  }

  const variantSettings = $derived(variants[variant])
  const variantStyles = `--bg: ${variantSettings.background}; --hover-bg: ${variantSettings.hover}; color: ${variantSettings.color}; --color: ${variantSettings.color}`
  const dLabel = $derived(label || variantSettings.label)
  const dIcon = $derived(icon || variantSettings.icon)
</script>

<style>
  .content-button,
  :global(.content-button.raised) {
    height: 100% !important;
    width: 100%;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px !important;
    border-radius: 10px !important;
    cursor: pointer;
    font-size: 14px !important;
    text-align: left;
    box-sizing: border-box;
    text-transform: none !important;
    letter-spacing: normal !important;
    transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease;
  }

  .content-button.active,
  :global(.content-button.raised.active) {
    background: var(--bg);
  }

  .content-button.depressed {
    color: black;
  }

  .content-button.active.depressed:hover {
    background: var(--hover-bg);
    color: var(--color);
  }

  .content-button:hover {
    background: #ececec;
    color: black;
  }

  .content-button.active,
  :global(.content-button.raised span) {
    font-weight: 600 !important;
  }

  .content-button.active svg {
    stroke: currentColor;
  }

  .content-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .content-button.disabled:hover {
    background: transparent;
  }

  .content-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .content-button.disabled:hover {
    background: transparent;
  }

  .content-button.collapsed {
    justify-content: center;
    padding: 12px 0;
  }
</style>