import { onUnmounted, ref } from 'vue'

export default function useLoadingBar() {
  const percentage = ref(0)
  let intervalId: NodeJS.Timer
  const finish = () => {
    clearInterval(intervalId)

    percentage.value = 95
    setTimeout(() => {
      percentage.value = 100
    }, 100)
  }
  const start = () => {
    intervalId = setInterval(() => {
      percentage.value += 10
      if (percentage.value >= 70) {
        clearInterval(intervalId)
      }
    }, 200)
    onUnmounted(() => {
      clearInterval(intervalId)
    })
  }
  return {
    percentage,
    start,
    finish,
  }
}
