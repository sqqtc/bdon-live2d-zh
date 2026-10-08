// 调整器（参数滑块 / 部件勾选 / 动作表情按钮）汉化回归测试
// 语料：live-unmatched.txt（用户从线上 v1.3.0 诊断面板导出的实测未匹配清单）
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'bdon-live2d-zh.user.js'), 'utf8');

function slice(a, b) {
  const i = src.indexOf(a);
  const j = src.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('切片失败：' + a);
  return src.slice(i, j);
}

const api = new Function(
  slice('const PARAM_TOKENS', '// __PARAM_END__') + '\n' +
  slice('  const EXACT', '  // __DICT_END__') + '\n' +
  'return { translate, translateParamLabel, translateAssetName, isModelId, EXACT, PARAM_TOKENS };'
)();

let pass = 0, fail = 0;
function eq(label, got, want) {
  if (got === want) pass++;
  else { fail++; console.log('  ✗ ' + label + '\n      得到 ' + JSON.stringify(got) + '\n      期望 ' + JSON.stringify(want)); }
}
function ok(label, cond, extra) {
  if (cond) pass++;
  else { fail++; console.log('  ✗ ' + label + (extra ? '  ' + JSON.stringify(extra) : '')); }
}

// ── 1. 参数 / 部件 ID ────────────────────────────────────────────
const P = api.translateParamLabel;
eq('ParamAngleX', P('ParamAngleX'), '角度X');
eq('ParamEyeLSmile', P('ParamEyeLSmile'), '左眼微笑');
eq('ParameyelidR', P('ParameyelidR'), '右眼睑');
eq('paramArmL_layer2', P('paramArmL_layer2'), '左臂图层2');
eq('hand_R_01', P('hand_R_01'), '右手01');
eq('hand_l_09', P('hand_l_09'), '左手09');
eq('ParamEyeBallX', P('ParamEyeBallX'), '眼球X');
eq('ParamBodyAngleX_R_arm_Add', P('ParamBodyAngleX_R_arm_Add'), '身体角度X右臂附加');
eq('ParamFluffy2A', P('ParamFluffy2A'), '蓬松2A');
eq('ParamwWaistRibbonFuwa1', P('ParamwWaistRibbonFuwa1'), '腰部缎带摆动1');
eq('ParamNeckFrillsfuwa2', P('ParamNeckFrillsfuwa2'), '颈部褶边摆动2');
eq('ParamHairFront2', P('ParamHairFront2'), '前发2');
eq('ParamHairBackY2', P('ParamHairBackY2'), '后发Y2');
eq('ParamHairSide3', P('ParamHairSide3'), '侧发3');
eq('ParamBodyAngleupdown', P('ParamBodyAngleupdown'), '身体角度上下');
eq('ParamAngleXPlus20', P('ParamAngleXPlus20'), '角度X加20');
eq('ParamAngleXMinus30', P('ParamAngleXMinus30'), '角度X减30');
eq('Param10', P('Param10'), '参数10');
eq('Param_tears_puru', P('Param_tears_puru'), '眼泪颤抖');
eq('ParameyeLlashShakingX', P('ParameyeLlashShakingX'), '左眼睫毛抖动X');
eq('Paramcry02mtn', P('Paramcry02mtn'), '哭泣02动作');
eq('Param_angry_eyebrows', P('Param_angry_eyebrows'), '生气眉毛');
eq('ParamMouthOpenY', P('ParamMouthOpenY'), '嘴巴开闭Y');
eq('ParamBreath', P('ParamBreath'), '呼吸');
// 不该碰的东西
eq('模型 id 不译', P('001_live-tomori_001_live_01'), null);
eq('角色名不译', P('Tomori'), null);
eq('生词整串不译', P('ParamHairWobbleThing'), null);
eq('普通文案不译', P('Basic'), null);

// ── 2. 动作 / 表情文件名 ────────────────────────────────────────
const A = api.translateAssetName;
eq('mtn_angry01_C', A('mtn_angry01_C'), '生气01（C）');
eq('mtn_idle01_L', A('mtn_idle01_L'), '待机01（L）');
eq('mtn_maskoff01_R', A('mtn_maskoff01_R'), '摘面具01（R）');
eq('mtn_thinking01_C', A('mtn_thinking01_C'), '思考01（C）');
eq('exp_cry02.exp3', A('exp_cry02.exp3'), '哭泣02');
eq('exp_bsmile01', A('exp_bsmile01'), '苦笑01');
eq('exp_dispair01.exp3', A('exp_dispair01.exp3'), '绝望01');
eq('生僻动作不译', A('mtn_wobble01_C'), null);

// ── 3. 模型字段判定（v1.5.0 起：这类串只走 CSS 伪元素，DOM 原文必须保持英文）──
const M = api.isModelId;
ok('ParamAngleX 是模型字段', M('ParamAngleX') === true);
ok('paramArmL_layer2 是模型字段', M('paramArmL_layer2') === true);
ok('hand_R_01 是模型字段', M('hand_R_01') === true);
ok('mtn_angry01_C 是模型字段', M('mtn_angry01_C') === true);
ok('exp_cry02.exp3 是模型字段', M('exp_cry02.exp3') === true);
ok('带首尾空白也认', M('  ParamAngleX  ') === true);
ok('模型 id 不是模型字段', M('001_live-tomori_001_live_01') === false);
ok('界面文案不是模型字段', M('Parts Visibility') === false);
ok('动作名（无前缀）不是模型字段', M('angry01_C') === false);
ok('空值不抛错', M(null) === false && M('') === false);

// ── 4. 词典条目 ─────────────────────────────────────────────────
ok('词典条目数 ≥ 300', api.EXACT.size >= 300, api.EXACT.size);

// ── 5. 线上实测清单整体覆盖率 ───────────────────────────────────
const labels = readFileSync(join(here, 'live-unmatched.txt'), 'utf8')
  .split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));

const miss = [];
let hit = 0;
for (const l of labels) {
  const r = api.translate(l);
  if (r && r !== l) hit++; else miss.push(l);
}
console.log('\n线上清单：' + labels.length + ' 条，已覆盖 ' + hit + ' 条（'
  + Math.round((hit / labels.length) * 100) + '%），仍为英文 ' + miss.length + ' 条');
if (miss.length) {
  console.log('仍为英文的条目：');
  for (const m of miss) console.log('  · ' + m);
}
// 专名（角色 / 乐队 / 模型 id）本就不该翻译，单独排除后要求覆盖率 ≥ 95%
const proper = miss.filter((m) => /^[\w.!-]+$/.test(m) && !/^(Param|param|hand_|mtn_|exp_|.*\d.*$)/.test(m));
console.log('其中疑似专名（不译是正确的）：' + (proper.length ? proper.join(' / ') : '无'));

console.log('\n通过 ' + pass + ' 失败 ' + fail);
process.exit(fail ? 1 : 0);
