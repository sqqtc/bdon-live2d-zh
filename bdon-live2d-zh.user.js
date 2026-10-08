// ==UserScript==
// @name         Project Yume 汉化 · Live2D 工具页 (/tools/live2d)
// @name:zh-CN   Project Yume 汉化 · Live2D 工具页
// @namespace    https://bdon.yatta.moe/
// @version      1.5.2
// @description  把 bdon.yatta.moe 的 Live2D 工具页整页界面（含页头导航、设置抽屉、页脚）翻译成简体中文；左下角可一键在中/英之间切换，并附带「还有哪些没翻」的诊断面板。
// @author       SQQTC
// @license      AGPL-3.0
// @homepageURL  https://github.com/SQQTC/bdon-live2d-zh
// @supportURL   https://github.com/SQQTC/bdon-live2d-zh/issues
// @updateURL    https://raw.githubusercontent.com/SQQTC/bdon-live2d-zh/main/bdon-live2d-zh.user.js
// @downloadURL  https://raw.githubusercontent.com/SQQTC/bdon-live2d-zh/main/bdon-live2d-zh.user.js
// @match        https://bdon.yatta.moe/*
// @match        http://bdon.yatta.moe/*
// @match        https://*.yatta.moe/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

/* eslint-disable no-multi-spaces */
(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // 0. 前置检查：语言前缀
  //
  //    上游 moenotes 是多语言 Astro 应用，zh-CN 的路径前缀是空字符串，
  //    其他语言才有前缀（en-US → "en"、ja-JP → "ja"、zh-TW → "zh-tw"…）。
  //    但线上 bdon.yatta.moe 这个部署只构建了英文：sitemap.xml 里
  //    所有 URL 都不带前缀，而 /en/…、/zh-cn/… 乃至根本不存在的 /zz/…
  //    都返回同一个兜底页。也就是说站点没有自带中文可跳，汉化只能靠
  //    本脚本改写文案。
  //
  //    下面这段保留为保险：万一落在带语言前缀的地址上（那是兜底页，
  //    不是真页面），就去掉前缀回到真正的页面；每个会话只跳一次。
  // ════════════════════════════════════════════════════════════════
  const LOCALE_PREFIXES = ['en', 'zh-tw', 'ja', 'ko', 'th', 'id', 'vi', 'es', 'pt', 'fr', 'de', 'ru'];
  const PREFIX_RE = new RegExp('^/(' + LOCALE_PREFIXES.join('|') + ')(?=/|$)', 'i');

  const PREF_KEY = 'bdn-l2d-zh:prefer-chinese';   // '1' 中文 / '0' 英文
  const GUARD_KEY = 'bdn-l2d-zh:skip-redirect';   // 用户手动选了英文时，本会话不再自动跳回中文

  const hasPrefix = () => PREFIX_RE.test(location.pathname);
  const stripPrefix = () => location.pathname.replace(PREFIX_RE, '') || '/';

  let prefOn = true;
  try {
    if (localStorage.getItem(PREF_KEY) === '0') prefOn = false;
  } catch (_) { /* 无法访问 localStorage 时默认中文 */ }

  /** 若当前在 /en/… 这类其他语言页，跳回无前缀的中文页 */
  function forceChinese() {
    if (!prefOn || !hasPrefix()) return false;
    try {
      if (sessionStorage.getItem(GUARD_KEY) === '1') return false;  // 只跳一次，避免死循环
      sessionStorage.setItem(GUARD_KEY, '1');
    } catch (_) { /* 退化为仅靠词典翻译 */ }
    location.replace(stripPrefix() + location.search + location.hash);
    return true;
  }

  // ════════════════════════════════════════════════════════════════
  // 0.1 常量与作用范围
  //     @match 放宽到整站，避免因地址写法不同导致整个脚本不生效；
  //     真正处理的仍然只有 Live2D 工具页。
  //     ⚠ 这些常量必须留在词典区段之外（build-dict.mjs 生成区之内会被覆盖）
  // ════════════════════════════════════════════════════════════════
  const VERSION = '1.5.2';
  const HOST_ID = 'bdn-l2d-zh-host';
  const PANEL_ID = 'bdn-l2d-zh-panel';
  const STYLE_ID = 'bdn-l2d-zh-style';
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-tooltip'];

  // 模型自带字段（ParamAngleX / hand_R_01 / mtn_angry01_C / exp_cry02.exp3）不许改 DOM 原文：
  // 线上调整器把这些串当「键」用（按钮文本、title 都可能是动作 ID），改了它就会点了没反应。
  // 所以中文只用 CSS 伪元素画出来 —— JS 读到的 textContent / title / innerText 仍是英文原文。
  const ZH_ATTR = 'data-bdn-zh';
  const ZH_CLASS = 'bdn-zh-id';
  // 藏英文 / 画中文各留两条互不依赖的退路：
  //   · font-size:0 与 visibility:hidden 双保险地藏掉英文（都带 !important，压得过站点样式）
  //   · ::after 显式 visibility:visible + 自带字号，不依赖元素自身字号（元素字号已被置 0）
  // 选择器前面多垫 html body：站点自己的 `.xxx::after{content:… !important}` 与我同分时，
  // 谁的选择器更具体谁赢（内联样式表注入得早，靠先后顺序是比不过站点的）。
  const ZH_SEL = 'html body .' + ZH_CLASS;
  const ZH_CSS = ZH_SEL + '{font-size:0 !important;visibility:hidden !important}'
    + ZH_SEL + '::after{content:attr(' + ZH_ATTR + ') !important;visibility:visible !important;'
    + 'font-size:var(--bdn-zh-fs,11px) !important;line-height:1.25 !important;'
    + 'white-space:normal !important;flex:0 0 auto !important}';
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'CANVAS', 'IFRAME', 'KBD', 'SAMP',
  ]);

  const IS_TARGET = /(^|\/)tools\/live2d(\/|$)/.test(location.pathname);
  if (!IS_TARGET) return;

  if (forceChinese()) return;

  // 用户把语言切成英文时整体停用（下次加载即恢复原文）
  const dictOn = prefOn;

  const LOG = (...args) => {
    try { console.log('%c[live2d-zh]', 'color:#e879f9;font-weight:700', ...args); } catch (_) { /* 忽略 */ }
  };

  // ════════════════════════════════════════════════════════════════
  // 1. 词典
  //    EXACT   : 整段文本完全匹配（比较时忽略首尾空白、大小写、
  //              空白折叠，"..." 与 "…" 视为相同）
  //    PATTERN : 动态文本规则
  // ════════════════════════════════════════════════════════════════
  const EXACT = new Map(Object.entries({
    "Model Select": "模型选择",
    "Character Select": "角色选择",
    "No Model Selected": "未选择模型",
    "Basic": "基础",
    "Pose": "姿势",
    "Parts Visibility": "部件显示",
    "Default Pose": "默认姿势",
    "If model is stuck — refresh the website.": "如果模型卡住了，请刷新网页。",
    "Pose adjustments apply after the animation finishes!": "姿势调整会在动画播放结束后生效！",
    "Info": "信息",
    "Member Cards": "成员卡牌",
    "Songs Meta": "歌曲元数据",
    "Others": "其他",
    "Other": "其他",
    "Events Tracker": "活动追踪",
    "Story Reader": "剧情阅读器",
    "Privacy Policy": "隐私政策",
    "Credits": "制作人员",
    "Developer Socials": "开发者社交账号",
    "Official Socials": "官方社交账号",
    "Made with": "使用",
    "ParamPosition": "位置",
    "ParamAngleX": "头部左右旋转",
    "ParamAngleY": "头部上下旋转",
    "ParamAngleZ": "头部倾斜",
    "ParamAngleXPlus20": "头部角度X＋20",
    "ParamAngleXMinus20": "头部角度X－20",
    "ParamAngleXPlus30": "头部角度X＋30",
    "ParamAngleXMinus30": "头部角度X－30",
    "ParamEyeLOpen": "左眼开闭",
    "ParamEyeROpen": "右眼开闭",
    "ParamEyeLSmile": "左眼微笑",
    "ParamEyeRSmile": "右眼微笑",
    "ParameyelidL": "左眼睑",
    "ParameyelidR": "右眼睑",
    "ParamEyeBallX": "眼球左右",
    "ParamEyeBallY": "眼球上下",
    "ParamEyeLScsle": "左眼缩放",
    "ParamEyeRScsle": "右眼缩放",
    "ParamEyeLScsle2": "左眼缩放2",
    "ParamEyeRScsle2": "右眼缩放2",
    "ParamEyeLHighlight": "左眼高光",
    "ParamEyeRHighlight": "右眼高光",
    "ParamEyeLShakingX2": "左眼抖动X2",
    "ParamEyeLShakingX3": "左眼抖动X3",
    "ParamEyeRShakingX": "右眼抖动X",
    "ParamEyeRShakingY": "右眼抖动Y",
    "ParameyeLlashShakingX": "左眼睫毛抖动X",
    "ParameyeRlashShakingX": "右眼睫毛抖动X",
    "ParamTear": "眼泪",
    "Param_tears_puru": "泪珠颤动",
    "ParamBrowLY": "左眉上下",
    "ParamBrowLX": "左眉左右",
    "ParamBrowLAngle": "左眉角度",
    "ParamBrowLForm": "左眉形状",
    "ParamBrowRY": "右眉上下",
    "ParamBrowRX": "右眉左右",
    "ParamBrowRAngle": "右眉角度",
    "ParamBrowRForm": "右眉形状",
    "ParamBrowR_eyebrows": "右眉附加",
    "Param_thinking_eyeeyebrows": "思考眉",
    "ParamMouthForm": "嘴型",
    "ParamMouthOpenY": "张嘴",
    "ParamMouthStrength": "嘴部力度",
    "ParamMouthside": "嘴部侧向",
    "ParamMouthupdawn": "嘴部上下",
    "ParamBreath": "呼吸",
    "ParamBodyPositionX": "身体位置X",
    "ParamBodyAngleX": "身体角度X",
    "ParamBodyAngleY": "身体角度Y",
    "ParamBodyAngleZ": "身体角度Z",
    "ParamBodyAngleY2": "身体角度Y2",
    "ParamBodyAngleupdown": "身体上下",
    "ParamShoulderL": "左肩",
    "ParamShoulderR": "右肩",
    "ParamChestX": "胸部X",
    "ParamChestY": "胸部Y",
    "ParamChestL": "左胸",
    "ParamChestR": "右胸",
    "ParamHairFront": "前发摆动",
    "ParamHairFront2": "前发摆动2",
    "ParamHairFront3": "前发摆动3",
    "ParamHairFrontY": "前发上下",
    "ParamHairFrontY2": "前发上下2",
    "ParamHairSide": "侧发摆动",
    "ParamHairSide2": "侧发摆动2",
    "ParamHairSide3": "侧发摆动3",
    "ParamHairSideY": "侧发上下",
    "ParamHairSideY2": "侧发上下2",
    "ParamHairBack": "后发摆动",
    "ParamHairBack2": "后发摆动2",
    "ParamHairBack3": "后发摆动3",
    "ParamHairBackY": "后发上下",
    "ParamHairBackY2": "后发上下2",
    "ParamCheek": "脸颊",
    "ParamCheek2": "脸颊2",
    "ParamFluffy": "蓬松",
    "ParamwWaistBelt1": "腰带1",
    "ParamwWaistBelt2": "腰带2",
    "ParamwWaistBeltFuwa1": "腰带摆动1",
    "ParamwWaistBeltFuwa2": "腰带摆动2",
    "Live2D stage": "Live2D 舞台",
    "Preparing the Live2D runtime…": "正在准备 Live2D 运行环境…",
    "Loading the model…": "正在加载模型…",
    "The model could not be shown": "模型无法显示",
    "The model data or Live2D Cubism Core did not arrive. The network may be down or the model site temporarily unavailable. Please try again later.": "模型数据或 Live2D Cubism Core 未能加载，可能是网络异常或模型站点暂时不可用，请稍后再试。",
    "Try again": "重试",
    "This browser cannot show Live2D models": "当前浏览器无法显示 Live2D 模型",
    "The Live2D viewer needs WebGL2. Please use a recent desktop or mobile browser.": "Live2D 浏览器需要 WebGL2，请使用较新的桌面或移动浏览器。",
    "Fullscreen": "全屏",
    "Exit fullscreen": "退出全屏",
    "Zoom in": "放大",
    "Zoom out": "缩小",
    "Reset zoom": "重置缩放",
    "Filter models": "筛选模型",
    "Search characters, costumes or model ids…": "搜索角色、服装或模型 ID…",
    "Type": "类型",
    "Show low quality copies": "显示低画质副本",
    "Other characters": "其他角色",
    "Choose a character": "选择角色",
    "Costumes": "服装",
    "Loading the model list…": "正在加载模型列表…",
    "The model list could not be loaded.": "模型列表加载失败。",
    "No Live2D models have been published yet.": "暂未发布 Live2D 模型。",
    "Pick a character": "选择一位角色",
    "Open the filter to choose a character by band; their costumes, motions and expressions are in the panel beside the model.": "打开筛选器按团体选择角色；服装、动作与表情在模型旁的面板中切换。",
    "About the model data": "关于模型数据",
    "moenotes reproduces what the game's own data packages contain: every model, motion and expression here comes from the game itself, and what you see in a browser does not represent the game's final quality. We do not offer free editing of model parameters: models posed with custom parameters can be badly distorted and are not how they look in the game, so please do not share them as official content.": "moenotes 致力于原样还原游戏数据包中的内容：这里的每个模型、动作与表情都来自游戏本身，网页上的呈现也不代表游戏的最终品质。本站不提供任意修改模型参数的功能——经过自定义参数改动的模型画面可能严重失真，并非游戏内的真实表现，请勿将其当作官方内容传播。",
    "Model controls": "模型控制",
    "The controls appear once the model is ready.": "模型就绪后即可操作。",
    "Motions": "动作",
    "Expressions": "表情",
    "This model has no expressions.": "此模型没有表情。",
    "Loop the motion": "循环播放动作",
    "Options": "选项",
    "Physics": "物理效果",
    "Breathing": "呼吸",
    "Pause": "暂停",
    "Resume": "继续",
    "Back to idle": "回到待机",
    "Low quality": "低画质",
    "Default": "默认",
    "Story": "剧情",
    "Live": "演出",
    "Side": "配角",
    "Casual": "私服",
    "Spring": "春",
    "Summer": "夏",
    "Winter": "冬",
    "School uniform": "制服",
    "High school": "高中",
    "Middle school": "初中",
    "1st year": "一年级",
    "2nd year": "二年级",
    "3rd year": "三年级",
    "Live outfit": "演出服",
    "Roomwear": "居家服",
    "Part-time job": "打工",
    "Live house": "Live House",
    "Caretaker": "看护",
    "Childhood": "童年",
    "Detective": "侦探",
    "Idol": "偶像",
    "Virtual": "虚拟形象",
    "Voice only": "仅语音",
    "Suit": "西装",
    "Tracksuit": "运动服",
    "Maid": "女仆",
    "Still": "静态",
    "Mask": "面具",
    "Silhouette": "剪影",
    "Glasses": "眼镜",
    "Novelty glasses": "搞笑眼镜",
    "Sunglasses": "墨镜",
    "Hat": "帽子",
    "Hair down": "散发",
    "Twin tails": "双马尾",
    "Our Notes Live2D Viewer": "Our Notes Live2D 浏览器",
    "Browse every Live2D model of BanG Dream! Our Notes by character and costume right in your browser: idle motion, blinking, breathing and physics as in the story, with every motion and expression on demand.": "按角色与服装浏览 BanG Dream! Our Notes 的全部 Live2D 模型：在浏览器中重现剧情里的待机动作、眨眼、呼吸与物理效果，并可随时切换每一个动作与表情。",
    "ALL": "全部",
    "Open sidebar": "打开侧边栏",
    "Close sidebar": "关闭侧边栏",
    "Open settings": "打开设置",
    "Open command palette": "打开命令面板",
    "Skip to content": "跳到正文",
    "Expand navigation groups": "展开导航分组",
    "Expand sibling pages": "展开同组页面",
    "Search pages or features...": "搜索页面或功能...",
    "No results found": "没有找到结果",
    "Shortcuts": "快捷键",
    "Home": "首页",
    "Database": "资料库",
    "Music": "音乐",
    "Events": "活动",
    "Tools": "工具",
    "About": "关于",
    "Characters": "角色",
    "Cards": "卡牌",
    "Support Cards": "支援卡",
    "Music List": "音乐列表",
    "Event List": "活动一览",
    "Gacha": "招募",
    "Missions & Rewards": "任务与奖励",
    "Titles": "称号",
    "Backgrounds": "背景",
    "Stickers": "贴纸",
    "Comics": "漫画",
    "Items": "持有物",
    "Band Gear": "乐队道具",
    "Main Story": "主线剧情",
    "Event Story": "活动剧情",
    "Bond Stories": "羁绊剧情",
    "Other Stories": "其它剧情",
    "Post-live Talks": "演出结束会话",
    "Home Stories": "主页地点剧情",
    "Tutorial Stories": "教程剧情",
    "Asset Viewer": "资产查看器",
    "Design System": "设计系统",
    "Chart Previewer": "谱面预览器",
    "Exchange Shop": "交换所",
    "Live2D Viewer": "Live2D 浏览器",
    "Story Player": "剧情播放器",
    "News": "游戏公告",
    "Event Tracker": "活动追踪器",
    "Song Rankings": "歌曲排行榜",
    "Song Meta": "歌曲meta",
    "Search": "搜索",
    "Shop": "商店",
    "Missions": "任务",
    "Real Lives": "现实演出",
    "Birthday Stories": "生日剧情",
    "Help": "帮助",
    "Chart Table": "谱面一览",
    "Playlists": "歌单",
    "Calendar": "日历",
    "Catalog": "目录",
    "License": "许可",
    "Terms of Use": "使用条款",
    "Privacy": "隐私",
    "Search cards, songs, characters, stories…": "搜索卡牌、歌曲、角色、剧情…",
    "Filter by type": "按类型筛选",
    "See all results": "查看全部结果",
    "All": "全部",
    "Pages": "页面",
    "Songs": "歌曲",
    "Stories": "剧情",
    "Rewards": "奖励",
    "Exchange Shops": "交换所",
    "Settings": "设置",
    "Some languages use machine translation and may contain inaccuracies.": "部分语言使用机器翻译，可能存在不准确之处。",
    "Theme": "主题模式",
    "Default game server": "默认区服",
    "System": "跟随系统",
    "Light": "浅色",
    "Dark": "深色",
    "Settings sections": "设置分类",
    "General": "通用",
    "Data": "数据",
    "Theme color": "主题色",
    "Density": "界面密度",
    "Comfortable": "宽松",
    "Compact": "紧凑",
    "Song titles": "歌曲名",
    "Always show Japanese titles": "始终显示日文曲名",
    "Show every song under its original Japanese title, whatever the site language.": "无论网站语言如何，都以日文原名显示歌曲。",
    "Download cache": "下载缓存",
    "Cached": "已缓存",
    "Live2D models": "Live2D 模型",
    "Images": "图片",
    "Audio": "音频",
    "3D charts": "3D 谱面",
    "Characters of the Live2D viewer and the stories": "Live2D 浏览器与剧情中的角色",
    "Pictures on the pages, and the stories' backgrounds and still pictures": "页面上的图片，以及剧情的背景与插图",
    "Voices, music and sound effects of the stories, and audio on the pages": "剧情的语音、背景音乐与音效，以及页面上的音频",
    "Songs, stages and effects of the 3D chart preview": "3D 谱面预览的歌曲、舞台与特效",
    "Fonts, interface and scripts of the stories, and the game data the pages read": "剧情的字体、界面与剧本，以及页面读取的游戏数据",
    "Calculating…": "正在计算…",
    "Clear": "清除",
    "Clear all cached data": "清除全部缓存",
    "Clearing…": "正在清除…",
    "This browser does not let the site keep files (private browsing can block it), so they download each time.": "当前浏览器不允许本站保存文件（无痕模式可能会禁止），每次打开都会重新下载。",
    "Close": "关闭",
    "Clear cache": "清除缓存",
    "Refresh": "刷新",
    "Open": "打开",
    "View group": "查看分组",
    "Loading": "正在加载",
    "Filter": "筛选",
    "Sort": "排序",
    "Reset filters": "重置筛选",
    "Collapse": "收起",
    "Expand": "展开",
    "Open filter": "打开筛选器",
    "Filters moved to the side": "筛选器已移至侧边",
    "Tap the tab on the left to reveal or fold this starry filter drawer anytime.": "轻触左侧标签，便可随时唤出或收拢这片星芒筛选器。",
    "Got it": "知道了",
    "Date range": "日期范围",
    "From": "开始",
    "To": "结束",
    "This browser may not show the site properly": "当前浏览器可能无法正常显示本站",
    "In-app browsers and browsers with an outdated engine can break the layout, audio and chart previews.": "QQ、微信等应用的内置浏览器，或内核较旧的浏览器，可能导致页面排版错乱、音频与谱面预览无法使用。",
    "Tap the ··· menu in the top-right corner and choose “Open in browser”.": "可点击右上角「···」，选择「在浏览器中打开」。",
    "Every browser on iPhone and iPad runs on Safari's engine, which updates with iOS. Update to the latest iOS in Settings › General › Software Update.": "iPhone 与 iPad 上的浏览器都使用 Safari 内核，内核随 iOS 一同更新。请前往「设置 › 通用 › 软件更新」将 iOS 更新到最新版本。",
    "For the full experience, open this site in Chrome or Edge.": "推荐使用狐猴浏览器（Lemur），它基于新版 Chromium 内核，可在国内应用商店直接下载。",
    "For the full experience, open this site in Edge or Chrome.": "推荐使用 Microsoft Edge，国内网络即可直接下载。",
    "Dismiss": "关闭提示",
    "A handwritten notebook for BanG Dream! Our Notes, dedicated to the stage and the stars.": "写给舞台与星光的 Our Notes 漫步手帐",
    "Explore": "探索",
    "Sister Sites": "姐妹站",
    "Friendly Sites": "友情站",
    "Contact & Feedback": "联系与反馈",
    "Bug Report": "错误报告",
    "Source on GitHub": "GitHub 源码",
    "Legal": "法律信息",
    "© 2026 Moenotes · A Notebook of Girls and Starlight": "© 2026 Moenotes · 少女与星光的手帐",
    "Version": "版本",
    "Materials archived in this notebook are presented solely for display and appreciation. Game copyrights belong to Bushiroad / Craft Egg / Ishimori. This is an unofficial fan-made notebook crafted with love to cherish every memory of music and youth.": "本手帐收录素材仅作展示与欣赏，游戏相关版权皆归属于 Bushiroad / Craft Egg / Ishimori。这是一个由同好倾心搭建的非官方粉丝笔记本，愿与你一同珍藏每一段关于音乐与少女的记忆。",
  }));

  // 词典里没有、但页面上确实会出现的条目（人工补充）
  for (const [en, zh] of Object.entries({
    'Quick filter': '快速筛选',
    'Open quick filter': '打开筛选器',
    'Reset': '重置筛选',
    'Search...': '搜索…',
  })) {
    if (!EXACT.has(en)) EXACT.set(en, zh);
  }

  // 模板条目：{占位符} 已转成捕获组，译文里的 {占位符} 对应 $1、$2 …
  const PATTERN = [
    [/^Auto \((.+?)\)$/, "自动（$1）"],
    [/^(.+?) files$/, "$1 个文件"],
    [/^Get (.+?)$/, "下载 $1"],
    [/^Discord community \((.+?)\)$/, "Discord 社区（$1）"],
    [/^(.+?) QQ Group \((.+?)\)$/, "$1 QQ群（$2）"],
  ];

  /** 归一化：折叠空白、统一省略号，减少因排版差异导致的漏译 */
  function norm(s) {
    return s.replace(/\s+/g, ' ').replace(/\.\.\./g, '…').trim();
  }

  const lower = new Map();
  for (const [en, zh] of EXACT) lower.set(norm(en).toLowerCase(), zh);

  /** 单个片段（不含 " · " 组合）的翻译 */
  function translateOne(key) {
    const hit = lower.get(key.toLowerCase());
    if (hit && hit !== key) return hit;
    for (const [re, zh] of PATTERN) {
      if (re.test(key)) {
        const out = key.replace(re, zh);
        if (out !== key) return out;
      }
    }
    return null;
  }

  // 站点标题的固定后缀（站点自己的中文版把 Database 译作「资料库」，与导航一致）
  const TITLE_SUFFIX_EN = ' | BanG Dream! Our Notes Database';
  const TITLE_SUFFIX_ZH = ' | BanG Dream! Our Notes 资料库';

  /** @returns {string|null} 译文；无需翻译时返回 null */
  function translate(raw) {
    if (!raw) return null;
    const key = norm(raw);
    if (!key) return null;
    // 已经是中文（或含中文）就不再处理，天然避免改写循环
    if (/[\u4e00-\u9fff]/.test(key)) return null;

    const whole = translateOne(key);
    if (whole) return whole;

    // 模型自带的参数 / 部件 ID（ParamAngleX、hand_R_01…）—— 词典层之后按字词表拼
    const param = translateParamLabel(key);
    if (param) return param;

    // 模型自带动作 / 表情文件名（mtn_angry01_C、exp_cry02.exp3）
    const asset = translateAssetName(key);
    if (asset) return asset;

    // 页面标题形如「Live2D Viewer | BanG Dream! Our Notes Database」
    if (key.endsWith(TITLE_SUFFIX_EN)) {
      const head = key.slice(0, -TITLE_SUFFIX_EN.length);
      return (translate(head) || head) + TITLE_SUFFIX_ZH;
    }

    // 组合标签，例如 "Casual · 1st year"、"Story · Live outfit"
    if (key.includes('·')) {
      let changed = false;
      const parts = key.split(/\s*·\s*/).map((part) => {
        const t = translateOne(part);
        if (t) { changed = true; return t; }
        return part;
      });
      if (changed) return parts.join(' · ');
    }
    return null;
  }
  // __DICT_END__

  // ════════════════════════════════════════════════════════════════
  // 1.5 模型参数 / 部件名兜底（站点各语言版本都原样显示这些 ID）
  //   页面上那些滑块标题与部件勾选项来自模型清单本身，例如
  //   ParamAngleX、ParamEyeLSmile、paramArmL_layer2、hand_R_01。
  //   站点的 i18n 词典里根本没有这些字符串，所以这里按「已知字词」逐段拼中文：
  //   全部分段都认识才给译文，只要有一个生词就原样保留英文（宁可不译，也不乱译）。
  //   注意：本段必须在词典生成区段（__DICT_END__ 之前）之外，否则会被 build-dict 覆盖。
  // ════════════════════════════════════════════════════════════════
  const PARAM_TOKENS = {
    // 部位
    position: '位置', head: '头部', neck: '颈部', body: '身体', chest: '胸部', chests: '胸部',
    shoulder: '肩', arm: '臂', hand: '手', hair: '头发', face: '脸',
    eye: '眼', eyeball: '眼球', ball: '球', eyelid: '眼睑', lash: '睫毛',
    brow: '眉', eyebrow: '眉毛', eyebrows: '眉毛',
    mouth: '嘴巴', cheek: '脸颊', tear: '眼泪', tears: '眼泪',
    clothes: '服装', cloth: '服装', cloths: '服装', mask: '面具', emo: '表情',
    // 服饰 / 部件
    frills: '褶边', frill: '褶边', waist: '腰部', ribbon: '缎带', belt: '腰带',
    piasu: '耳环', fluffy: '蓬松', fuwa: '摆动', layer: '图层',
    // 修饰
    front: '前', side: '侧', back: '后', updown: '上下', updawn: '上下', uwa: '上层',
    angle: '角度', open: '开闭', form: '形状', strength: '力度', highlight: '高光',
    shaking: '抖动', scale: '缩放', scsle: '缩放', add: '附加', contraction: '收缩',
    breath: '呼吸', plus: '加', minus: '减', mtn: '动作', puru: '颤抖',
    // 表情
    smile: '微笑', bsmile: '苦笑', angry: '生气', sad: '悲伤', cry: '哭泣',
    serious: '认真', surprised: '惊讶', surprise: '惊讶', shy: '害羞', sneer: '冷笑',
    pale: '苍白', dispair: '绝望', despair: '绝望', upset: '难过', panic: '惊慌',
    painful: '痛苦', fun: '开心', thinking: '思考', idle: '待机', kime: '定格',
    nervous: '紧张', denial: '否认', nod: '点头', question: '疑问', look: '张望',
    bye: '告别', check: '确认', sing: '歌唱', maskoff: '摘面具', shadow: '阴影',
  };
  const PARAM_PARTS = new Set(['position', 'head', 'neck', 'body', 'chest', 'chests', 'shoulder',
    'arm', 'hand', 'hair', 'face', 'eye', 'eyeball', 'ball', 'eyelid', 'lash', 'brow', 'eyebrow',
    'eyebrows', 'mouth', 'cheek', 'tear', 'tears', 'clothes', 'cloth', 'cloths', 'mask', 'emo',
    'frills', 'frill', 'waist', 'ribbon', 'belt', 'piasu', 'fluffy', 'layer']);
  const PARAM_IGNORE = new Set(['param', 'parameter', 'w']);
  const PARAM_AXIS = new Set(['x', 'y', 'z']);

  /** 把一个未知 token 贪心切成若干个已知词；切不动返回 null（宁可不译） */
  function expandParamToken(t) {
    if (PARAM_TOKENS[t]) return [t];
    const parts = [];
    let i = 0;
    while (i < t.length) {
      let matched = null;
      for (let j = t.length; j > i; j--) {
        const cand = t.slice(i, j);
        if (PARAM_TOKENS[cand]) { matched = cand; break; }
      }
      if (!matched) return null;
      parts.push(matched);
      i += matched.length;
    }
    return parts.length ? parts : null;
  }

  /** @returns {string|null} 模型参数 ID 的中文名；有生词就返回 null（保持英文） */
  function translateParamLabel(key) {
    // 只处理参数 / 部件 ID 形态的字符串，避免误伤普通文案
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
    if (!/^(param|hand_)/i.test(key)) return null;

    // 去掉 Param 前缀后按下划线与驼峰切成字词
    const tokens = [];
    for (const chunk of key.replace(/^param(eter)?/i, '').split(/_+/)) {
      if (!chunk) continue;
      for (const t of chunk.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[A-Za-z])(?=\d)|(?<=\d)(?=[A-Za-z])/)) {
        if (t) tokens.push(t);
      }
    }
    if (!tokens.length) return null;

    // 先把 token 正规化成「已知词 / 数字 / 单字母 / 左右标记」的扁平序列。
    // 这一步负责处理粘连写法：eyeLlash -> eye + l + lash
    const prim = [];
    for (const tok of tokens) {
      const t = tok.toLowerCase();
      if (PARAM_IGNORE.has(t)) continue;
      if (PARAM_AXIS.has(t) || /^\d+$/.test(t) || t.length === 1) { prim.push(t); continue; }
      let words = expandParamToken(t);
      if (!words && (t[0] === 'l' || t[0] === 'r')) {
        const rest = expandParamToken(t.slice(1));
        if (rest) words = [t[0], ...rest];
      }
      if (!words) return null;                 // 有生词 => 整串不译
      for (const w of words) prim.push(w);
    }
    if (!prim.length) return null;

    const out = [];
    let pending = '';       // 悬空的「左 / 右」，等下一个部位词
    let prevPart = false;   // 上一个词是不是部位
    for (const t of prim) {
      if (PARAM_IGNORE.has(t)) continue;
      if (PARAM_AXIS.has(t)) { out.push(t.toUpperCase()); prevPart = false; continue; }
      if (/^\d+$/.test(t)) { out.push(t); prevPart = false; continue; }
      if (t === 'l' || t === 'r') {
        const zhSide = t === 'l' ? '左' : '右';
        if (prevPart) out[out.length - 1] = zhSide + out[out.length - 1];
        else pending = zhSide;
        prevPart = false;
        continue;
      }
      if (t.length === 1) { out.push(t.toUpperCase()); prevPart = false; continue; }  // A/B/C 变体标记
      const zh = PARAM_TOKENS[t];
      if (!zh) return null;
      const isPart = PARAM_PARTS.has(t);
      if (pending && isPart) { out.push(pending + zh); pending = ''; }
      else out.push(zh);
      prevPart = isPart;
    }
    if (pending) return null;                  // 悬空的左/右没落到部位上 => 不译
    let joined = out.join('');
    if (!joined || joined === key) return null;
    // 中文习惯说「前发 / 后发 / 侧发」，而不是「头发前」
    joined = joined.replace(/头发前/g, '前发').replace(/头发后/g, '后发').replace(/头发侧/g, '侧发');
    // 只有数字（Param10 之类）时补个「参数」，否则光一个数字太费解
    return /^\d+$/.test(joined) ? '参数' + joined : joined;
  }
  /**
   * 模型自带的动作 / 表情文件名（mtn_angry01_C、exp_cry02.exp3）—— 情绪词认识才译，
   * 其余部分原样保留（01 编号、C/L/R 左右标记、扩展名一律照抄）。
   * @returns {string|null}
   */
  function translateAssetName(key) {
    let m = /^mtn_([a-z]+?)(\d+)_([A-Za-z]+)$/.exec(key);
    if (m) {
      const zh = PARAM_TOKENS[m[1].toLowerCase()];
      if (zh) return zh + m[2] + '（' + m[3] + '）';
      return null;
    }
    m = /^exp_([a-z]+?)(\d+)(?:\.exp3)?$/.exec(key);
    if (m) {
      const zh = PARAM_TOKENS[m[1].toLowerCase()];
      if (zh) return zh + m[2];
      return null;
    }
    return null;
  }
  /**
   * 看起来像「模型自带字段」的串：参数、部件、动作、表情文件名。
   * 这类串站点的脚本可能直接拿去做参数传递，因此一律不许改 DOM 原文。
   * @returns {boolean}
   */
  function isModelId(raw) {
    return /^(?:param|hand_|mtn_|exp_)/i.test(String(raw == null ? '' : raw).trim());
  }
  // __PARAM_END__

  // ════════════════════════════════════════════════════════════════
  // 2. DOM 改写
  // ════════════════════════════════════════════════════════════════
  function isSkipped(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return true;
    if (el.closest && (el.closest('#' + HOST_ID) || el.closest('#' + PANEL_ID))) return true;
    for (let p = el; p; p = p.parentElement) {
      if (SKIP_TAGS.has(p.tagName)) return true;
      if (p.isContentEditable) return true;
    }
    return false;
  }

  function walkText(root, out) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (isSkipped(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) out.push(n);
  }

  function collectElements(root, out) {
    if (root.nodeType === 1) out.push(root);
    if (!root.querySelectorAll) return;
    for (const el of root.querySelectorAll('*')) {
      if (!isSkipped(el)) out.push(el);
    }
  }

  let scheduled = false;
  let observer = null;
  let paused = false;
  const pending = new Set();

  // 诊断用：改写次数 + 没匹配上的英文原文（攒起来方便补词表）
  const stats = { translated: 0, marked: 0, formLabeled: 0, probe: null };
  const unmatched = new Map();
  // 抽样记录：哪些元素被译了、用的哪种画法、伪元素有没有真的画出来
  const samples = [];

  function addSample(el, how, zh, afterOk) {
    try {
      // 滚动窗口：留最近 8 个，这样用户刚展开的下拉/刚点的按钮一定在列表里
      if (samples.length >= 8) samples.shift();
      let size = '';
      if (el && typeof el.getBoundingClientRect === 'function') {
        const r = el.getBoundingClientRect();
        size = Math.round(r.width) + 'x' + Math.round(r.height);
      }
      samples.push({
        tag: String((el && el.tagName) || '?'),
        how,
        zh,
        size,
        raw: String((el && el.textContent) || '').trim().slice(0, 40),
        after: afterOk === undefined || afterOk === null ? null : !!afterOk,
      });
    } catch (_) { /* 抽样失败无所谓 */ }
  }

  function sampleLines() {
    return samples.map((s) => `${s.tag}${s.size ? ' ' + s.size : ''}\t${s.how}\t::after=${s.after === null ? '未检测' : (s.after ? 'ok' : '没画出来')}\t${s.raw} → ${s.zh}`);
  }

  /** 注入伪元素样式：让中文以「画出来」的方式出现，而不占用 textContent */
  function mountStyle() {
    try {
      if (document.getElementById(STYLE_ID)) return;
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = ZH_CSS;
      (document.head || document.documentElement || document.body).appendChild(s);
    } catch (err) { LOG('注入样式失败', err); }
  }

  /**
   * <option> / <optgroup> 这类表单控件内部画不了 ::after：把原文藏掉就等于整行消失
   * （线上现象：动作下拉列表一片空白、但条目还能点）。这类元素一律改用 label 属性。
   */
  function isFormLabel(el) {
    const tag = String((el && el.tagName) || '').toUpperCase();
    if (tag === 'OPTION' || tag === 'OPTGROUP') return true;
    try {
      if (typeof el.closest === 'function' && el.closest('select, datalist')) return true;
    } catch (_) { /* closest 不支持就算了 */ }
    return false;
  }

  /** 中文写进 label 属性：界面显示中文，textContent / value 仍是英文原文 */
  function setFormLabel(el, zh) {
    try {
      if (el.getAttribute && el.getAttribute(ZH_ATTR) === zh) return;
      if (el.getAttribute) el.setAttribute(ZH_ATTR, zh);
      el.setAttribute('label', zh);
      if (el.classList) el.classList.remove(ZH_CLASS);   // 清掉旧版留下的 class，否则整行看不见
      stats.marked++;
      stats.formLabeled++;
      addSample(el, 'label 属性', zh, null);
    } catch (err) { LOG('写表单控件译文出错', err, el); }
  }

  /**
   * 自检：伪元素真的把中文画出来了吗？（只抽查最初几个被标记的元素）
   * 看不见中文时，这一条能直接指出是 content 没生效、字号为 0 还是被 visibility 藏了。
   */
  function probeMark(el) {
    if (typeof getComputedStyle !== 'function') return null;
    try {
      const cs = getComputedStyle(el, '::after');
      if (!cs) return null;
      const content = cs.content;
      const fs = parseFloat(cs.fontSize || '0') || 0;
      const vis = cs.visibility;
      const ok = !!content && content !== 'none' && content !== 'normal' && fs > 0 && vis !== 'hidden';
      // 顺带把「元素自己的排版」也记下来：万一伪元素说通过、画面上却还是空的，
      // 这几项（尺寸 0 / overflow:hidden / display:contents 之类）就能直接指出被谁裁掉了。
      let own = null;
      try {
        const cs2 = getComputedStyle(el);
        let rect = '';
        if (el && typeof el.getBoundingClientRect === 'function') {
          const r = el.getBoundingClientRect();
          rect = Math.round(r.width) + 'x' + Math.round(r.height);
        }
        own = {
          display: String(cs2.display), overflow: String(cs2.overflow),
          whiteSpace: String(cs2.whiteSpace), rect,
        };
      } catch (_) { own = null; }
      stats.probe = {
        ok, content: String(content), fontSize: String(cs.fontSize),
        visibility: String(vis), own,
      };
      if (!ok) {
        stats.probe.zh = el.getAttribute(ZH_ATTR);
        LOG('伪元素没画出来（中文会看不见）：', stats.probe, el);
      }
      return ok;
    } catch (err) { return null; /* 自检本身不许影响主流程 */ }
  }

  /**
   * 把中文挂到元素上，用 CSS 伪元素显示，DOM 里的英文原文保持不动。
   * 只在该元素没有别的子元素、文本恰好就是那一串时才用，避免误伤图标等内容。
   */
  function markChinese(el, zh) {
    try {
      if (el.getAttribute && el.getAttribute(ZH_ATTR) === zh
        && el.classList && el.classList.contains(ZH_CLASS)) return;   // 已是这个译文，别重复写
      if (typeof getComputedStyle === 'function') {
        // 只接受正数字号：元素一旦带上 .bdn-zh-id，自身字号就是 0 了，绝不能再把 0 写回变量
        const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
        if (fs > 0 && el.style && el.style.setProperty) el.style.setProperty('--bdn-zh-fs', fs + 'px');
      }
      el.setAttribute(ZH_ATTR, zh);
      if (el.classList) el.classList.add(ZH_CLASS);
      stats.marked++;
      addSample(el, '伪元素', zh, stats.marked <= 3 ? probeMark(el) : undefined);
    } catch (err) { LOG('写伪元素译文出错', err, el); }
  }

  function noteUnmatched(raw) {
    const s = raw.trim();
    if (s.length < 2 || s.length > 160) return;
    if (!/[A-Za-z]/.test(s)) return;
    if (/[\u4e00-\u9fff]/.test(s)) return;
    if (!unmatched.has(s) && unmatched.size >= 600) return;
    unmatched.set(s, (unmatched.get(s) || 0) + 1);
  }

  // 逐节点 try/catch：某个节点出问题不允许拖垮整批刷新
  function applyToText(node) {
    try {
      const raw = node.nodeValue;
      // 模型字段：DOM 原文一个字都不动，中文走伪元素
      if (isModelId(raw)) {
        const zh = translate(raw);
        if (!zh) { if (dictOn) noteUnmatched(raw); return; }
        const el = node.parentElement;
        if (!el || !el.children || el.children.length !== 0) return;
        if (String(el.textContent).trim() !== raw.trim()) return;
        // 表单控件（<option>/<optgroup>）画不了伪元素：藏了原文却没东西可显示，
        // 下拉列表会变成「空白但能点」——改用 label 属性显示中文（textContent/value 仍是英文）
        if (isFormLabel(el)) { setFormLabel(el, zh); return; }
        markChinese(el, zh);
        return;
      }
      const zh = translate(raw);
      if (!zh) { if (dictOn) noteUnmatched(raw); return; }
      stats.translated++;
      const lead = raw.match(/^\s*/)[0];
      const tail = raw.match(/\s*$/)[0];
      const next = lead + zh + tail;
      if (next !== raw) node.nodeValue = next;   // 改写后 translate() 返回 null，天然收敛
    } catch (err) { LOG('改写文本出错', err, node); }
  }

  function applyToElement(el) {
    try {
      for (const attr of ATTRS) {
        if (!el.hasAttribute || !el.hasAttribute(attr)) continue;
        const raw = el.getAttribute(attr);
        // 动作/表情按钮的 title 就是动作 ID（例如 title="mtn_angry01_C"），碰了会点不动
        if (isModelId(raw)) continue;
        const zh = translate(raw);
        if (zh && zh !== raw) el.setAttribute(attr, zh);
      }
    } catch (err) { LOG('改写属性出错', err, el); }
  }

  function syncTitle() {
    const zh = translate(document.title);
    if (zh) document.title = zh;
  }

  function flush() {
    scheduled = false;
    if (!pending.size) return;
    const roots = [...pending];
    pending.clear();

    const texts = [];
    const els = [];
    for (const r of roots) {
      if (!r.isConnected) continue;
      if (r.nodeType === 3) texts.push(r);
      else collectElements(r, els);
      if (r.nodeType !== 3) walkText(r, texts);
    }
    for (const t of texts) applyToText(t);
    for (const e of els) applyToElement(e);
    syncTitle();
  }

  function schedule(node) {
    if (!dictOn || paused) return;
    pending.add(node);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flush);
  }

  function startObserving() {
    if (!dictOn) return;
    if (observer) { try { observer.disconnect(); } catch (_) { /* 忽略 */ } }
    observer = new MutationObserver((records) => {
      if (paused) return;
      for (const m of records) {
        if (m.type === 'characterData') schedule(m.target);
        else if (m.type === 'attributes') schedule(m.target);
        else for (const n of m.addedNodes) {
          if (n.nodeType === 1 || n.nodeType === 3) schedule(n);
        }
      }
    });
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
  }

  /** 运行期总开关（控制台排查用）：__bdnL2dZh.pause() / .resume() */
  function pause() {
    paused = true;
    pending.clear();
    if (observer) { try { observer.disconnect(); } catch (_) { /* 忽略 */ } }
    LOG('已暂停改写');
  }

  function resume() {
    paused = false;
    startObserving();
    schedule(document.documentElement);
    LOG('已恢复改写');
  }

  // ════════════════════════════════════════════════════════════════
  // 3. 左下角 中/英 切换
  // ════════════════════════════════════════════════════════════════
  // 站点没有可切换的语言地址，所以「切到英文」= 停用词典后重新加载，
  // 让浏览器拿到未被改写的原文（无法只靠 DOM 还原，因为原文已被覆盖）。
  function switchLanguage(lang) {
    try {
      if (lang === 'en') {
        localStorage.setItem(PREF_KEY, '0');
        sessionStorage.setItem(GUARD_KEY, '1');          // 别再自动跳回中文
      } else {
        localStorage.setItem(PREF_KEY, '1');
        sessionStorage.removeItem(GUARD_KEY);
      }
    } catch (_) { /* 忽略 */ }

    if (lang === 'zh' && hasPrefix()) {
      location.replace(stripPrefix() + location.search + location.hash);
      return;
    }
    location.reload();
  }

  const BTN_CSS = [
    'font:600 12px/1 system-ui,"Microsoft YaHei",sans-serif',
    'padding:8px 12px', 'border-radius:999px', 'cursor:pointer',
    'border:1px solid rgba(255,255,255,.28)',
    'background:rgba(20,20,28,.82)', 'color:#fff',
    'backdrop-filter:blur(8px)', 'box-shadow:0 4px 14px rgba(0,0,0,.35)',
  ].join(';');

  function buildToggle() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = BTN_CSS;

    if (prefOn) {
      btn.textContent = 'EN';
      btn.title = '当前：中文 · 点击切换到英文';
    } else {
      btn.textContent = '中';
      btn.title = '当前：English · 点击切换到中文';
    }
    btn.addEventListener('click', () => switchLanguage(prefOn ? 'en' : 'zh'));
    return btn;
  }

  // ── 诊断面板：翻了多少、还有哪些英文没翻 ──────────────────────
  function unmatchedRows() {
    return [...unmatched.entries()].sort((a, b) => b[1] - a[1]);
  }

  function exportText() {
    const rows = unmatchedRows();
    const lines = rows.map(([s, n]) => `${n}\t${s}`);
    const sLines = sampleLines();
    return `# bdon-live2d-zh v${VERSION} 未匹配文案（${rows.length} 条）\n`
      + `# 已改写 ${stats.translated} 处 · 模型字段 ${stats.marked} 处`
      + `（其中下拉选项 ${stats.formLabeled} 项） · 词典 ${EXACT.size} 条\n`
      + (sLines.length
        ? `# 模型字段元素抽样（元素 尺寸\t画法\t伪元素自检\t原文 → 译文）\n${sLines.join('\n')}\n`
        : '')
      + lines.join('\n');
  }

  function buildHelp() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '?';
    btn.title = '诊断：看看到底翻了多少、还有哪些没翻';
    btn.style.cssText = BTN_CSS + ';width:34px;padding:8px 0;text-align:center';
    btn.addEventListener('click', togglePanel);
    return btn;
  }

  function togglePanel() {
    const old = document.getElementById(PANEL_ID);
    if (old) { old.remove(); return; }

    const rows = unmatchedRows();
    const box = document.createElement('div');
    box.id = PANEL_ID;
    box.style.cssText = [
      'position:fixed', 'left:16px', 'bottom:64px', 'z-index:2147483647',
      'width:min(620px,calc(100vw - 32px))', 'max-height:70vh', 'overflow:auto',
      'background:rgba(16,16,24,.96)', 'color:#e9e9f2',
      'font:12px/1.6 ui-monospace,Consolas,"Microsoft YaHei",monospace',
      'border:1px solid rgba(255,255,255,.22)', 'border-radius:12px',
      'padding:12px 14px', 'box-shadow:0 10px 30px rgba(0,0,0,.45)',
    ].join(';');

    const head = document.createElement('div');
    head.style.cssText = 'font-weight:700;margin-bottom:6px';
    head.textContent = `Live2D 汉化 · 诊断 v${VERSION}`;

    const info = document.createElement('div');
    info.textContent = `词典 ${EXACT.size} 条 · 词典层${dictOn ? '开启' : '关闭'}`
      + ` · 已改写 ${stats.translated} 处 · 模型字段 ${stats.marked} 处`
      + `（下拉选项 ${stats.formLabeled} 项） · 未匹配 ${rows.length} 条`;

    const tip = document.createElement('div');
    tip.style.cssText = 'opacity:.72;margin:6px 0 8px';
    tip.textContent = '「未匹配」= 页面上仍是英文、词典里没有的文案。把下面的内容发给我，就能补进词表。';

    const tip2 = document.createElement('div');
    tip2.style.cssText = 'opacity:.72;margin:0 0 8px';
    tip2.textContent = '模型字段（Param…、hand_…、mtn_…、exp_…）原文保留英文，中文用 CSS 伪元素画出来，'
      + '这样站点的按钮不会因为文本被改而失灵。';

    let probeEl = null;
    if (stats.probe) {
      probeEl = document.createElement('div');
      probeEl.style.cssText = 'margin:0 0 8px;font-weight:700;color:'
        + (stats.probe.ok ? '#7ee787' : '#ff9d9d');
      const p = stats.probe;
      const det = `${p.content} · ${p.fontSize} · ${p.visibility}`
        + (p.own ? ` · ${p.own.display} · overflow:${p.own.overflow} · ${p.own.rect}` : '');
      probeEl.textContent = p.ok
        ? '伪元素自检：通过（中文已画出来）· ' + det
        : '伪元素自检：失败，中文看不见 —— ' + JSON.stringify(stats.probe);
    }

    // 抽样：哪些元素译了、怎么译的、伪元素到底有没有画出来
    let sampleEl = null;
    const sLines = sampleLines();
    if (sLines.length) {
      sampleEl = document.createElement('div');
      sampleEl.style.cssText = 'margin:0 0 8px;white-space:pre;overflow:auto;max-height:14vh;opacity:.9';
      sampleEl.textContent = '模型字段抽样（元素 尺寸 · 画法 · 伪元素自检 · 原文 → 译文）：\n' + sLines.join('\n');
    }

    const ta = document.createElement('textarea');
    ta.readOnly = true;
    ta.value = exportText();
    ta.style.cssText = [
      'width:100%', 'height:34vh', 'box-sizing:border-box',
      'background:rgba(0,0,0,.35)', 'color:#dcdce8', 'border-radius:8px',
      'border:1px solid rgba(255,255,255,.18)', 'padding:8px',
      'font:inherit', 'white-space:pre', 'resize:vertical',
    ].join(';');

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap';

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = '复制未匹配文案';
    copy.style.cssText = BTN_CSS;
    copy.addEventListener('click', () => {
      let done = false;
      try {
        ta.select();
        done = document.execCommand('copy');
      } catch (_) { done = false; }
      const flash = (txt) => {
        copy.textContent = txt;
        setTimeout(() => { copy.textContent = '复制未匹配文案'; }, 1800);
      };
      if (done) { flash('已复制 ✓'); return; }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(ta.value).then(
          () => flash('已复制 ✓'),
          () => flash('请手动全选复制'),
        );
      } else {
        flash('请手动全选复制');
      }
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '关闭';
    close.style.cssText = BTN_CSS;
    close.addEventListener('click', () => box.remove());

    bar.appendChild(copy);
    bar.appendChild(close);
    box.appendChild(head);
    box.appendChild(info);
    box.appendChild(tip);
    box.appendChild(tip2);
    if (probeEl) box.appendChild(probeEl);
    if (sampleEl) box.appendChild(sampleEl);
    box.appendChild(ta);
    box.appendChild(bar);
    (document.body || document.documentElement).appendChild(box);
  }

  /** 立刻挂上按钮：不依赖 DOMContentLoaded，这样「脚本有没有跑」一眼可见 */
  function mountUI() {
    mountStyle();
    if (document.getElementById(HOST_ID)) return;
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483647;display:flex;gap:8px;align-items:center';
    host.appendChild(buildToggle());
    host.appendChild(buildHelp());
    (document.body || document.documentElement).appendChild(host);
  }

  // ════════════════════════════════════════════════════════════════
  // 4. 启动
  // ════════════════════════════════════════════════════════════════
  function boot() {
    try { mountUI(); } catch (err) { LOG('挂载按钮失败', err); }
    try { if (dictOn) schedule(document.documentElement); } catch (err) { LOG('首次翻译失败', err); }
    try { startObserving(); } catch (err) { LOG('启动监听失败', err); }
  }

  LOG(`v${VERSION} 已启动`, location.href, `· 词典 ${EXACT.size} 条 · 词典层${dictOn ? '开启' : '关闭'}`);

  // 控制台里可手动排查：__bdnL2dZh.translate('Home') 、__bdnL2dZh.pause() / resume()
  globalThis.__bdnL2dZh = {
    VERSION, EXACT, dictOn, translate, stats, unmatched, noteUnmatched, pause, resume,
  };

  try { mountUI(); } catch (err) { LOG('挂载按钮失败', err); }   // document-start 立刻挂按钮；此时可能还没有 <body>，就先挂在 <html> 上
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  } catch (err) { LOG('启动失败', err); }
})();
