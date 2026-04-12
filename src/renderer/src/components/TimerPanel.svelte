<script>
  import { onDestroy } from 'svelte';
  import { Play, Pause, RotateCcw, ChevronUp, ChevronDown } from 'lucide-svelte';

  const timerSeconds = 25 * 60;
  const pomodoroWorkSeconds = 25 * 60;
  const pomodoroBreakSeconds = 5 * 60;

  let mode = 'timer';

  let isRunning = false;
  let intervalId = null;

  let timerValue = timerSeconds;
  let pomodoroTimeLeft = pomodoroWorkSeconds;
  let stopwatchSeconds = 0;
  let isBreak = false;

  let editHours = '00';
  let editMinutes = '25';
  let editSeconds = '00';

  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [
      String(hrs).padStart(2, '0'),
      String(mins).padStart(2, '0'),
      String(secs).padStart(2, '0')
    ].join(':');
  }

  function clearTimerInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function startTimer() {
    if (isRunning) return;

    isRunning = true;
    clearTimerInterval();

    intervalId = setInterval(() => {
      if (mode === 'stopwatch') {
        stopwatchSeconds += 1;
        return;
      }

      if (mode === 'timer') {
        if (timerValue > 0) {
          timerValue -= 1;
        } else {
          pauseTimer();
        }
        return;
      }

      if (pomodoroTimeLeft > 0) {
        pomodoroTimeLeft -= 1;
      } else if (isBreak) {
        isBreak = false;
        pomodoroTimeLeft = pomodoroWorkSeconds;
      } else {
        isBreak = true;
        pomodoroTimeLeft = pomodoroBreakSeconds;
      }
    }, 1000);
  }

  function pauseTimer() {
    isRunning = false;
    clearTimerInterval();
  }

  function toggleStartPause() {
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }

  function resetTimer() {
    pauseTimer();

    if (mode === 'stopwatch') {
      stopwatchSeconds = 0;
      return;
    }

    if (mode === 'timer') {
      timerValue = timerSeconds;
      syncInputsFromTimer();
      return;
    }

    isBreak = false;
    pomodoroTimeLeft = pomodoroWorkSeconds;
  }

  function setMode(nextMode) {
    pauseTimer();
    mode = nextMode;

    if (mode === 'stopwatch') {
      stopwatchSeconds = 0;
      return;
    }

    if (mode === 'timer') {
      timerValue = timerSeconds;
      syncInputsFromTimer();
      return;
    }

    isBreak = false;
    pomodoroTimeLeft = pomodoroWorkSeconds;
  }

  function wrap(value, min, max) {
    if (value > max) return min;
    if (value < min) return max;
    return value;
  }

  function syncInputsFromTimer() {
    const hours = Math.floor(timerValue / 3600);
    const minutes = Math.floor((timerValue % 3600) / 60);
    const seconds = timerValue % 60;

    editHours = String(hours).padStart(2, '0');
    editMinutes = String(minutes).padStart(2, '0');
    editSeconds = String(seconds).padStart(2, '0');
  }

  function applyInputsToTimer() {
    const hours = Math.max(0, Math.min(99, Number(editHours) || 0));
    const minutes = Math.max(0, Math.min(59, Number(editMinutes) || 0));
    const seconds = Math.max(0, Math.min(59, Number(editSeconds) || 0));

    timerValue = hours * 3600 + minutes * 60 + seconds;
    syncInputsFromTimer();
  }

  function handleTypedInput(part, event) {
    let value = event.currentTarget.value.replace(/\D/g, '');
    value = value.slice(0, 2);

    if (part === 'hours') editHours = value;
    if (part === 'minutes') editMinutes = value;
    if (part === 'seconds') editSeconds = value;
  }

  function commitTypedInput() {
    if (mode !== 'timer' || isRunning) return;
    applyInputsToTimer();
  }

  function handleInputKeydown(event) {
    if (event.key === 'Enter') {
      commitTypedInput();
      event.currentTarget.blur();
    }
  }

  function adjustHours(amount) {
    if (mode !== 'timer' || isRunning) return;

    let hours = Math.floor(timerValue / 3600);
    const minutes = Math.floor((timerValue % 3600) / 60);
    const seconds = timerValue % 60;

    hours = wrap(hours + amount, 0, 99);
    timerValue = hours * 3600 + minutes * 60 + seconds;
    syncInputsFromTimer();
  }

  function adjustMinutes(amount) {
    if (mode !== 'timer' || isRunning) return;

    const hours = Math.floor(timerValue / 3600);
    let minutes = Math.floor((timerValue % 3600) / 60);
    const seconds = timerValue % 60;

    minutes = wrap(minutes + amount, 0, 59);
    timerValue = hours * 3600 + minutes * 60 + seconds;
    syncInputsFromTimer();
  }

  function adjustSeconds(amount) {
    if (mode !== 'timer' || isRunning) return;

    const hours = Math.floor(timerValue / 3600);
    const minutes = Math.floor((timerValue % 3600) / 60);
    let seconds = timerValue % 60;

    seconds = wrap(seconds + amount, 0, 59);
    timerValue = hours * 3600 + minutes * 60 + seconds;
    syncInputsFromTimer();
  }

  $: displaySeconds =
    mode === 'stopwatch'
      ? stopwatchSeconds
      : mode === 'pomodoro'
        ? pomodoroTimeLeft
        : timerValue;

  $: modeLabel =
    mode === 'stopwatch'
      ? 'Stopwatch'
      : mode === 'pomodoro'
        ? (isBreak ? 'Break Time' : 'Pomodoro')
        : 'Timer';

  $: timeParts = formatTime(displaySeconds).split(':');

  $: if (mode === 'timer' && !isRunning) {
    syncInputsFromTimer();
  }

  onDestroy(() => {
    clearTimerInterval();
  });
