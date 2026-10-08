# bdon-live2d-zh

**把 [Project Yume · BanG Dream! Our Notes 数据库](https://bdon.yatta.moe/) 的 Live2D 工具页（[`/tools/live2d`](https://bdon.yatta.moe/tools/live2d)）变成简体中文的油猴脚本。**

![version](https://img.shields.io/badge/version-1.5.2-blue)
![license](https://img.shields.io/badge/license-AGPL--3.0-blue)
![tests](https://img.shields.io/badge/tests-89%20%2B%2047%20%2B%2048%20passing-brightgreen)
![platform](https://img.shields.io/badge/Tampermonkey-userscript-orange)

不用改站点源码，也不用架镜像：脚本在浏览器里把界面文案改写成中文。
**关键在于 —— 站点脚本读到的仍然是英文原文**，所以按钮、下拉、动作播放全都照常工作。

---

## 这是什么

[bdon.yatta.moe](https://bdon.yatta.moe/) 是一个 BanG Dream! 手游 **Our Notes** 的数据库站点，里面有个很好用的 **Live2D 工具页**：可以实时给角色换动作、表情、调参数。

但站点界面只有英文。它是第三方站点，改不了服务端，所以这个项目做成 Tampermonkey 用户脚本：打开页面时把界面文案替换成简体中文，左下角留一个 **中 / EN** 按钮可以随时切回去。

覆盖范围：

| 区域 | 是否汉化 |
| --- | --- |
| 页头导航、页脚 | ✅ |
| Live2D 调整器（参数分组、滑块说明、按钮、提示） | ✅ |
| 动作 / 表情下拉列表 | ✅ 中文显示，值仍是站点要的英文 ID |
| 模型参数名（`ParamAngleX` 等） | ✅ 旁边用中文显示（原文保留，见下） |
| 角色名、模型 ID | ❌ 保留原文（专有名词，见「已知限制」） |

## 安装

1. 浏览器先装 **[Tampermonkey](https://www.tampermonkey.net/)**（Chrome / Edge / Firefox 都支持）。
2. 点这里安装脚本 → **[安装 bdon-live2d-zh.user.js](https://raw.githubusercontent.com/SQQTC/bdon-live2d-zh/main/bdon-live2d-zh.user.js)**，Tampermonkey 会弹出安装页，点「安装」。
   - 装不上就手动来：Tampermonkey 面板 → 「添加新脚本」→ 把 `bdon-live2d-zh.user.js` 全文粘进去 → `Ctrl+S` 保存。
3. 打开 <https://bdon.yatta.moe/tools/live2d>，按 `Ctrl+F5` 强制刷新。

页面左下角出现 **中 / EN** 按钮就说明装好了。

## 使用

- **左下角「中 / EN」** —— 一键切换中文 / 英文。选择记在 `localStorage` 里，下次打开还是上次的选择。
- **左下角「?」** —— 诊断面板。里面会列出**词典条数、已改写处数、还没翻译的原文**，可以一键导出。发现哪里没翻，把这份清单贴到 [Issues](https://github.com/SQQTC/bdon-live2d-zh/issues) 就行。
- **临时关掉改写**：`F12` 打开控制台，执行 `__bdnL2dZh.pause()` 暂停、`__bdnL2dZh.resume()` 恢复。排查「某个按钮点了没反应」时很有用。

## 它是怎么工作的

这个页面比看起来难搞。它是个 React 单页应用，而且**很多界面文字同时是程序用的键**，不能直接改文本。脚本因此分三层：

**① 语言前缀（保险层）**
上游项目其实是多语言的，但线上这个部署只构建了英文：`sitemap.xml` 里所有地址都不带语言前缀，而 `/en/…`、`/zh-cn/…` 甚至不存在的 `/zz/…` 都返回同一个兜底页 —— 也就是说**站点没有自带中文可跳**。
万一你落在带前缀的兜底地址上，脚本会去掉前缀回到真正的页面（每个会话只跳一次，避免来回弹）。

**② 词典改写（主力）**
把可见文本节点和 `title` / `placeholder` / `aria-label` / `alt` / `data-tooltip` 等属性，用一份 **321 条**的词典（整句精确匹配 + 模板）换成中文。词表放在 `moenotes_live2d_en_zh.tsv` 与 `adjuster_en_zh.tsv` 里，由 `build-dict.mjs` 编译进脚本。

**③ 模型字段：不能改文字，就「画」一个中文层**
`ParamAngleX`、`mtn_idle01_C`、`exp_idle01_C` 这些既是给人看的标签，**又是站点拿去查模型的键**。一旦改写 `textContent`，站点就读不到模型了 —— 这正是当初「点了动作没反应」的原因。

解决办法是**原文一个字节都不动**，改成视觉上叠一层中文：

```css
/* 藏掉英文原文，再用伪元素把中文画在同一个位置 */
html body .bdn-zh-id            { font-size: 0 !important; visibility: hidden !important }
html body .bdn-zh-id::after     { content: attr(data-bdn-zh) !important;
                                  visibility: visible !important;
                                  font-size: var(--bdn-zh-fs, 11px) !important }
```

- 中文写在 `data-bdn-zh` 属性上，用 `::after` 渲染出来，字号用 CSS 变量继承原文大小；
- 选择器前面垫 `html body` 是为了在双方都用 `!important` 时**靠权重**赢过站点自己的 `::after`（注入的样式表在文档里更靠前，比先后顺序必输）；
- `<option>` 里画不出伪元素，下拉选项改走 `label` 属性：`<option label="待机01（C）" value="mtn_idle01_C">` —— 显示中文，值不变。

**诊断面板（?）** 就是这三层机制的探针：它显示未匹配的原文、伪元素自检结果、以及最近几个模型字段元素的抽样。早期版本「英文藏住了但中文没画出来」这类问题，就是靠它定位的。

## 开发

只要 Node.js（≥ 18），没有依赖：

```bash
node build-dict.mjs     # 把 *.tsv 词表编译进脚本的词典区段
node test-dict.mjs      # 词典回归：89 个用例
node test-param.mjs     # 模型字段判定：47 个断言
node test-boot.mjs      # 启动冒烟：最小 DOM 桩里完整跑一遍脚本，48 个断言
npm test                # 三个测试一起跑
```

`build-dict.mjs` 会**重写脚本里的词典区段**，并且带防回归校验：必需的常量与函数（`HOST_ID`、`ZH_CLASS`、`applyToElement`、`probeMark`…）必须仍在，且 `@version` 必须等于 `const VERSION`，否则构建直接失败。词典区段以外的代码不会被动到。

`test-boot.mjs` 值得一提：它用几十行搭了个最小 DOM 桩，在 Node 里把整个用户脚本从头执行一遍，模拟真实页面（文本节点改写、`<option>`、`MutationObserver` 回调、暂停 / 恢复）。当初「脚本一启动就崩、按钮根本不出现」的 bug 就是它抓出来的 —— 浏览器里只能看到「没反应」，Node 里能拿到完整堆栈。

## 目录结构

```
bdon-live2d-zh/
├─ bdon-live2d-zh.user.js     ← 脚本本体（要安装的就是它）
├─ 使用说明.md                 ← 更细的中文说明书（含排查清单）
├─ build-dict.mjs             ← 词表编译器 + 防回归校验
├─ test-dict.mjs              ← 词典回归测试
├─ test-param.mjs             ← 模型字段判定测试
├─ test-boot.mjs              ← 启动冒烟测试
├─ moenotes_live2d_en_zh.tsv  ← 词表：上游 i18n 的英 / 中配对
├─ adjuster_en_zh.tsv         ← 词表：调整器界面文案
├─ live-unmatched.txt         ← 线上实测未匹配清单（待补译）
└─ research/                  ← 研究期留档：抓页面文案的脚本与快照
```

## 词表与覆盖率

`moenotes_live2d_en_zh.tsv` 的英文 / 中文对照来自上游开源项目 **moenotes** 的 i18n 文案 —— 也就是说这些译文本就是官方中文，不是机翻。脚本在此基础上补齐了调整器部分的文案。

拿线上页面实测的 **334 条**文案回归，覆盖 **288 条（约 86%）**，剩下 46 条全是角色名与模型 ID（保留原文，见下）。

## 已知限制

- **角色名、模型 ID 不翻译**，保留英文原文。它们是站点用来查数据的键，硬翻会失灵。
- 线上站点是上游项目的**另一个分支部署**（品牌名从 `Moenotes` 变成了 `Project Yume`），文案可能随时变动。发现没翻的，用 `?` 面板导出清单开 issue 即可。
- 只在 **Chrome / Edge + Tampermonkey** 上实测过；脚本本身是标准用户脚本，其他管理器理论上也能用。
- 站点改版后可能失效 —— 这类脚本的命运，通常几天内就能修好。

## 致谢

- **[StarMoe-org/moenotes](https://github.com/StarMoe-org/moenotes)** —— 站点的开源前端，也是本项目词表与页面结构认知的来源。感谢他们做出了这个数据库和 Live2D 调整器。
- [bdon.yatta.moe](https://bdon.yatta.moe/) 的运营者与 [Yatta](https://yatta.moe/) 团队，提供了这么好用的工具。
- 《BanG Dream!》及其角色相关的所有权利归 **Bushiroad** 及其他权利方所有；Live2D 相关技术归 **Live2D Inc.** 所有。

**本项目是非官方的民间汉化，与站点运营方、Bushiroad 均无关联。**

## 许可

**[AGPL-3.0](LICENSE)**。

之所以选它：脚本里的词表派生于 AGPL-3.0 授权的 moenotes 项目，因此整个仓库以同一许可证发布。简单说 —— 你可以随意使用、修改、再分发，但如果改了再发布（或作为网络服务提供），也要以 AGPL-3.0 开源你的版本。
