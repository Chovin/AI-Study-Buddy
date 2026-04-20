import { writable } from 'svelte/store';

const TIMER_DEFAULT = 25 * 60;
const POMODORO_WORK = 25 * 60;
const POMODORO_BREAK = 5 * 60;

function createTimerStore() {
  const { subscribe, update } = writable({
    mode: 'timer',
    isRunning: false,
    isBreak: false,

    timerValue: TIMER_DEFAULT,
    pomodoroTimeLeft: POMODORO_WORK,
    stopwatchSeconds: 0,

    minimized: true,
    completedPomodoros: 0
  });

  let intervalId = null;

  function clearTimerInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const hrs = Math.floor(safeSeconds / 3600);
    const mins = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;

    return [
      String(hrs).padStart(2, '0'),
      String(mins).padStart(2, '0'),
      String(secs).padStart(2, '0')
    ].join(':');
  }

  function getDisplaySeconds(state) {
    if (state.mode === 'stopwatch') return state.stopwatchSeconds;
    if (state.mode === 'pomodoro') return state.pomodoroTimeLeft;
    return state.timerValue;
  }

  function tick(state) {
    if (!state.isRunning) return state;

    if (state.mode === 'stopwatch') {
      return {
        ...state,
        stopwatchSeconds: state.stopwatchSeconds + 1
      };
    }

    if (state.mode === 'timer') {
      if (state.timerValue > 0) {
        return {
          ...state,
          timerValue: state.timerValue - 1
        };
      }

      clearTimerInterval();
      return {
        ...state,
        isRunning: false
      };
    }

    if (state.pomodoroTimeLeft > 0) {
      return {
        ...state,
        pomodoroTimeLeft: state.pomodoroTimeLeft - 1
      };
    }

    if (state.isBreak) {
      return {
        ...state,
        isBreak: false,
        pomodoroTimeLeft: POMODORO_WORK,
        completedPomodoros: state.completedPomodoros + 1
      };
    }

    return {
      ...state,
      isBreak: true,
      pomodoroTimeLeft: POMODORO_BREAK
    };
  }

  function startInterval() {
    clearTimerInterval();

    intervalId = setInterval(() => {
      update((state) => tick(state));
    }, 1000);
  }

  function start() {
    update((state) => {
      if (state.isRunning) return state;
      return { ...state, isRunning: true };
    });

    startInterval();
  }

  function pause() {
    clearTimerInterval();
    update((state) => ({
      ...state,
      isRunning: false
    }));
  }

  function toggleStartPause() {
    let shouldStart = false;

    update((state) => {
      if (state.isRunning) {
        return {
          ...state,
          isRunning: false
        };
      }

      shouldStart = true;
      return {
        ...state,
        isRunning: true
      };
    });

    clearTimerInterval();

    if (shouldStart) {
      startInterval();
    }
  }

  function reset() {
    clearTimerInterval();

    update((state) => {
      if (state.mode === 'stopwatch') {
        return {
          ...state,
          isRunning: false,
          stopwatchSeconds: 0
        };
      }

      if (state.mode === 'timer') {
        return {
          ...state,
          isRunning: false,
          timerValue: TIMER_DEFAULT
        };
      }

      return {
        ...state,
        isRunning: false,
        isBreak: false,
        pomodoroTimeLeft: POMODORO_WORK,
        completedPomodoros: 0
      };
    });
  }

  function setMode(nextMode) {
    clearTimerInterval();

    update((state) => {
      if (nextMode === 'stopwatch') {
        return {
          ...state,
          mode: 'stopwatch',
          isRunning: false,
          isBreak: false,
          stopwatchSeconds: 0
        };
      }

      if (nextMode === 'timer') {
        return {
          ...state,
          mode: 'timer',
          isRunning: false,
          isBreak: false,
          timerValue: TIMER_DEFAULT
        };
      }

      return {
        ...state,
        mode: 'pomodoro',
        isRunning: false,
        isBreak: false,
        pomodoroTimeLeft: POMODORO_WORK,
        completedPomodoros: 0
      };
    });
  }

  function setTimerValue(seconds) {
    update((state) => ({
      ...state,
      timerValue: Math.max(0, Number(seconds) || 0)
    }));
  }

  function toggleMinimized() {
    update((state) => ({
      ...state,
      minimized: !state.minimized
    }));
  }

  function getFloatingTitle(state) {
    if (state.mode === 'timer') return 'Timer';
    if (state.mode === 'stopwatch') return 'Stopwatch';

    const count = state.completedPomodoros + 1;
    return state.isBreak ? `Break ${count}` : `Session ${count}`;
  }

  return {
    subscribe,
    start,
    pause,
    toggleStartPause,
    reset,
    setMode,
    setTimerValue,
    toggleMinimized,
    clearTimerInterval,
    formatTime,
    getDisplaySeconds,
    getFloatingTitle
  };
}

export const timerStore = createTimerStore();