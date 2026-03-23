export default class AsyncQueue {
  constructor() {
    this.queue = []
    this.running = false
  }

  enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject })
      this._next()
    })
  }

  async _next() {
    if (this.running) return
    if (this.queue.length === 0) return

    this.running = true

    const { taskFn, resolve, reject } = this.queue.shift()

    try {
      const result = await taskFn()
      resolve(result)
    } catch (err) {
      reject(err)
    } finally {
      this.running = false
      this._next()
    }
  }
}