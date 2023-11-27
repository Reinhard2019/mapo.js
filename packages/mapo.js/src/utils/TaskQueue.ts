interface Queue {
  id: string
  cb: () => void
}

class TaskQueue {
  queue: Queue[] = []

  add(id: string, cb: Queue['cb']) {
    this.queue.push({
      id,
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
      // console.log('this.queue', this.queue.length, this.queue.map(v => v.id))
    }
  }
}

export default TaskQueue
