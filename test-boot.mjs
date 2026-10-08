// 启动冒烟测试：用最小 DOM 桩把整个用户脚本真正跑一遍。
// 目的：抓 `node --check` 抓不到的那类错误 —— 常量丢失、ReferenceError、
//       启动路径崩溃（本次事故就是 HOST_ID / SKIP_TAGS / ATTRS 被词典重建覆盖）。
// 用法: node test-boot.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(here, 'bdon-live2d-zh.user.js'), 'utf8');

let pass = 0;
const fails = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; return; }
  fails.push(`${name}${extra ? '  → ' + extra : ''}`);
};

// ── 最小 DOM 桩 ─────────────────────────────────────────────────
function makeStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function run({ pathname = '/tools/live2d', readyState = 'complete', title = 'Live2D Viewer | BanG Dream! Our Notes Database', texts = ['Open settings'], fs = '11px', pseudo = null, holderTags = [] } = {}) {
  const state = { replaced: null, reloaded: 0, listeners: [], raf: [], observed: null };

  function makeEl(tag = 'div') {
    const el = {
      tagName: String(tag).toUpperCase(),
      nodeType: 1,
      nodeValue: null,
      id: '',
      type: '',
      title: '',
      value: '',
      readOnly: false,
      textContent: '',
      childNodes: [],
      children: [],
      style: { cssText: '', setProperty(k, v) { this[k] = v; } },
      isConnected: true,
      isContentEditable: false,
      parentElement: null,
      _attrs: new Map(),
      _classes: new Set(),
      appendChild(c) {
        c.parentElement = this;
        this.childNodes.push(c);
        if (c.nodeType === 1) this.children.push(c);
        return c;
      },
      remove() {},
      setAttribute(k, v) { this._attrs.set(k, String(v)); },
      getAttribute(k) { return this._attrs.has(k) ? this._attrs.get(k) : null; },
      hasAttribute(k) { return this._attrs.has(k); },
      addEventListener() {},
      querySelectorAll() { return []; },
      closest() { return null; },
      select() {},
    };
    el.classList = {
      add: (c) => { el._classes.add(c); },
      remove: (c) => { el._classes.delete(c); },
      contains: (c) => el._classes.has(c),
    };
    return el;
  }

  const html = makeEl('html');
  const body = makeEl('body');
  html.appendChild(body);

  const textNodes = texts.map((t, i) => {
    const holder = makeEl(holderTags[i] || 'span');
    holder.textContent = t;          // 真实 DOM 里父元素的 textContent 就等于那串文字
    return {
      nodeType: 3,
      nodeValue: t,
      isConnected: true,
      parentElement: holder,
    };
  });

  const findById = (root, id) => {
    if (root.id === id) return root;
    for (const c of root.childNodes || []) {
      const hit = findById(c, id);
      if (hit) return hit;
    }
    return null;
  };

  const g = globalThis;
  g.location = {
    pathname,
    search: '',
    hash: '',
    href: 'https://bdon.yatta.moe' + pathname,
    replace(u) { state.replaced = u; },
    reload() { state.reloaded++; },
  };
  g.localStorage = makeStore();
  g.sessionStorage = makeStore();
  g.NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
  // 元素自身：给出字号；::after 伪元素：给出 content / fontSize / visibility（自检会读这三项）
  g.getComputedStyle = (el, isPseudo) => (isPseudo
    ? (pseudo || { content: '"示例"', fontSize: '11px', visibility: 'visible' })
    : { fontSize: fs });
  g.MutationObserver = class {
    constructor(cb) { this.cb = cb; state.observerCb = cb; }
    observe(target) { state.observed = target; }
    disconnect() {}
  };
  g.requestAnimationFrame = (cb) => { state.raf.push(cb); return state.raf.length; };
  g.document = {
    readyState,
    body,
    documentElement: html,
    get title() { return this._title; },
    set title(v) { this._title = v; },
    _title: title,
    createElement: (t) => makeEl(t),
    getElementById: (id) => findById(html, id),
    addEventListener: (type, fn) => { state.listeners.push([type, fn]); },
    execCommand: () => true,
    createTreeWalker: (root, _what, filter) => {
      let i = 0;
      return {
        nextNode() {
          while (i < textNodes.length) {
            const n = textNodes[i++];
            if (!filter || filter.acceptNode(n) === 1) return n;
          }
          return null;
        },
      };
    },
  };
  delete g.__bdnL2dZh;

  let error = null;
  try {
    // eslint-disable-next-line no-new-func
    new Function(SRC)();
  } catch (e) {
    error = e;
  }

  return {
    state,
    error,
    api: g.__bdnL2dZh,
    textNodes,
    document: g.document,
    html,
    host: () => findById(html, 'bdn-l2d-zh-host'),
    styleEl: () => findById(html, 'bdn-l2d-zh-style'),
    flush: () => { while (state.raf.length) state.raf.shift()(); },
    fire: (records) => { if (state.observerCb) state.observerCb(records); },
    el: (t) => makeEl(t),
    readyText: (i = 0) => textNodes[i].nodeValue,
  };
}

