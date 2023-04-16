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
      <div class="h-[calc(100%-36px)] relative">
        <n-progress v-if="percentage < 100" class="absolute" type="line" :percentage="percentage" :show-indicator="false"
          :height="2" :border-radius="0" />
        <iframe ref="editor" class="w-full h-full border-none" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import * as mapo from 'mapo.js'
import FPSControl from '@mapo.js/fps-control'
import * as THREE from 'three'
import type { editor } from 'monaco-editor'
import { computed, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import * as naiveUi from 'naive-ui'
import interact from 'interactjs'
import type { ResizeEvent } from '@interactjs/types/index'
import useLoadingBar from '../hooks/useLoadingBar'

const { NConfigProvider, NTooltip, NProgress, lightTheme, darkTheme } = naiveUi

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
      '@mapo.js/fps-control': FPSControl,
    }
    return libMap[name]
  }
  // if (!!require) 的意义：由于 require 只在 eval 中被使用，如果没有明确在代码中被使用，打包过程中会自动清空掉 require 函数
  if (!!require) {
    // @ts-expect-error
    const _code = window.Babel.transform(code, { presets: ["env"] }).code
    eval(_code)
  }
}

let container = ref<HTMLDivElement>()
let editorContainer = ref<HTMLDivElement>()
let map = ref<HTMLDivElement>()
let editor = ref<HTMLIFrameElement>()

const { isDark } = useData()
const expand = ref(false)
// const codeType = ref<'javascript' | 'typescript'>('javascript')
const theme = computed(() => isDark.value ? darkTheme : lightTheme)
let codeEditor: editor.IStandaloneCodeEditor

const { percentage, start, finish } = useLoadingBar()
start()

onMounted(() => {
  props.onBeforeInit?.(container.value!)

  // @ts-expect-error
  if (window.babelLoadPromise) {
    // @ts-expect-error
    window.babelLoadPromise.then(() => {
      evalAsync(props.code)
    })
  } else {
    // @ts-expect-error
    window.babelLoadPromise = new Promise(resolve => {
      const script = document.createElement('script')
      // script.src = 'https://unpkg.com/babel-standalone@6.26.0/babel.min.js'
      script.src = 'https://unpkg.com/@babel/standalone@7.21.2/babel.min.js'
      // script.type = 'module'
      script.onload = () => {
        evalAsync(props.code)
        resolve('')
      }
      document.head.appendChild(script)
    })
  }

  if (props.fillRemainderHeight) {
    const { top } = container.value!.getBoundingClientRect()
    container.value!.style.height = `calc(100vh - ${top}px)`
  }

  const monacoWindow = editor.value!.contentWindow
  const monacoBody = monacoWindow?.document.body
  if (monacoBody) {
    monacoBody.style.margin = '0px'
    monacoBody.style.background = getComputedStyle(document.body).getPropertyValue('--vp-c-bg')
  }
  const script = document.createElement('script')
  const vs = 'https://unpkg.com/monaco-editor@0.36.1/min/vs'
  script.src = vs + '/loader.js'
  script.onload = () => {
    // @ts-expect-error
    monacoWindow.require.config({ paths: { vs } })
    // @ts-expect-error
    monacoWindow?.require(['vs/editor/editor.main'], () => {
      const monacoWindow = editor.value!.contentWindow;
      if (!monacoWindow) return
      // @ts-expect-error
      const monaco = monacoWindow?.monaco
      const monacoBody = monacoWindow.document.body
      codeEditor = monaco.editor.create(monacoBody, {
        value: props.code,
        language: "javascript",
        automaticLayout: true,
      } as editor.IStandaloneEditorConstructionOptions)

      watch(isDark, () => {
        monaco.editor.setTheme(isDark.value ? 'vs-dark' : 'vs')
        monacoBody.style.background = getComputedStyle(document.body).getPropertyValue('--vp-c-bg')
      }, {
        immediate: true
      })

      finish()
    })
  }
  monacoWindow?.document.head.appendChild(script)

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