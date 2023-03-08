<template>
  <Example :onBeforeInit="onBeforeInit" :code="data[hash]" />
</template>

<script lang="ts" setup>
import { data } from './examples.data'
import { onHashChange } from './utils';

let hash: string
let onBeforeInit: (container: HTMLDivElement) => void
if (!import.meta.env.SSR) {
  hash = location.hash.slice(1)
  if (!hash) {
    hash = 'hello-world'
    location.replace(`#${hash}`)
  }

  onHashChange(() => {
    location.replace(location.hash)
  })

  onBeforeInit = (container) => {
    const {top} = container.getBoundingClientRect()
    container.style.height = `calc(100vh - ${top}px)`
  }
}
</script>