// ── 场景 1：正常页面 ────────────────────────────────────────────
{
  const r = run();
  ok('整体执行不抛错', !r.error, r.error && (r.error.message + ' | ' + (r.error.stack || '').split('\n')[1]));
  ok('暴露了 __bdnL2dZh 调试句柄', !!r.api);
  ok('版本号 1.5.2', r.api && r.api.VERSION === '1.5.2', r.api && r.api.VERSION);
  ok('按钮已挂到页面上', !!r.host());
  ok('伪元素样式已注入', !!r.styleEl() && /data-bdn-zh/.test(r.styleEl().textContent), r.styleEl() && r.styleEl().textContent);
  ok('样式含带 !important 的 ::after content',
    !!r.styleEl() && /content:attr\(data-bdn-zh\) !important/.test(r.styleEl().textContent));
  ok('样式里 ::after 显式 visibility:visible',
    !!r.styleEl() && /visibility:visible !important/.test(r.styleEl().textContent));
  ok('样式用 visibility:hidden 兜底藏英文',
    !!r.styleEl() && /visibility:hidden !important/.test(r.styleEl().textContent));
  ok('暴露了 pause / resume', !!(r.api && r.api.pause && r.api.resume));

  r.flush();
  ok('文本节点被改写：Open settings → 打开设置', r.readyText() === '打开设置', JSON.stringify(r.readyText()));
  ok('页面标题被改写', r.document.title.includes('资料库'), r.document.title);
  ok('MutationObserver 盯的是 documentElement', r.state.observed === r.html);
  ok('词典条目 ≥ 200', r.api && r.api.EXACT.size >= 200, r.api && r.api.EXACT.size);

  const a = r.api;
  if (a) {
    ok('translate("Home") = 首页', a.translate('Home') === '首页', a.translate('Home'));
    ok('已是中文不再处理', a.translate('首页') === null);
    ok('纯数字不处理', a.translate('12 / 340') === null);
    a.noteUnmatched('Some brand new English label');
    ok('未匹配文案被记录', a.unmatched.has('Some brand new English label'));
  }
}

// ── 场景 2：非目标页面，应当什么都不做 ──────────────────────────
{
  const r = run({ pathname: '/info/songs' });
  ok('非目标页不抛错、不注入', !r.error && !r.api && !r.host(), r.error && r.error.message);
}

// ── 场景 3：带语言前缀的地址，应当跳回无前缀页面 ────────────────
{
  const r = run({ pathname: '/en/tools/live2d' });
  ok('带前缀时跳回 /tools/live2d', r.state.replaced === '/tools/live2d', JSON.stringify(r.state.replaced));
  ok('跳转后不再注入 UI', !r.api);
}

// ── 场景 4：document-start（readyState = loading）────────────────
{
  const r = run({ readyState: 'loading' });
  ok('loading 阶段不抛错', !r.error, r.error && r.error.message);
  ok('loading 阶段也先挂上按钮', !!r.host());
  ok('loading 阶段注册了 DOMContentLoaded', r.state.listeners.some(([t]) => t === 'DOMContentLoaded'));
  const before = r.state.raf.length;
  for (const [type, fn] of r.state.listeners) if (type === 'DOMContentLoaded') fn();
  ok('DOMContentLoaded 之后开始翻译', r.state.raf.length > before);
  r.flush();
  ok('DOMContentLoaded 之后文本被改写', r.readyText() === '打开设置', r.readyText());
}

