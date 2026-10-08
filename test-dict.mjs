// 逻辑回归测试：词典翻译 + 语言前缀切换（纯逻辑层，不依赖真实 DOM）
// 用法: node test-dict.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'bdon-live2d-zh.user.js'), 'utf8');

function slice(a, b) {
  const i = src.indexOf(a);
  const j = src.indexOf(b);
  if (i < 0 || j < 0 || j <= i) {
    console.error(`无法定位代码片段: ${a} … ${b}（脚本结构可能已变）`);
    process.exit(1);
  }
  return src.slice(i, j);
}

let pass = 0;
const fails = [];
function check(name, got, want) {
  if (got === want) pass++;
  else fails.push({ name, want, got });
}

// ─────────────────────────── A. 词典 ───────────────────────────
// translate() 现在还会调用模型参数 / 动作名的兜底转换，所以两段要一起求值
const paramSrc = slice('const PARAM_TOKENS', '// __PARAM_END__');
const dictSrc = slice('  const EXACT', '  // __DICT_END__');
const { translate, EXACT } = new Function(paramSrc + '\n' + dictSrc + '\nreturn { translate, EXACT };')();

const cases = [
  ['Fullscreen', '全屏'],
  ['  Fullscreen  ', '全屏'],
  ['Exit fullscreen', '退出全屏'],
  ['Zoom in', '放大'],
  ['Reset zoom', '重置缩放'],
  ['Live2D stage', 'Live2D 舞台'],
  ['Loading the model…', '正在加载模型…'],
  ['Loading the model...', '正在加载模型…'],          // 半角省略号也要命中
  ['Preparing the Live2D runtime…', '正在准备 Live2D 运行环境…'],
  ['Try again', '重试'],
  ['Filter models', '筛选模型'],
  ['Type', '类型'],
  ['ALL', '全部'],                                     // 源码里唯一硬编码的英文
  ['Story', '剧情'],
  ['Live', '演出'],
  ['Side', '配角'],
  ['Other characters', '其他角色'],
  ['Show low quality copies', '显示低画质副本'],
  ['Search characters, costumes or model ids…', '搜索角色、服装或模型 ID…'],
  ['Loading the model list…', '正在加载模型列表…'],
  ['The model list could not be loaded.', '模型列表加载失败。'],
  ['Pick a character', '选择一位角色'],
  ['Model controls', '模型控制'],
  ['Choose a character', '选择角色'],
  ['Costumes', '服装'],
  ['Motions', '动作'],
  ['Expressions', '表情'],
  ['This model has no expressions.', '此模型没有表情。'],
  ['Loop the motion', '循环播放动作'],
  ['Physics', '物理效果'],
  ['Breathing', '呼吸'],
  ['Pause', '暂停'],
  ['Resume', '继续'],
  ['Back to idle', '回到待机'],
  ['Low quality', '低画质'],
  ['Default', '默认'],
  ['The controls appear once the model is ready.', '模型就绪后即可操作。'],
  ['About the model data', '关于模型数据'],
  ['Twin tails', '双马尾'],
  ['Novelty glasses', '搞笑眼镜'],
  ['School uniform', '制服'],
  ['Live2D Viewer', 'Live2D 浏览器'],
  // 组合标签
  ['Casual · 1st year', '私服 · 一年级'],
  ['Story · Live outfit', '剧情 · 演出服'],
  ['Casual · Spring', '私服 · 春'],
  // ── 站点外壳（页头导航 / 设置抽屉 / 页脚）──
  ['Home', '首页'],
  ['Tools', '工具'],
  ['Search', '搜索'],
  ['Open settings', '打开设置'],
  ['Open command palette', '打开命令面板'],
  ['Loading', '正在加载'],
  ['Settings', '设置'],
  ['Theme', '主题模式'],
  ['Density', '界面密度'],
  ['General', '通用'],
  ['Reset filters', '重置筛选'],
  ['Close', '关闭'],
  ['Sister Sites', '姐妹站'],
  ['Contact & Feedback', '联系与反馈'],
  ['Source on GitHub', 'GitHub 源码'],
  ['Terms of Use', '使用条款'],
  ['© 2026 Moenotes · A Notebook of Girls and Starlight', '© 2026 Moenotes · 少女与星光的手帐'],
  ['A handwritten notebook for BanG Dream! Our Notes, dedicated to the stage and the stars.',
    '写给舞台与星光的 Our Notes 漫步手帐'],
  // ── 模板条目（占位符 -> 捕获组）──
  ['128 files', '128 个文件'],
  ['Auto (JP)', '自动（JP）'],
  ['Get Lemur', '下载 Lemur'],
  ['Discord community (moenotes)', 'Discord 社区（moenotes）'],
  ['Moenotes QQ Group (123456)', 'Moenotes QQ群（123456）'],
  // ── 站点标题后缀 ──
  ['Live2D Viewer | BanG Dream! Our Notes Database', 'Live2D 浏览器 | BanG Dream! Our Notes 资料库'],
  // 不该被动到的
  ['Live2D 舞台', null],                               // 已是中文
  ['选择角色', null],
  ['RiNG', null],                                      // 译文与原文相同 => 不改写
  ['12 / 340', null],
  ['1024', null],
  ['3.4 MB', null],
  ['Random unrelated text', null],
];
for (const [input, want] of cases) check(`translate(${JSON.stringify(input)})`, translate(input), want);

