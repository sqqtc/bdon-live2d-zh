// 从本目录下所有 *_en_zh.tsv 生成词典区段，并写回 bdon-live2d-zh.user.js
// 用法: node build-dict.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, 'bdon-live2d-zh.user.js');

// ── 读 TSV（支持多个词表文件，按文件名排序保证结果稳定） ─────────
const sources = readdirSync(here).filter((f) => f.endsWith('_en_zh.tsv')).sort();
if (!sources.length) throw new Error('目录下没有任何 *_en_zh.tsv 词表');

const rows = [];
for (const file of sources) {
  const before = rows.length;
  for (const line of readFileSync(join(here, file), 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const i = line.indexOf('\t');
    if (i < 0) { console.error(`跳过无制表符的行（${file}）: ${line}`); continue; }
    const unesc = (s) => s.replace(/\\t/g, '\t').replace(/\\n/g, '\n');
    rows.push([unesc(line.slice(0, i)), unesc(line.slice(i + 1))]);
  }
  console.log(`读入 ${file}: ${rows.length - before} 行`);
}

const statics = [];
const templates = [];
const seen = new Set();
let same = 0;
for (const [en, zh] of rows) {
  if (!en || !zh || seen.has(en)) continue;
  seen.add(en);
  if (en === zh) { same++; continue; }          // 译文与原文相同 => 无需收录
  (/\{[a-zA-Z]+\}/.test(en) ? templates : statics).push([en, zh]);
}

// ── 模板条目 -> 正则 ────────────────────────────────────────────
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function toPattern(en, zh) {
  const parts = en.split(/\{([a-zA-Z]+)\}/g);   // 字面量 / 占位符 / 字面量 …
  const names = [];
  let rx = '^';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) { rx += esc(parts[i]); continue; }
    const known = names.indexOf(parts[i]);
    if (known < 0) { names.push(parts[i]); rx += '(.+?)'; }
    else rx += '\\' + (known + 1);              // 同一占位符重复出现 => 反向引用
  }
  rx += '$';
  let out = zh;
  names.forEach((n, idx) => { out = out.split('{' + n + '}').join('$' + (idx + 1)); });
  return [rx, out, names];
}

const pats = templates.map(([en, zh]) => toPattern(en, zh));

// ── 生成区段 ────────────────────────────────────────────────────
const q = (s) => JSON.stringify(s);
const region = `  const EXACT = new Map(Object.entries({
${statics.map(([en, zh]) => `    ${q(en)}: ${q(zh)},`).join('\n')}
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
${pats.map(([rx, out]) => `    [/${rx.replace(/\//g, '\\/')}/, ${q(out)}],`).join('\n')}
  ];

  /** 归一化：折叠空白、统一省略号，减少因排版差异导致的漏译 */
  function norm(s) {
    return s.replace(/\\s+/g, ' ').replace(/\\.\\.\\./g, '…').trim();
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
    if (/[\\u4e00-\\u9fff]/.test(key)) return null;

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
      const parts = key.split(/\\s*·\\s*/).map((part) => {
        const t = translateOne(part);
        if (t) { changed = true; return t; }
        return part;
      });
      if (changed) return parts.join(' · ');
    }
    return null;
  }
`;

// ── 写回脚本 ────────────────────────────────────────────────────
const src = readFileSync(SCRIPT, 'utf8');
const A = '  const EXACT = new Map(Object.entries({';
const B = '  // __DICT_END__';
const i = src.indexOf(A);
const j = src.indexOf(B);
if (i < 0 || j < 0 || j <= i) throw new Error('未找到词典区段标记，脚本结构可能已变');

const out = src.slice(0, i) + region + src.slice(j);

// 防回归：这些标识符必须留在生成区段之外，否则会被重建覆盖
// （2026-xx 的事故：HOST_ID / SKIP_TAGS / ATTRS 曾在区段内被抹掉，脚本一启动就 ReferenceError）
const REQUIRED = ['const HOST_ID', 'const PANEL_ID', 'const ATTRS', 'const SKIP_TAGS',
  'const ZH_ATTR', 'const ZH_CLASS', 'const STYLE_ID',
  'function isSkipped', 'function applyToText', 'function applyToElement', 'function mountUI',
  'function boot', 'function markChinese', 'function isModelId', 'function pause', 'function resume',
  'function probeMark', 'const ZH_CSS', 'function isFormLabel', 'function setFormLabel',
  'function translateParamLabel', 'function translateAssetName', 'const PARAM_TOKENS'];
for (const token of REQUIRED) {
  if (!out.includes(token)) throw new Error(`重建后脚本缺少「${token}」—— 它必须放在词典生成区段之外`);
}
if ((out.match(/const EXACT = new Map\(Object\.entries\(\{/g) || []).length !== 1) {
  throw new Error('重建后 EXACT 定义不唯一，脚本结构异常');
}
// 版本号一致性：Tampermonkey 认的是 @version，别让它和脚本内部的 VERSION 走散
const metaVer = (out.match(/\/\/\s*@version\s+(\S+)/) || [])[1];
const constVer = (out.match(/const VERSION = '([^']+)'/) || [])[1];
if (!metaVer || !constVer || metaVer !== constVer) {
  throw new Error(`版本号不一致：@version=${metaVer} 而 const VERSION=${constVer}`);
}
writeFileSync(SCRIPT, out);

console.log(`固定条目: ${statics.length}   模板条目: ${pats.length}   跳过（原文=译文）: ${same}`);
for (const [rx, out, names] of pats) console.log(`  模板 ${rx}  ->  ${out}   [${names.join(', ')}]`);
console.log(`已写回 ${SCRIPT}`);
