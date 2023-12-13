interface Queue {
  cb: () => unknown
}

class TaskQueue {
  queue: Queue[] = []

  add(cb: Queue['cb']) {
    this.queue.push({
      cb,
    })
  }

  /**
   * 会返回 promise 的 add
   * @param cb
   */
  async addWithPromise<T>(cb: () => T) {
    return await new Promise<T>(resolve => {
      this.add(() => {
        resolve(cb())
      })
    })
  }

  run(time: DOMHighResTimeStamp) {
    while (this.queue.length) {
      if (performance.now() - time > 16) {
        break
      }

      const queue = this.queue.shift()
      queue?.cb()
    }
  }
}

export default TaskQueue