</script>

<div class="timer-shell">
  <div class="timer-tabs">
    <button class:active={mode === 'timer'} onclick={() => setMode('timer')}>
      Timer
    </button>
    <button class:active={mode === 'pomodoro'} onclick={() => setMode('pomodoro')}>
      Pomodoro
    </button>
    <button class:active={mode === 'stopwatch'} onclick={() => setMode('stopwatch')}>
      Stopwatch
    </button>
  </div>

  <div class="timer-label">{modeLabel}</div>

  <div class="time-editor">
    <div class="time-group">
      <button
        class="arrow-btn"
        onclick={() => adjustHours(1)}
        disabled={mode !== 'timer' || isRunning}
      >
        <ChevronUp size={26} />
      </button>

      {#if mode === 'timer' && !isRunning}
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

      <button
        class="arrow-btn"
        onclick={() => adjustHours(-1)}
        disabled={mode !== 'timer' || isRunning}
      >
        <ChevronDown size={26} />
      </button>
    </div>

    <div class="colon">:</div>

    <div class="time-group">
      <button
        class="arrow-btn"
        onclick={() => adjustMinutes(1)}
        disabled={mode !== 'timer' || isRunning}
      >
        <ChevronUp size={26} />
      </button>

      {#if mode === 'timer' && !isRunning}
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

      <button
        class="arrow-btn"
        onclick={() => adjustMinutes(-1)}
        disabled={mode !== 'timer' || isRunning}
      >
        <ChevronDown size={26} />
      </button>
    </div>

    <div class="colon">:</div>

    <div class="time-group">
      <button
        class="arrow-btn"
        onclick={() => adjustSeconds(1)}
        disabled={mode !== 'timer' || isRunning}
      >
        <ChevronUp size={26} />
      </button>

      {#if mode === 'timer' && !isRunning}
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

      <button
        class="arrow-btn"
        onclick={() => adjustSeconds(-1)}
        disabled={mode !== 'timer' || isRunning}
      >
        <ChevronDown size={26} />
      </button>
    </div>
  </div>

  <div class="timer-actions">
    <button class="action-btn" onclick={toggleStartPause}>
      {#if isRunning}
        <Pause size={24} />
      {:else}
        <Play size={24} />
      {/if}
    </button>

    <button class="action-btn" onclick={resetTimer}>
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

  .time-input {
    caret-color: black;
  }

  .time-input::selection {
    background: transparent;
  }

  .colon {
    font-size: clamp(62px, 10vw, 118px);
    font-weight: 800;
    line-height: 1;
    padding-bottom: 0;
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

  @media (max-width: 900px) {
    .timer-tabs {
      width: 100%;
    }

    .timer-tabs button {
      font-size: 14px;
      height: 42px;
      padding: 0 8px;
    }

    .time-group {
      min-width: 84px;
    }

    .timer-actions {
      gap: 18px;
    }

    .action-btn {
      width: 150px;
    }
  }

  @media (max-width: 640px) {
    .time-editor {
      gap: 4px;
    }

    .time-group {
      min-width: 70px;
    }

    .action-btn {
      width: 130px;
      height: 50px;
    }
  }
</style>