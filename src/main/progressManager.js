const { EventEmitter } = require('events');

class ProgressManager extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
    this.timers = new Map();
  }

  hasTask(id) {
    return this.tasks.has(id)
  }

  trailingTask(id, {msg = null, ...data}, delay=5000) {
    if (msg == null && this.hasTask(id)) {
      msg = this.tasks.get(id).msg
      console.log('==> msg:', msg)
    }
    console.log('=== trailing ===')
    if (this.hasTask(id)) {
      this.updateTask(id, {msg, error: null, progress: null, status: 'running', ...data})
    } else {
      this.startTask(id, msg, {error: null, progress: null, ...data})
    }

    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id))
      this.timers.delete(id)
    }
    let timer = setTimeout(() => {
      if (data.error) {
        this.failTask(id, msg, data.error)
      } else {
        this.finishTask(id)
      }
    }, delay)

    this.timers.set(id, timer);
  }

  startTask(id, msg = null, data) {
    msg = msg || 'Starting ' + id
    this.tasks.set(id, { progress: 0, status: 'running', msg, ...data });
    this.emitUpdate();
    console.log(msg)
  }

  updateTask(id, updates) {
    if (!this.hasTask(id)) return;
    Object.assign(this.tasks.get(id), updates);
    this.emitUpdate();
  }

  finishTask(id, msg=null) {
    msg = msg || 'Finished ' + id
    if (!this.hasTask(id)) return;
    let task = this.tasks.get(id);
    task.status = 'done';
    task.msg = msg;
    if (task.progress != null) task.progress = 1;
    this.emitUpdate();
    console.log(msg)
  }

  failTask(id, msg=null, error) {
    msg = msg || 'Failed ' + id
    if (!this.hasTask(id)) return;
    let task = this.tasks.get(id);
    task.status = 'error';
    task.msg = msg;
    task.error = error;
    this.emitUpdate();
    console.log(msg, error)
  }

  removeTask(id) {
    console.log(`removing ${id}`)

    if (this.tasks.delete(id)) {
      this.emitUpdate();
    }
  }

  emitUpdate() {
    let arr = Array.from(this.tasks.entries())
    console.info('emitting update', arr)
    this.emit('update', arr);
  }
}

export default new ProgressManager();