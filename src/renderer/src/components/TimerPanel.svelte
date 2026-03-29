<script>
  import { onDestroy } from 'svelte';

  let minimized = false;

  const workSeconds = 25 * 60;
  const breakSeconds = 5 * 60;

  let mode = 'pomodoro'; // 'pomodoro' or 'stopwatch'

  let isBreak = false;
  let totalSeconds = workSeconds;
  let timeLeft = totalSeconds;

  let stopwatchSeconds = 0;

  let isRunning = false;
  let intervalId = null;

  function toggleMinimize() {
    minimized = !minimized;
  }

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

    intervalId = setInterval(() => {
      if (mode === 'stopwatch') {
        stopwatchSeconds += 1;
        return;
      }

      if (timeLeft > 0) {
        timeLeft -= 1;
        return;
      }

      if (isBreak) {
        isBreak = false;
        totalSeconds = workSeconds;
        timeLeft = workSeconds;
      } else {
        isBreak = true;
        totalSeconds = breakSeconds;
        timeLeft = breakSeconds;
      }
    }, 1000);
  }

  function pauseTimer() {
    isRunning = false;
    clearTimerInterval();
  }

  function resetTimer() {
    pauseTimer();

    if (mode === 'stopwatch') {
      stopwatchSeconds = 0;
      return;
    }

    isBreak = false;
    totalSeconds = workSeconds;
    timeLeft = workSeconds;
  }

  function toggleStartPause() {
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }

  function changeMode(event) {
    const nextMode = event.target.value;

    pauseTimer();
    mode = nextMode;

    if (mode === 'stopwatch') {
      stopwatchSeconds = 0;
    } else {
      isBreak = false;
      totalSeconds = workSeconds;
      timeLeft = workSeconds;
    }
  }

  $: displayTime = mode === 'stopwatch'
    ? formatTime(stopwatchSeconds)
    : formatTime(timeLeft);

  $: modeLabel = mode === 'stopwatch'
    ? 'Stopwatch'
    : isBreak
      ? 'Break Time'
      : 'Focus Time';

  $: canReset = mode === 'stopwatch'
    ? stopwatchSeconds > 0
    : timeLeft !== totalSeconds || isBreak;

  onDestroy(() => {
    clearTimerInterval();
  });
</script>

{#if minimized}
  <div class="timer-card minimized">
    <button class="toggle-btn" on:click={toggleMinimize} aria-label="Expand timer">
      +
    </button>

    <div class="timer-mode">{modeLabel}</div>
    <div class="timer-text">{displayTime}</div>
  </div>
{:else}
  <div class="timer-card expanded">
    <button class="toggle-btn" on:click={toggleMinimize} aria-label="Minimize timer">
      −
    </button>

    <select class="timer-mode-select" bind:value={mode} on:change={changeMode}>
      <option value="pomodoro">Pomodoro Timer</option>
      <option value="stopwatch">Stopwatch</option>
    </select>

    <div class="timer-mode">{modeLabel}</div>
    <div class="timer-text">{displayTime}</div>

    <div class="timer-actions">
      <button on:click={toggleStartPause}>
        {isRunning ? 'Pause' : 'Start'}
      </button>

      <button on:click={resetTimer} disabled={!canReset}>
        Reset
      </button>
    </div>

    <div class="study-tip-section">
      <h2>Study Tip</h2>
      <p>study tips will be generated from ai and will fade in and out every 10 minutes.</p>
    </div>
  </div>
{/if}

<style>
.timer-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  border: 1px solid #222;
  background: white;
  box-sizing: border-box;
}

.expanded {
  min-height: 620px;
  border-radius: 24px;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.minimized {
  min-height: 110px;
  border-radius: 24px;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.toggle-btn {
  position: absolute;
  top: 8px;
  right: 18px;
  font-size: 18px;
  font-weight: 500;
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.toggle-btn:hover {
  opacity: 0.6;
}

.timer-mode-select {
  margin-top: 16px;
  font-size: 15px;
  border: 1px solid #222;
  border-radius: 8px;
  background: white;
  padding: 6px 10px;
  max-width: 100%;
}

.timer-mode {
  margin-top: 10px;
  font-size: 14px;
  color: #666;
}

.timer-text {
  margin-top: 32px;
  font-size: clamp(34px, 5vw, 64px);
  font-weight: 700;
  line-height: 1;
  text-align: center;
}

.timer-actions {
  margin-top: 40px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.timer-actions button {
  min-width: 120px;
  height: 38px;
  border: 1px solid #222;
  border-radius: 8px;
  background: white;
  cursor: pointer;
}

.timer-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.study-tip-section {
  margin-top: 72px;
  text-align: center;
  max-width: 280px;
}

.study-tip-section h2 {
  font-size: 24px;
  margin-bottom: 14px;
}

.study-tip-section p {
  font-size: 15px;
  line-height: 1.35;
}

.minimized .timer-text {
  margin-top: 0;
  font-size: clamp(28px, 4vw, 52px);
}

.minimized .timer-mode {
  margin-top: 0;
}

@media (max-width: 1200px) {
  .timer-card {
    max-width: 340px;
  }

  .expanded {
    min-height: 540px;
    padding: 20px 16px;
  }

  .timer-mode-select {
    font-size: 14px;
  }

  .timer-actions button {
    min-width: 100px;
    height: 36px;
    font-size: 14px;
  }

  .study-tip-section {
    margin-top: 48px;
    max-width: 240px;
  }

  .study-tip-section h2 {
    font-size: 20px;
  }

  .study-tip-section p {
    font-size: 14px;
  }
}
</style>