<script>
  import { timerStore } from '../../../main/timerStore.js'
  import { Play, Pause, RotateCcw } from 'lucide-svelte'
  import { onMount } from 'svelte'

  let settingsLoaded = false
  let isDragging = false
  let posY = 90
  let offsetY = 0

  function clampY() {
    const padding = 10
    const el = document.querySelector('.floating-timer')
    const height = el?.offsetHeight || 122

    posY = Math.max(padding, Math.min(posY, window.innerHeight - height - padding))
  }

  onMount(async () => {
    try {
      const settings = await window.api.loadTimerSettings()

      timerStore.setTimerValue(settings.timer_value)
      timerStore.setPomodoroSettings(settings.pomodoro_work, settings.pomodoro_break)

      posY = settings.pos_y ?? 90
    } catch {
      posY = 90
    }

    settingsLoaded = true
    clampY()

    window.addEventListener('resize', clampY)
    return () => window.removeEventListener('resize', clampY)
  })

  function handleMouseDown(e) {
    if (e.target.closest('button')) return

    isDragging = true
    offsetY = e.clientY - posY

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  function handleMouseMove(e) {
    if (!isDragging) return

    const el = document.querySelector('.floating-timer')
    const height = el?.offsetHeight || 122

    posY = e.clientY - offsetY
    posY = Math.max(10, Math.min(posY, window.innerHeight - height - 10))
  }

  async function handleMouseUp() {
    isDragging = false

    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)

    await window.api.saveTimerSettings({ pos_y: posY })
  }

  $: displaySeconds = timerStore.getDisplaySeconds($timerStore)
  $: displayTime = timerStore.formatTime(displaySeconds)
  $: timerTitle = timerStore.getFloatingTitle($timerStore)
</script>

{#if settingsLoaded}
<div
  class="floating-timer"
  class:dragging={isDragging}
  class:small-window={window.innerWidth <= 900}
  on:mousedown={handleMouseDown}
  style="top: {posY}px; right: 10px; cursor: {isDragging ? 'grabbing' : 'grab'};"
>
  <div class="session-label">{timerTitle}</div>

  <div class="time-text">{displayTime}</div>

  <div class="action-row">
    <button class="mini-btn" on:click={() => {
      if (!$timerStore.isRunning && $timerStore.timerTimeLeft == 0 && $timerStore.mode == 'timer') {
        timerStore.reset()
        timerStore.toggleStartPause()
      } else {
        timerStore.toggleStartPause()
      }
    }}>
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
  width: 280px;
  min-height: 88px;
  padding: 18px 16px;
  border: 1px solid #2c2c2c;
  background: #fdfbcb;
  box-sizing: border-box;
  z-index: 1000;
  transition: all 0.2s ease;

  user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
}

.session-label {
  text-align: center;
  font-size: 16px;
  margin-bottom: 8px;
}

.time-text {
  text-align: center;
  font-size: 50px;
  font-weight: 800;
  white-space: nowrap;
  line-height: 1;
}

/* Hidden by default */
.action-row {
  margin-top: 12px;
  display: none;
  justify-content: center;
  gap: 8px;
}

/* Show only when NOT dragging */
.floating-timer:not(.dragging):hover .action-row {
  display: flex;
}

/* Force hide while dragging */
.floating-timer.dragging .action-row {
  display: none !important;
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

/* Medium */
@media (max-width: 1500px) {
  .floating-timer {
    width: 230px;
    min-height: 76px;
    padding: 14px 12px;
  }

  .session-label {
    font-size: 14px;
    margin-bottom: 6px;
  }

  .time-text {
    font-size: 38px;
  }

  .mini-btn {
    width: 78px;
    height: 38px;
  }
}

/* Small */
@media (max-width: 1350px) {
  .floating-timer {
    width: 170px;
    min-height: 58px;
    padding: 10px 12px;
  }

  .session-label {
    display: none;
  }

  .time-text {
    font-size: 32px;
  }

  .mini-btn {
    width: 70px;
    height: 34px;
  }
}

/* Very small */
@media (max-width: 700px) {
  .floating-timer {
    width: 130px;
    min-height: 44px;
    padding: 8px 10px;
  }

  .session-label {
    display: none;
  }

  .time-text {
    font-size: 24px;
  }

  .mini-btn {
    width: 60px;
    height: 32px;
  }
}
</style>