const notice = translate(
  "moenotes reproduces what the game's own data packages contain: every model, motion and expression here comes from the game itself, and what you see in a browser does not represent the game's final quality. We do not offer free editing of model parameters: models posed with custom parameters can be badly distorted and are not how they look in the game, so please do not share them as official content."
);
check('translate(<notice 长文>) 前缀', notice && notice.startsWith('moenotes 致力于原样还原'), true);
check('translate(<notice 长文>) 后缀', notice && notice.endsWith('请勿将其当作官方内容传播。'), true);

// ──────────────────── B. 语言前缀与强制中文 ────────────────────
const switchSrc = slice('const LOCALE_PREFIXES', 'const IS_TARGET');

function makeEnv(pathname) {
  const loc = { pathname, search: '', hash: '', replaced: null };
  loc.replace = (u) => { loc.replaced = u; };
  const store = new Map();
  const mk = () => ({
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  });
  const api = new Function(
    'location', 'localStorage', 'sessionStorage',
    switchSrc + '\nreturn { hasPrefix, stripPrefix, forceChinese, prefOn };'
  )(loc, mk(), mk());
  return { loc, api, store };
}

const zhPage = makeEnv('/tools/live2d');
check('zh 页 hasPrefix()', zhPage.api.hasPrefix(), false);
check('zh 页 stripPrefix()', zhPage.api.stripPrefix(), '/tools/live2d');
check('zh 页 forceChinese() 不跳转', zhPage.api.forceChinese(), false);

const enPage = makeEnv('/en/tools/live2d');
check('en 页 hasPrefix()', enPage.api.hasPrefix(), true);
check('en 页 stripPrefix()', enPage.api.stripPrefix(), '/tools/live2d');
check('en 页 forceChinese() 跳转', enPage.api.forceChinese(), true);
check('en 页 跳转目标', enPage.loc.replaced, '/tools/live2d');
check('en 页 二次调用被守卫拦住', enPage.api.forceChinese(), false);

const twPage = makeEnv('/zh-tw/tools/live2d');
check('zh-tw 页 stripPrefix()', twPage.api.stripPrefix(), '/tools/live2d');

const root = makeEnv('/en');
check('根路径 stripPrefix()', root.api.stripPrefix(), '/');

// 大小写不敏感
const upper = makeEnv('/EN/tools/live2d');
check('/EN 也被识别', upper.api.hasPrefix(), true);

// ─────────────────────────── 结果 ───────────────────────────
console.log(`词典条目: ${EXACT.size}`);
console.log(`用例: ${pass + fails.length}  通过: ${pass}  失败: ${fails.length}`);
if (fails.length) {
  for (const f of fails) {
    console.log(`  ✗ ${f.name}\n      期望: ${JSON.stringify(f.want)}\n      实际: ${JSON.stringify(f.got)}`);
  }
  process.exit(1);
}
console.log('全部通过 ✓');
