<script>
  import { timerStore } from '../../../main/timerStore.js';
  import { Play, Pause, RotateCcw, Plus, Minus } from 'lucide-svelte';

  $: displaySeconds = timerStore.getDisplaySeconds($timerStore);
  $: displayTime = timerStore.formatTime(displaySeconds);
  $: timerTitle = timerStore.getFloatingTitle($timerStore);
</script>

<div class:minimized={$timerStore.minimized} class="floating-timer">
  <button class="corner-btn" onclick={timerStore.toggleMinimized}>
    {#if $timerStore.minimized}
      <Plus size={18} />
    {:else}
      <Minus size={18} />
    {/if}
  </button>

  <div class="session-label">{timerTitle}</div>
  <div class="time-text">{displayTime}</div>

  {#if !$timerStore.minimized}
    <div class="action-row">
      <button class="mini-btn" onclick={timerStore.toggleStartPause}>
        {#if $timerStore.isRunning}
          <Pause size={22} />
        {:else}
          <Play size={22} />
        {/if}
      </button>

      <button class="mini-btn" onclick={timerStore.reset}>
        <RotateCcw size={22} />
      </button>
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
    background: #fdfbcb;
    box-sizing: border-box;
    z-index: 1000;
  }

  .floating-timer.minimized {
    min-height: 122px;
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
    line-height: 1;
    background: none;
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
    margin: 0;
    padding-right: 20px;
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

  .mini-btn:hover {
    background: #fbe893;
  }

  @media (max-width: 900px) {
    .floating-timer {
      width: 220px;
      min-height: 88px;
      padding: 12px 14px;
      top: 96px;
      right: 12px;
    }

    .floating-timer.minimized {
      min-height: 88px;
    }

    .corner-btn {
      top: 8px;
      right: 10px;
      font-size: 18px;
    }

    .session-label {
      font-size: 13px;
      margin-bottom: 6px;
    }

    .time-text {
      font-size: 36px;
      padding-right: 16px;
    }

    .action-row {
      margin-top: 12px;
      gap: 8px;
    }

    .mini-btn {
      width: 84px;
      height: 34px;
      font-size: 12px;
    }
  }

  @media (max-width: 1400px) {
    .floating-timer {
      width: 170px;
      min-height: 58px;
      padding: 10px 12px;
    }

    .floating-timer.minimized {
      min-height: 58px;
    }

    .session-label,
    .action-row,
    .corner-btn {
      display: none;
    }

    .time-text {
      font-size: 28px;
      text-align: center;
      padding-right: 0;
      width: 100%;
    }
  }
</style>