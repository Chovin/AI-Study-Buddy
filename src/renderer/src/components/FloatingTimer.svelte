<script>
  import { timerStore } from '../../../main/timerStore.js';
  import { Play, Pause, RotateCcw, Plus, Minus } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let settingsLoaded = false;
  let isDragging = false;
  let pos = { x: 0, y: 0 }; 
  let offset = { x: 0, y: 0 }; 

  onMount(async () => {
    try {
      const settings = await window.api.loadTimerSettings();
      timerStore.setTimerValue(settings.timer_value);
      timerStore.setPomodoroSettings(settings.pomodoro_work, settings.pomodoro_break);
      
      // Load saved position or use default
      pos = { 
        x: settings.pos_x ?? (window.innerWidth - 312), 
        y: settings.pos_y ?? 110 
      };
      
      settingsLoaded = true;
    } catch (err) {
      console.error('Failed to load timer settings:', err);
      pos = { x: window.innerWidth - 312, y: 110 };
      settingsLoaded = true;
    }

    window.addEventListener('resize', () => {
      const padding = 10;
      const timerElement = document.querySelector('.floating-timer');
      const width = timerElement?.offsetWidth || 294;
      const height = timerElement?.offsetHeight || 122;
      
      // Snap back into safe zone if window shrinks
      pos.x = Math.max(padding, Math.min(pos.x, window.innerWidth - width - padding));
      pos.y = Math.max(padding, Math.min(pos.y, window.innerHeight - height - padding));
  });

  });

  function handleMouseDown(e) {
    if (e.target.closest('button')) return;
    isDragging = true;
    offset.x = e.clientX - pos.x;
    offset.y = e.clientY - pos.y;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e) {
    if (!isDragging) return;

    const padding = 10; // Space between timer and window edge
    let newX = e.clientX - offset.x;
    let newY = e.clientY - offset.y;

    const timerElement = document.querySelector('.floating-timer');
    const width = timerElement?.offsetWidth || 294;
    const height = timerElement?.offsetHeight || 122;

    // Boundaries with padding
    const minX = padding;
    const maxX = window.innerWidth - width - padding;
    const minY = padding;
    const maxY = window.innerHeight - height - padding;

    // Apply constraints with padding
    pos.x = Math.max(minX, Math.min(newX, maxX));
    pos.y = Math.max(minY, Math.min(newY, maxY));
  }

  async function handleMouseUp() {
    isDragging = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);

    // Save the new position to your settings file
    try {
      await window.api.saveTimerSettings({ pos_x: pos.x, pos_y: pos.y });
    } catch (err) {
      console.error('Failed to save position:', err);
    }
  }

  $: displaySeconds = timerStore.getDisplaySeconds($timerStore);
  $: displayTime = timerStore.formatTime(displaySeconds);
  $: timerTitle = timerStore.getFloatingTitle($timerStore);
</script>

<div 
  class:minimized={$timerStore.minimized} 
  class="floating-timer"
  onmousedown={handleMouseDown}
  style="left: {pos.x}px; top: {pos.y}px; cursor: {isDragging ? 'grabbing' : 'grab'};"
>
  <!-- Rest of your HTML remains the same -->
  <button class="corner-btn" onclick={timerStore.toggleMinimized}>
    {#if $timerStore.minimized}<Plus size={18} />{:else}<Minus size={18} />{/if}
  </button>
  <div class="session-label">{timerTitle}</div>
  <div class="time-text">{displayTime}</div>
  {#if !$timerStore.minimized}
    <div class="action-row">
      <button class="mini-btn" onclick={timerStore.toggleStartPause}>
        {#if $timerStore.isRunning}<Pause size={22} />{:else}<Play size={22} />{/if}
      </button>
      <button class="mini-btn" onclick={timerStore.reset}><RotateCcw size={22} /></button>
    </div>
  {/if}
</div>


<style>
  .floating-timer {
    position: fixed;
    top: 110px;
    right: 18px;
    width: 294px;
    min-height: 122px;
    padding: 18px 20px;
    border: 1px solid #2c2c2c;
    border-radius: 0px;
    background: #fdfbcb;
    box-sizing: border-box;
    z-index: 1000;
  }

  .floating-timer.minimized {
    min-height: 110px;
  }

  .corner-btn {
    position: absolute;
    top: 10px;
    right: 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0;
    font-size: 22px;
    font-weight: 700;
  }

  .session-label {
    text-align: left;
    font-size: 16px;
    margin: 0 0 8px 0;
  }

  .time-text {
    text-align: center;
    font-size: 54px;
    font-weight: 800;
    line-height: 1;
  }

  .action-row {
    margin-top: 22px;
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .mini-btn {
    width: 114px;
    height: 44px;
    border: 1px solid #2c2c2c;
    border-radius: 999px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .mini-btn:hover{
    background: #fbe893;
  }
</style>