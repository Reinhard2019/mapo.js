---
footer: false
---

# 快速上手 {#quick-start}

## 安装引入

### 通过 npm 引入 {#npm-import}

<div class="language-sh"><pre><code><span class="line"><span style="color:var(--vt-c-green);">&gt;</span> <span style="color:#A6ACCD;">npm install --save mapo.js</span></span></code></pre></div>

### 通过 CDN 引入 {#cdn-import}

你可以借助 script 标签直接通过 CDN 来使用 Mapo.js：

```html
// 引入 mapo.js 前需要引入 three
<script src="https://unpkg.com/three"></script>
<script src="https://unpkg.com/mapo.js"></script>
```

这里我们使用了 [unpkg](https://unpkg.com/)，但你也可以使用任何提供 npm 包服务的 CDN，例如 [jsdelivr](https://www.jsdelivr.com/package/npm/mapo.js) 。当然，你也可以下载此文件并自行提供服务。

### 基础教程 {#basic-guide}

```js
import { Map } from 'mapo.js'

new Map({
  container: '#map',
})
```

<!-- [JSFiddle 中的示例](https://jsfiddle.net/yyx990803/nw1xg8Lj/) -->