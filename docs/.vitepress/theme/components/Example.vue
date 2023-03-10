<template>
  <div ref="container" :class="['flex', expand && 'fixed top-0 left-0 z-10000 w-screen h-screen']">
    <div ref="map" id="map" class="h-full w-50% bg-black" />
    <div class="h-full w-50%" ref="editorContainer">
      <n-config-provider :theme="theme">
        <div class="h-[36px] flex justify-between">
          <div class="px-12px leading-36px bg-[var(--vp-nav-bg-color)]">
            javascript
            <!-- <n-select class="child[.n-base-selection__border]:hidden child[.n-base-selection__state-border]:hidden"
              v-model:value="codeType" :options="[{
                label: 'javascript',
                value: 'javascript',
                class: '!pr-[var(--n-option-padding-right)]'
              }, {
                label: 'typescript',
                value: 'typescript',
                class: '!pr-[var(--n-option-padding-right)]'
              }]" /> -->
          </div>
          <div class="w-full bg-[var(--vp-sidebar-bg-color)] flex items-center justify-end px-8px gap-8px">
            <NTooltip>
              <template #trigger>
                <div
                  :class="['cursor-pointer', expand ? 'i-ant-design:compress-outlined' : 'i-ant-design:expand-outlined']"
                  @click="() => expand = !expand" />
              </template>
              {{ expand ? '收缩' : '展开' }}
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <div class="i-ant-design:play-circle-outlined cursor-pointer" @click="rerun"></div>
              </template>
              运行
            </NTooltip>
          </div>
        </div>
      </n-config-provider>
      <div ref="editor" class="h-[calc(100%-36px)]" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import * as mapo from 'mapo.js'
import FPSControl from 'fps-control'
import * as THREE from 'three'
import type { editor } from 'monaco-editor'
import { computed, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import * as Babel from '@babel/standalone'
import * as naiveUi from 'naive-ui'
import interact from 'interactjs'
import type { ResizeEvent } from '@interactjs/types/index'

const { NConfigProvider, NTooltip, NSelect, lightTheme, darkTheme } = naiveUi

interface Props {
  code: string,
  /**
   * 是否占满屏幕剩余高度，默认为 true
   */
  fillRemainderHeight?: boolean,
  /**
   * beforeInit 在 onMounted 中，preview 和 editor 初始化前执行
   */
  onBeforeInit?: Function
}
const props = withDefaults(defineProps<Props>(), {
  fillRemainderHeight: true
})

// 在执行 eval 函数时，会生成一个或多个 Map 对象，再次执行 eval 前需要先销毁这些对象
let mapList: Map[] = []
class Map extends mapo.Map {
  constructor(options) {
    super(options)

    mapList.push(this)
  }
}
const evalAsync = (code?: string) => {
  if (!code) return
  // babel 转化后的代码依赖于 require
  function require(name: string) {
    const libMap = {
      'mapo.js': {
        ...mapo,
        Map
      },
      three: THREE,
      'fps-control': FPSControl,
    }
    return libMap[name]
  }
  // if (!!require) 的意义：由于 require 只在 eval 中被使用，如果没有明确在代码中被使用，打包过程中会自动清空掉 require 函数
  if (!!require) {
    const _code = Babel.transform(code, { presets: ["env"] }).code
    eval(_code)
  }
}

let container = ref<HTMLDivElement>()
let editorContainer = ref<HTMLDivElement>()
let map = ref<HTMLDivElement>()
let editor = ref<HTMLDivElement>()

const { isDark } = useData()
const expand = ref(false)
// const codeType = ref<'javascript' | 'typescript'>('javascript')
const theme = computed(() => isDark.value ? darkTheme : lightTheme)
let codeEditor: editor.IStandaloneCodeEditor

function initEditor() {
  // @ts-ignore
  codeEditor = window.monaco.editor.create(editor.value!, {
    value: props.code,
    language: "javascript",
    automaticLayout: true,
  } as editor.IStandaloneEditorConstructionOptions)

  watch(isDark, () => {
    // @ts-ignore
    window.monaco.editor.setTheme(isDark.value ? 'vs-dark' : 'vs')
  }, {
    immediate: true
  })
}

onMounted(() => {
  props.onBeforeInit?.(container.value!)

  if (props.fillRemainderHeight) {
    const {top} = container.value!.getBoundingClientRect()
    container.value!.style.height = `calc(100vh - ${top}px)`
  }

  const id = "monaco-editor-loader"
  let script = document.getElementById(id) as HTMLScriptElement
  if (script) {
    initEditor()
  } else {
    script = document.createElement('script')
    script.id = id
    script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.36.1/min/vs/loader.js'
    script.onload = () => {
      // @ts-ignore
      window.require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.36.1/min/vs' } })
      // @ts-ignore
      window.require(['vs/editor/editor.main'], () => {
        initEditor()
      })
    }
    document.head.appendChild(script)
  }

  evalAsync(props.code)

  interact(editorContainer.value!).resizable({
    edges: { left: true },
    listeners: {
      move: function (event: ResizeEvent) {
        const resizeWidth = event.rect.width
        const parentWidth = map.value!.parentElement?.clientWidth!
        const ratio = resizeWidth / parentWidth * 100
        Object.assign(event.target.style, {
          width: `${ratio}%`,
        })
        Object.assign(map.value!.style, {
          width: `${100 - ratio}%`,
        })
      },
    },
  })
})

function rerun() {
  mapList.forEach((map) => {
    map.dispose()
  })
  mapList = []

  evalAsync(codeEditor.getValue())
}
</script>