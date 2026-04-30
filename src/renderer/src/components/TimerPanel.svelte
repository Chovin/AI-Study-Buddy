<script>
  import { timerStore } from '../../../main/timerStore.js';
  import { Play, Pause, RotateCcw, ChevronUp, ChevronDown, ChevronRight } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import alarmSrc from '../assets/TimerClockAlarm.mp3';

  let editHours = '00';
  let editMinutes = '25';
  let editSeconds = '00';

  let alarm;
  let previousSeconds = null;
  let alarmPlayed = false;

  onMount(() => {
    alarm = new Audio(alarmSrc);
    alarm.volume = 1.0;
  });

  function playAlarm() {
    if (!alarm) return;

    alarm.currentTime = 0;
    alarm.play().catch((err) => {
      console.error('Alarm failed to play:', err);
    });
  }

  function stopAlarm() {
    if (!alarm) return;

    alarm.pause();
    alarm.currentTime = 0;
  }

  function handleStartPause() {
    stopAlarm();
    timerStore.toggleStartPause();
  }

  function handleReset() {
    stopAlarm();
    alarmPlayed = false;
    previousSeconds = null;
    timerStore.reset();
  }

  function wrap(value, min, max) {
    if (value > max) return min;
    if (value < min) return max;
    return value;
  }

  function getTimeFromSelectedTimer() {
    const tStore = $timerStore ?? {}
    let value = tStore.timerValue
    if (tStore.mode == 'pomodoro') {
      value = tStore.isBreak ? tStore.pomodoroBreak : tStore.pomodoroWork
    }
    return value ?? 0
  }

  function getTimePartsFromSelectedTimer() {
    let value = getTimeFromSelectedTimer()
    return {
      hours: Math.floor(value / 3600),
      minutes: Math.floor((value % 3600) / 60),
      seconds: value % 60
    }
  }

  function syncInputsFromTimer() {
    const {hours, minutes, seconds} = getTimePartsFromSelectedTimer()

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

  function applyInputsToPomodoroWork() {
    applyInputsToPomodoro(false)
  }

  function applyInputsToPomodoroBreak() {
    applyInputsToPomodoro(true)
  }

  function applyInputsToPomodoro(editingBreak = false) {
    const hours = Math.max(0, Math.min(99, Number(editHours) || 0));
    const minutes = Math.max(0, Math.min(59, Number(editMinutes) || 0));
    const seconds = Math.max(0, Math.min(59, Number(editSeconds) || 0));

    const totalSeconds = hours * 3600 + minutes * 60 + seconds

    const args = [$timerStore.pomodoroWork, $timerStore.pomodoroBreak]
    if (editingBreak) {
      args[1] = totalSeconds
    } else {
      args[0] = totalSeconds
    }

    timerStore.setPomodoroSettings(...args);
    syncInputsFromTimer()
  }

  function handleTypedInput(part, event) {
    const value = event.currentTarget.value.replace(/\D/g, '').slice(0, 2);

    if (part === 'hours') editHours = value;
    if (part === 'minutes') editMinutes = value;
    if (part === 'seconds') editSeconds = value;
  }

  function commitTypedInput() {
    if (!editableTimeMode || $timerStore.isRunning) return;
    const applyFuncs = {
      timer: applyInputsToTimer,
      pomodoro: $timerStore.isBreak ? applyInputsToPomodoroBreak : applyInputsToPomodoroWork
    }
    applyFuncs[$timerStore.mode]()
  }

  function handleInputKeydown(event) {
    if (event.key === 'Enter') {
      commitTypedInput();
      event.currentTarget.blur();
    }
  }

  function setFunctionByModeSelected(totalSeconds) {
    const applyFuncs = {
      timer: timerStore.setTimerValue,
      pomodoro: (v) => $timerStore.isBreak ?
        timerStore.setPomodoroSettings($timerStore.pomodoroWork, v) :
        timerStore.setPomodoroSettings(v, $timerStore.pomodoroBreak)
    }
    applyFuncs[$timerStore.mode](totalSeconds)
  }

  function adjustTime(dhours, dminutes, dseconds) {
    if (!editableTimeMode || $timerStore.isRunning) return;
    let {hours, minutes, seconds} = getTimePartsFromSelectedTimer()

    hours = wrap(hours + dhours, 0, 99);
    minutes = wrap(minutes + dminutes, 0, 59);
    seconds = wrap(seconds + dseconds, 0, 59);
    setFunctionByModeSelected(hours * 3600 + minutes * 60 + seconds);
    syncInputsFromTimer();
  }

  function handleModeChange(mode) {
    stopAlarm();
    alarmPlayed = false;
    previousSeconds = null;
    timerStore.setMode(mode);
  }

  $: displaySeconds = timerStore.getDisplaySeconds($timerStore);
  $: displayTime = timerStore.formatTime(displaySeconds);
  $: timeParts = displayTime.split(':');
  $: timerTitle = timerStore.getFloatingTitle($timerStore);
  $: editableTimeMode = ['timer', 'pomodoro'].includes($timerStore.mode);

  $: if (editableTimeMode && !$timerStore.isRunning) {
    syncInputsFromTimer();
  }

  $: {
    const shouldAlarm =
      ($timerStore.mode === 'timer' || $timerStore.mode === 'pomodoro') &&
      $timerStore.isRunning &&
      previousSeconds !== null &&
      previousSeconds > 0 &&
      displaySeconds === 0 &&
      !alarmPlayed;

    if (shouldAlarm) {
      playAlarm();
      alarmPlayed = true;
    }

    if (displaySeconds > 0) {
      alarmPlayed = false;
    }

    previousSeconds = displaySeconds;
  }

  $: if ($timerStore) {
    window.api.saveTimerSettings({
      timerValue: $timerStore.timerValue,
      pomodoroWork: $timerStore.pomodoroWork,
      pomodoroBreak: $timerStore.pomodoroBreak
    }).catch((err) => console.error('Failed to save timer settings:', err));
  }
</script>

<div class="timer-shell">
  <div class="timer-tabs">
    <button class:active={$timerStore.mode === 'timer'} onclick={() => handleModeChange('timer')}>
      Timer
    </button>

    <button class:active={$timerStore.mode === 'pomodoro'} onclick={() => handleModeChange('pomodoro')}>
      Pomodoro
    </button>

    <button class:active={$timerStore.mode === 'stopwatch'} onclick={() => handleModeChange('stopwatch')}>
      Stopwatch
    </button>
  </div>

  <div class="timer-label">{timerTitle}</div>

  <div class="time-editor">
    <div class="time-group">
      <button class="arrow-btn" onclick={() => adjustTime(1, 0, 0)} disabled={!editableTimeMode || $timerStore.isRunning}>
        <ChevronUp size={26} />
      </button>

      {#if editableTimeMode && !$timerStore.isRunning}
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
        <input inert class="time-display" value={timeParts[0]}/>
      {/if}

      <button class="arrow-btn" onclick={() => adjustTime(-1, 0, 0)} disabled={!editableTimeMode || $timerStore.isRunning}>
        <ChevronDown size={26} />
      </button>
    </div>

    <div class="colon">:</div>

    <div class="time-group">
      <button class="arrow-btn" onclick={() => adjustTime(0, 1, 0)} disabled={!editableTimeMode || $timerStore.isRunning}>
        <ChevronUp size={26} />
      </button>

      {#if editableTimeMode && !$timerStore.isRunning}
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
        <input inert class="time-display" value={timeParts[1]}/>
      {/if}

      <button class="arrow-btn" onclick={() => adjustTime(0, -1, 0)} disabled={!editableTimeMode || $timerStore.isRunning}>
        <ChevronDown size={26} />
      </button>
    </div>

    <div class="colon">:</div>

    <div class="time-group">
      <button class="arrow-btn" onclick={() => adjustTime(0, 0, 1)} disabled={!editableTimeMode || $timerStore.isRunning}>
        <ChevronUp size={26} />
      </button>

      {#if editableTimeMode && !$timerStore.isRunning}
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
        <input inert class="time-display" value={timeParts[2]}/>
      {/if}

      <button class="arrow-btn" onclick={() => adjustTime(0, 0, -1)} disabled={!editableTimeMode || $timerStore.isRunning}>
        <ChevronDown size={26} />
      </button>
    </div>

    {#if $timerStore.mode === 'pomodoro'}
      <div class="out-of-flex">
        <button class="arrow-btn" onclick={() => timerStore.setPomodoroSettings($timerStore.pomodoroWork, $timerStore.pomodoroBreak, !$timerStore.isBreak)} disabled={!editableTimeMode || $timerStore.isRunning}>
          <ChevronRight size={26} />
        </button>
      </div>
    {/if}
  </div>

  <div class="timer-actions">
    <button class="action-btn" onclick={handleStartPause}>
      {#if $timerStore.isRunning}
        <Pause size={24} />
      {:else}
        <Play size={24} />
      {/if}
    </button>

    <button class="action-btn" onclick={handleReset}>
      <RotateCcw size={24} />
    </button>
  </div>
</div>

<style>

  :root {
    --time-editor-gap: 10px;
    --arrow-btn-size: 42px;
  }
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
    gap: var(--time-editor-gap);
    flex-wrap: nowrap;
    position: relative;
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
    width: var(--arrow-btn-size);
    height: var(--arrow-btn-size);
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

  .out-of-flex {
    position: absolute;
    top: 50;
    width: var(--arrow-btn-size);
    right: calc(-1 * (var(--arrow-btn-size) + var(--time-editor-gap)));
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