const fs = require("fs");
const dir = "C:/Users/Administrator/AppData/Local/Temp/dsh-spill-3DBNFV/session-eaa108dfa40f/";

function readBlock(file) {
  const txt = fs.readFileSync(dir + file, "utf8");
  const lines = txt.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s{2}live2d:\s*\{\s*$/.test(l));
  if (start < 0) return null;
  let end = start + 1;
  for (; end < lines.length; end++) if (/^\s{2}\},?\s*$/.test(lines[end])) break;
  const body = lines.slice(start + 1, end);
  const out = {};
  let nest = null;
  const inline = (s, prefix) => {
    const re = /"?([\w-]+)"?\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(s))) out[prefix + m[1]] = m[2];
  };
  for (const line of body) {
    let m;
    if (nest) {
      if (/^\s{4,6}\},?\s*$/.test(line)) { nest = null; continue; }
      m = line.match(/^\s{4,6}"?([\w-]+)"?:\s*"((?:[^"\\]|\\.)*)",?\s*$/);
      if (m) out[nest + "." + m[1]] = m[2];
      continue;
    }
    m = line.match(/^\s{4}(\w+):\s*\{(.*)\},?\s*$/);
    if (m) { inline(m[2], m[1] + "."); continue; }
    m = line.match(/^\s{4}(\w+):\s*\{\s*$/);
    if (m) { nest = m[1]; continue; }
    m = line.match(/^\s{4}(\w+):\s*"((?:[^"\\]|\\.)*)",?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const en = readBlock("6be99db831ac-web_fetch.txt");
const zhMain = readBlock("210caae2f132-web_fetch.txt");
const zhOld = readBlock("6c347dc2079c-web_fetch.txt");
fs.writeFileSync("live2d_en_main.json", JSON.stringify(en, null, 1));
fs.writeFileSync("live2d_zh_main.json", JSON.stringify(zhMain, null, 1));
fs.writeFileSync("live2d_zh_old.json", JSON.stringify(zhOld, null, 1));

const deck = fs.readFileSync("moenotes_live2d_en_zh.tsv", "utf8").split(/\r?\n/).filter(Boolean);
const deckSet = new Set(deck);
console.log("deck lines:", deck.length);
console.log("en keys:", en ? Object.keys(en).length : null, "zh-main keys:", zhMain ? Object.keys(zhMain).length : null, "zh-old keys:", zhOld ? Object.keys(zhOld).length : null);

const newPairs = [];
const enOnly = [];
for (const k of Object.keys(en)) {
  const z = zhMain ? zhMain[k] : zhOld[k];
  if (z === undefined) { enOnly.push(k); continue; }
  const pair = en[k] + "\t" + z;
  if (en[k] === z) { console.log("SKIP identical:", k, "=", JSON.stringify(en[k])); continue; }
  if (deckSet.has(pair)) continue;
  newPairs.push(k + "\t" + pair);
}
console.log("\n=== NEW PAIRS (not in deck) ===");
newPairs.forEach((p) => console.log(p));
console.log("count:", newPairs.length);
console.log("\n=== en keys with no zh ===", enOnly);
if (zhMain) {
  const diff = Object.keys(en).filter((k) => zhMain[k] !== undefined && zhOld[k] !== undefined && zhMain[k] !== zhOld[k]);
  console.log("=== zh main vs 8200576c differences ===", diff.map((k) => k + ": " + zhOld[k] + " -> " + zhMain[k]));
  const missing = Object.keys(en).filter((k) => zhMain[k] === undefined);
  console.log("=== en keys missing from zh-main ===", missing);
}
