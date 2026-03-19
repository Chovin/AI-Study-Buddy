const { EventEmitter } = require('events');

class ProgressManager extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
  }

  startTask(id, msg = null, data) {
    msg = msg || 'Starting ' + id
    this.tasks.set(id, { progress: 0, status: 'running', msg, ...data });
    this.emitUpdate();
    console.log(msg)
  }

  updateTask(id, updates) {
    if (!this.tasks.has(id)) return;
    Object.assign(this.tasks.get(id), updates);
    this.emitUpdate();
  }

  finishTask(id, msg=null) {
    msg = msg || 'Finished ' + id
    if (!this.tasks.has(id)) return;
    let task = this.tasks.get(id);
    task.status = 'done';
    task.msg = msg;
    task.progress = 1;
    this.emitUpdate();
    console.log(msg)
  }

  failTask(id, msg=null, error) {
    msg = msg | 'Failed ' + id
    if (!this.tasks.has(id)) return;
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