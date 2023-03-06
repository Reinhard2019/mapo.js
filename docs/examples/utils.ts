import { onBeforeUnmount } from 'vue'

export function onHashChange(cb: () => void) {
  window.addEventListener('hashchange', cb)
  onBeforeUnmount(() => {
    window.removeEventListener('hashchange', cb)
  })
}
