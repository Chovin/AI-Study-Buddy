<div class="button-wrapper">
  {#if type=="raised"}
    <Button
      variant="raised"
      class={`content-button raised active ${animate ? 'animate' : ''} ${hasBadge ? 'notify' : ''} ${className ?? ''}`}
      style={variantStyles}
      onclick={onClick}
      disabled={disabled}
    >
      <span class="content-icon">
        <svelte:component this={dIcon} size={20} />
      </span>
      <span>{dLabel}</span>
      
      {#if hasBadge}
        <span class="notification-badge"></span>
      {/if}
    </Button>
  {:else}
    <button
      type="button"
      class={`content-button depressed ${className ?? ''} `}
      class:active={active}
      class:collapsed={collapsed}
      class:disabled={disabled}
      class:nofity={hasBadge}
      class:animate={animate}
      disabled={disabled}
      style={variantStyles}
      on:click={onClick}
      title={collapsed ? (dLabel) : ''}
    >
      <svelte:component this={dIcon} size={20} />

      {#if !collapsed}
        <span>{dLabel}</span>
      {/if}

      {#if hasBadge}
        <span class="notification-badge"></span>
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
    hasBadge = false
  } = $props()

  let animate = $state(false)

  const variants = {
    'topics':     { label: 'Topics',     background: '#ec5f54', hover: '#ef7e76', color: 'white', icon: Folder },
    'quiz':       { label: 'Quiz',       background: '#ef8c4a', hover: '#f2a36e', color: 'white', icon: ListCheck },
    'flashcards': { label: 'Flashcards', background: '#f9df6f', hover: '#fae58b', color: '#222',  icon: SwatchBook },
    'summary':    { label: 'Summary',    background: '#5cb35a', hover: '#7cc27a', color: 'white', icon: NotepadText },
    'chat':       { label: 'Chat',       background: '#63b1f5', hover: '#82c0f7', color: 'white', icon: MessageSquare },
    'timer':      { label: 'Timer',      background: '#d198f7', hover: '#daacf8', color: 'white', icon: Clock3 }
  }

  const variantSettings = $derived(variants[variant])
  const variantStyles = $derived(`--bg: ${variantSettings.background}; --hover-bg: ${variantSettings.hover}; --color: ${variantSettings.color}; ` + (active ? `color: ${variantSettings.color};` : ''))
  const dLabel = $derived(label || variantSettings.label)
  const dIcon = $derived(icon || variantSettings.icon)

  $effect(() => {
    if (hasBadge) {
      animate = true

      const timeout = setTimeout(() => {
        animate = false
      }, 1500)

      return () => clearTimeout(timeout)
    }
  })
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

  .button-wrapper {
    position: relative;
  }

  .notification-badge {
    position: absolute;
    top: 6px;
    right: 8px;

    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ff3b30;

    box-shadow: 0 0 0 2px white;
  }

  .content-button {
    transition: background 0.3s ease, transform 0.2s ease;
    transform-origin: center;
  }

  .animate {
    animation: wiggle 0.5s ease-in-out, bgFlash 1s ease-in-out;
  }

  @keyframes wiggle {
    0%   { transform: rotate( 0deg); }
    20%  { transform: rotate(-6deg); }
    40%  { transform: rotate( 6deg); }
    60%  { transform: rotate(-4deg); }
    80%  { transform: rotate( 4deg); }
    100% { transform: rotate( 0deg); }
  }

  @keyframes bgFlash {
    0% { background: initial; }
    50% { background: var(--bg); }
    100% { background: initial; }
  }
</style>