<script>
  import { timerStore } from '../../../main/timerStore.js';
  import { Play, Pause, RotateCcw, ChevronUp, ChevronDown } from 'lucide-svelte';

  let editHours = '00';
  let editMinutes = '25';
  let editSeconds = '00';

  function wrap(value, min, max) {
    if (value > max) return min;
    if (value < min) return max;
    return value;
  }

  function syncInputsFromTimer() {
    const total = $timerStore?.timerValue ?? 0;
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    editHours = String(hours).padStart(2, '0');
    editMinutes = String(minutes).padStart(2, '0');
    editSeconds = String(seconds).padStart(2, '0');
  }

  function applyInputsToTimer() {
    const hours = Math.max(0, Math.min(99, Number(editHours) || 0));
    const minutes = Math.max(0, Math.min(59, Number(editMinutes) || 0));
    const seconds = Math.max(0, Math.min(59, Number(editSeconds) || 0));

    timerStore.setTimerValue(hours * 3600 + minutes * 60 + seconds);
    syncInputsFromTimer();
  }

  function handleTypedInput(part, event) {
    let value = event.currentTarget.value.replace(/\D/g, '').slice(0, 2);

    if (part === 'hours') editHours = value;
    if (part === 'minutes') editMinutes = value;
    if (part === 'seconds') editSeconds = value;
  }

  function commitTypedInput() {
    if ($timerStore.mode !== 'timer' || $timerStore.isRunning) return;
    applyInputsToTimer();
  }

  function handleInputKeydown(event) {
    if (event.key === 'Enter') {
      commitTypedInput();
      event.currentTarget.blur();
    }
  }

  function adjustHours(amount) {
    if ($timerStore.mode !== 'timer' || $timerStore.isRunning) return;

    const total = $timerStore.timerValue ?? 0;
    let hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    hours = wrap(hours + amount, 0, 99);
    timerStore.setTimerValue(hours * 3600 + minutes * 60 + seconds);
    syncInputsFromTimer();
  }

  function adjustMinutes(amount) {
    if ($timerStore.mode !== 'timer' || $timerStore.isRunning) return;

    const total = $timerStore.timerValue ?? 0;
    const hours = Math.floor(total / 3600);
    let minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    minutes = wrap(minutes + amount, 0, 59);
    timerStore.setTimerValue(hours * 3600 + minutes * 60 + seconds);
    syncInputsFromTimer();
  }

  function adjustSeconds(amount) {
    if ($timerStore.mode !== 'timer' || $timerStore.isRunning) return;

    const total = $timerStore.timerValue ?? 0;
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    let seconds = total % 60;

    seconds = wrap(seconds + amount, 0, 59);
    timerStore.setTimerValue(hours * 3600 + minutes * 60 + seconds);
    syncInputsFromTimer();
  }

  $: displaySeconds = timerStore.getDisplaySeconds($timerStore);
  $: displayTime = timerStore.formatTime(displaySeconds);
  $: timeParts = displayTime.split(':');
  $: timerTitle = timerStore.getFloatingTitle($timerStore);

  $: if ($timerStore.mode === 'timer' && !$timerStore.isRunning) {
    syncInputsFromTimer();
  }

  // Save timer settings when they change
  $: if ($timerStore) {
    window.api.saveTimerSettings(
      $timerStore.timerValue,
      $timerStore.pomodoroWork,
      $timerStore.pomodoroBreak
    ).catch(err => console.error('Failed to save timer settings:', err));
  }
</script>

