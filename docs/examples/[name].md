---
layout: page
title: 示例
---

<script lang="ts" setup>
import { computed } from 'vue'
import { useData } from 'vitepress'
import { data } from './index.data.ts'

const { params } = useData()

const code = computed(() => data[params.value?.name])
</script>

<Example :code="code" />