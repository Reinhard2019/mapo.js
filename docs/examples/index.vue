<template>
  <Example class="h-[calc(100vh-64px)]" :code="data[hash]" />
</template>

<script lang="ts" setup>
import { data } from './examples.data'
import { onHashChange } from './utils';

let hash: string
if (!import.meta.env.SSR) {
  hash = location.hash.slice(1)
  if (!hash) {
    hash = 'hello-world'
    location.replace(`#${hash}`)
  }

  onHashChange(() => {
    location.replace(location.hash)
  })
}
</script>