<div class="timer-shell">
  <div class="timer-tabs">
    <button class:active={$timerStore.mode === 'timer'} onclick={() => timerStore.setMode('timer')}>
      Timer
    </button>
    <button class:active={$timerStore.mode === 'pomodoro'} onclick={() => timerStore.setMode('pomodoro')}>
      Pomodoro
    </button>
    <button class:active={$timerStore.mode === 'stopwatch'} onclick={() => timerStore.setMode('stopwatch')}>
      Stopwatch
    </button>
  </div>

  <div class="timer-label">{timerTitle}</div>

  <div class="time-editor">
    <div class="time-group">
      <button class="arrow-btn" onclick={() => adjustHours(1)} disabled={$timerStore.mode !== 'timer' || $timerStore.isRunning}>
        <ChevronUp size={26} />
      </button>

      {#if $timerStore.mode === 'timer' && !$timerStore.isRunning}
        <input
          class="time-input"
          type="text"
          inputmode="numeric"
          maxlength="2"
          bind:value={editHours}
          oninput={(e) => handleTypedInput('hours', e)}
          onblur={commitTypedInput}
          onkeydown={handleInputKeydown}
        />
      {:else}
        <div class="time-display">{timeParts[0]}</div>
      {/if}

      <button class="arrow-btn" onclick={() => adjustHours(-1)} disabled={$timerStore.mode !== 'timer' || $timerStore.isRunning}>
        <ChevronDown size={26} />
      </button>
    </div>

    <div class="colon">:</div>

    <div class="time-group">
      <button class="arrow-btn" onclick={() => adjustMinutes(1)} disabled={$timerStore.mode !== 'timer' || $timerStore.isRunning}>
        <ChevronUp size={26} />
      </button>

      {#if $timerStore.mode === 'timer' && !$timerStore.isRunning}
        <input
          class="time-input"
          type="text"
          inputmode="numeric"
          maxlength="2"
          bind:value={editMinutes}
          oninput={(e) => handleTypedInput('minutes', e)}
          onblur={commitTypedInput}
          onkeydown={handleInputKeydown}
        />
      {:else}
        <div class="time-display">{timeParts[1]}</div>
      {/if}

      <button class="arrow-btn" onclick={() => adjustMinutes(-1)} disabled={$timerStore.mode !== 'timer' || $timerStore.isRunning}>
        <ChevronDown size={26} />
      </button>
    </div>

    <div class="colon">:</div>

    <div class="time-group">
      <button class="arrow-btn" onclick={() => adjustSeconds(1)} disabled={$timerStore.mode !== 'timer' || $timerStore.isRunning}>
        <ChevronUp size={26} />
      </button>

      {#if $timerStore.mode === 'timer' && !$timerStore.isRunning}
        <input
          class="time-input"
          type="text"
          inputmode="numeric"
          maxlength="2"
          bind:value={editSeconds}
          oninput={(e) => handleTypedInput('seconds', e)}
          onblur={commitTypedInput}
          onkeydown={handleInputKeydown}
        />
      {:else}
        <div class="time-display">{timeParts[2]}</div>
      {/if}

      <button class="arrow-btn" onclick={() => adjustSeconds(-1)} disabled={$timerStore.mode !== 'timer' || $timerStore.isRunning}>
        <ChevronDown size={26} />
      </button>
    </div>
  </div>

  <div class="timer-actions">
    <button class="action-btn" onclick={timerStore.toggleStartPause}>
      {#if $timerStore.isRunning}
        <Pause size={24} />
      {:else}
        <Play size={24} />
      {/if}
    </button>

    <button class="action-btn" onclick={timerStore.reset}>
      <RotateCcw size={24} />
    </button>
  </div>
</div>

<style>
  .timer-shell {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .timer-tabs {
    display: flex;
    justify-content: center;
    gap: 18px;
    border: 2px solid #2c2c2c;
    border-radius: 999px;
    padding: 4px;
    width: min(100%, 520px);
    box-sizing: border-box;
  }

  .timer-tabs button {
    flex: 1;
    height: 46px;
    border: none;
    border-radius: 999px;
    background: transparent;
    font-size: 16px;
    cursor: pointer;
  }

  .timer-tabs button.active {
    border: 2px solid #2c2c2c;
    background: #f6f6f6;
  }

  .timer-label {
    margin-top: 44px;
    font-size: 18px;
  }

  .time-editor {
    margin-top: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    flex-wrap: nowrap;
  }

  .time-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 120px;
  }

  .time-input,
  .time-display {
    width: 2.2ch;
    min-width: 2ch;
    border: none;
    background: transparent;
    outline: none;
    padding: 0;
    margin: 0;
    font-family: inherit;
    font-size: clamp(62px, 10vw, 118px);
    font-weight: 800;
    line-height: 1;
    text-align: center;
    color: inherit;
  }

  .time-input::selection {
    background: transparent;
  }

  .colon {
    font-size: clamp(62px, 10vw, 118px);
    font-weight: 800;
    line-height: 1;
  }

  .arrow-btn {
    width: 42px;
    height: 42px;
    padding: 0;
    margin: 0;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .arrow-btn :global(svg) {
    display: block;
  }

  .arrow-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .timer-actions {
    margin-top: 52px;
    display: flex;
    gap: 46px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .action-btn {
    width: 210px;
    height: 56px;
    border: 2px solid #2c2c2c;
    border-radius: 999px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>