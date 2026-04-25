<script>
  import { timerStore } from '../../../main/timerStore.js';
  import { Play, Pause, RotateCcw } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let settingsLoaded = false;
  let isDragging = false;
  let posY = 90;
  let offsetY = 0;

  function clampY() {
    const padding = 10;
    const el = document.querySelector('.floating-timer');
    const height = el?.offsetHeight || 122;

    posY = Math.max(padding, Math.min(posY, window.innerHeight - height - padding));
  }

  onMount(async () => {
    try {
      const settings = await window.api.loadTimerSettings();

      timerStore.setTimerValue(settings.timer_value);
      timerStore.setPomodoroSettings(settings.pomodoro_work, settings.pomodoro_break);

      posY = settings.pos_y ?? 90;
    } catch {
      posY = 90;
    }

    settingsLoaded = true;
    clampY();

    window.addEventListener('resize', clampY);
    return () => window.removeEventListener('resize', clampY);
  });

  function handleMouseDown(e) {
    if (e.target.closest('button')) return;

    isDragging = true;
    offsetY = e.clientY - posY;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e) {
    if (!isDragging) return;

    const el = document.querySelector('.floating-timer');
    const height = el?.offsetHeight || 122;

    posY = e.clientY - offsetY;
    posY = Math.max(10, Math.min(posY, window.innerHeight - height - 10));
  }

  async function handleMouseUp() {
    isDragging = false;

    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);

    await window.api.saveTimerSettings({ pos_y: posY });
  }

  $: displaySeconds = timerStore.getDisplaySeconds($timerStore);
  $: displayTime = timerStore.formatTime(displaySeconds);
  $: timerTitle = timerStore.getFloatingTitle($timerStore);
</script>

{#if settingsLoaded}
<div
  class:small-window={window.innerWidth <= 900}
  class="floating-timer"
  on:mousedown={handleMouseDown}
  style="top: {posY}px; right: 10px; cursor: {isDragging ? 'grabbing' : 'grab'};"
>
  <div class="session-label">{timerTitle}</div>

  <div class="time-text">{displayTime}</div>

  <div class="action-row">
    <button class="mini-btn" on:click={timerStore.toggleStartPause}>
      {#if $timerStore.isRunning}
        <Pause size={22} />
      {:else}
        <Play size={22} />
      {/if}
    </button>

    <button class="mini-btn" on:click={timerStore.reset}>
      <RotateCcw size={22} />
    </button>
  </div>
</div>
{/if}

<style>
.floating-timer {
  position: fixed;
  width: min(280px, calc(100vw - 20px));
  min-height: 88px;
  padding: 18px 16px;
  border: 1px solid #2c2c2c;
  background: #fdfbcb;
  box-sizing: border-box;
  z-index: 1000;
  transition: all 0.2s ease;
}

.session-label {
  display: block;
  text-align: center;
  font-size: 16px;
  margin-bottom: 8px;
}

.time-text {
  text-align: center;
  font-size: clamp(30px, 9vw, 50px);
  font-weight: 800;
  white-space: nowrap;
  line-height: 1;
}

/* Buttons hidden by default */
.action-row {
  margin-top: 18px;
  display: none;
  justify-content: center;
  gap: 8px;
}

/* Show buttons only on hover */
.floating-timer:hover .action-row {
  display: flex;
}

.mini-btn {
  width: 90px;
  height: 44px;
  border: 1px solid #2c2c2c;
  border-radius: 999px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.mini-btn:hover {
  background: #fbe893;
}

/* Manual minimized */
.floating-timer.minimized {
  width: 180px;
  min-height: 58px;
  padding: 12px 14px;
}

.floating-timer.minimized .session-label {
  display: none;
}

.floating-timer.minimized .time-text {
  font-size: 34px;
}

.floating-timer.minimized:hover {
  width: min(260px, calc(100vw - 20px));
  min-height: 112px;
  padding: 14px;
}

.floating-timer.minimized:hover .session-label {
  display: block;
  font-size: 14px;
  margin-bottom: 6px;
}

/* Small window */
@media (max-width: 1100px) {
  .floating-timer {
    width: 170px;
    min-height: 58px;
    padding: 10px 12px;
  }

  .floating-timer .session-label {
    display: none;
  }

  .floating-timer .time-text {
    font-size: 32px;
  }

  .floating-timer:hover {
    width: min(240px, calc(100vw - 20px));
    min-height: 108px;
    padding: 14px;
  }

  .floating-timer:hover .session-label {
    display: block;
    font-size: 14px;
    margin-bottom: 6px;
  }
}

/* Very small window */
@media (max-width: 700px) {
  .floating-timer {
    width: 130px;
    min-height: 44px;
    padding: 8px 10px;
  }

  .floating-timer .session-label {
    display: none;
  }

  .floating-timer .time-text {
    font-size: 24px;
  }

  .floating-timer:hover {
    width: min(210px, calc(100vw - 20px));
    min-height: 96px;
    padding: 12px;
  }

  .floating-timer:hover .session-label {
    display: none;
  }

  .mini-btn {
    width: 78px;
    height: 38px;
  }
}
</style>