// ── 场景 5：模型字段只画伪元素，DOM 原文必须保持英文（v1.5.0 修复）──
{
  const r = run({ texts: ['ParamAngleX', 'mtn_angry01_C', 'Open settings'] });
  r.flush();

  const paramNode = r.textNodes[0];
  const mtnNode = r.textNodes[1];

  ok('参数 DOM 原文未被改写', paramNode.nodeValue === 'ParamAngleX', paramNode.nodeValue);
  ok('动作 DOM 原文未被改写', mtnNode.nodeValue === 'mtn_angry01_C', mtnNode.nodeValue);
  ok('参数元素挂了中文译文', paramNode.parentElement.getAttribute('data-bdn-zh') === '头部左右旋转',
    paramNode.parentElement.getAttribute('data-bdn-zh'));
  ok('动作元素挂了中文译文', mtnNode.parentElement.getAttribute('data-bdn-zh') === '生气01（C）',
    mtnNode.parentElement.getAttribute('data-bdn-zh'));
  ok('参数元素带上了伪元素 class', paramNode.parentElement.classList.contains('bdn-zh-id'));
  ok('普通文案照旧直接替换', r.textNodes[2].nodeValue === '打开设置', r.textNodes[2].nodeValue);
  ok('模型字段计数 ≥ 2', r.api.stats.marked >= 2, r.api.stats.marked);
  ok('伪元素字号取自元素原字号', paramNode.parentElement.style['--bdn-zh-fs'] === '11px',
    paramNode.parentElement.style['--bdn-zh-fs']);
  ok('自检结论为通过', !!r.api.stats.probe && r.api.stats.probe.ok === true,
    JSON.stringify(r.api.stats.probe));

  // 动作按钮的 title 就是动作 ID —— 走属性那一路必须原封不动
  const btn = r.el('button');
  btn.setAttribute('title', 'mtn_angry01_C');
  r.fire([{ type: 'childList', addedNodes: [btn] }]);
  r.flush();
  ok('动作按钮 title 保持原样', btn.getAttribute('title') === 'mtn_angry01_C', btn.getAttribute('title'));

  r.api.pause();
  const rafBefore = r.state.raf.length;
  r.fire([{ type: 'childList', addedNodes: [r.el('div')] }]);
  ok('pause 后不再排队改写', r.state.raf.length === rafBefore, r.state.raf.length);
  r.api.resume();
  ok('resume 后恢复排队', r.state.raf.length > rafBefore, r.state.raf.length);
  r.flush();
}

// ── 场景 6：元素字号已经是 0（重复标记的真实故障），绝不许把 0 写进 --bdn-zh-fs ──
{
  const r = run({ texts: ['ParamAngleX'], fs: '0px' });
  r.flush();
  const el = r.textNodes[0].parentElement;
  ok('字号为 0 时不写 --bdn-zh-fs（交给 CSS 的 11px 兜底）', el.style['--bdn-zh-fs'] === undefined,
    String(el.style['--bdn-zh-fs']));
  ok('字号为 0 时仍然挂上译文', el.getAttribute('data-bdn-zh') === '头部左右旋转', el.getAttribute('data-bdn-zh'));
}

// ── 场景 7：伪元素没渲染时，自检必须报失败并给出细节 ─────────────
{
  const r = run({ texts: ['ParamAngleX'], pseudo: { content: 'none', fontSize: '0px', visibility: 'hidden' } });
  r.flush();
  const p = r.api.stats.probe;
  ok('自检能发现伪元素没画出来', !!p && p.ok === false, JSON.stringify(p));
  ok('自检附带 content/fontSize/visibility 细节',
    !!p && p.content === 'none' && p.fontSize === '0px' && p.visibility === 'hidden', JSON.stringify(p));
}

// ── 场景 8：下拉列表的 <option> 不许走伪元素（::after 在 option 上画不出来）──
{
  const r = run({ texts: ['mtn_idle01_C', 'ParamAngleX'], holderTags: ['option', 'span'] });
  r.flush();
  const opt = r.textNodes[0].parentElement;

  ok('option 原文未被改写', r.textNodes[0].nodeValue === 'mtn_idle01_C', r.textNodes[0].nodeValue);
  ok('option 用 label 属性显示中文', opt.getAttribute('label') === '待机01（C）', opt.getAttribute('label'));
  ok('option 不挂伪元素 class（否则整行看不见）', !opt.classList.contains('bdn-zh-id'));
  ok('option 也记了 data-bdn-zh', opt.getAttribute('data-bdn-zh') === '待机01（C）', opt.getAttribute('data-bdn-zh'));
  ok('下拉选项计数 ≥ 1', r.api.stats.formLabeled >= 1, r.api.stats.formLabeled);

  // 普通元素照旧走伪元素
  const span = r.textNodes[1].parentElement;
  ok('普通元素仍走伪元素', span.classList.contains('bdn-zh-id')
    && span.getAttribute('data-bdn-zh') === '头部左右旋转', span.getAttribute('data-bdn-zh'));

  // 重复标记不应该把 label 写坏
  r.fire([{ type: 'characterData', target: r.textNodes[0] }]);
  r.flush();
  ok('重复标记仍是同一个中文', opt.getAttribute('label') === '待机01（C）', opt.getAttribute('label'));
}

console.log(`启动冒烟测试：通过 ${pass}   失败 ${fails.length}`);
for (const f of fails) console.log('  ✗ ' + f);
if (fails.length) process.exit(1);
console.log('全部通过 ✓');
