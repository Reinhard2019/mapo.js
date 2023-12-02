interface Queue {
  cb: () => void
}

class TaskQueue {
  queue: Queue[] = []

  add(cb: Queue['cb']) {
    this.queue.push({
      cb,
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
