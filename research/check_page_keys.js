const fs = require("fs");
const dir = "C:/Users/Administrator/AppData/Local/Temp/dsh-spill-3DBNFV/session-eaa108dfa40f/";

// Generic: pull one indent-2 block (inline or multi-line, one nesting level) out of a messages file.
function readBlock(file, name) {
  const lines = fs.readFileSync(dir + file, "utf8").split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp("^\\s{2}" + name + ":\\s*\\{").test(l));
  if (start < 0) return null;
  const out = {};
  const inline = (s, prefix) => {
    const re = /"?([\w-]+)"?\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(s))) out[prefix + m[1]] = m[2];
  };
  if (/^  [\w-]+:\s*\{.*\}\s*,?\s*$/.test(lines[start])) {
    inline(lines[start].slice(lines[start].indexOf("{") + 1, lines[start].lastIndexOf("}")), "");
    return out;
  }
  let end = start + 1;
  for (; end < lines.length; end++) if (/^\s{2}\},?\s*$/.test(lines[end])) break;
  let nest = null;
  for (const line of lines.slice(start + 1, end)) {
    let m;
    if (nest) {
      if (/^\s{2,4}\},?\s*$/.test(line)) { nest = null; continue; }
      m = line.match(/^\s{2,4}"?([\w-]+)"?:\s*"((?:[^"\\]|\\.)*)",?\s*$/);
      if (m) out[nest + "." + m[1]] = m[2];
      continue;
    }
    m = line.match(/^\s{2}(\w+):\s*\{(.*)\},?\s*$/);
    if (m) { inline(m[2], m[1] + "."); continue; }
    m = line.match(/^\s{2}(\w+):\s*\{\s*$/);
    if (m) { nest = m[1]; continue; }
    m = line.match(/^\s{2}(\w+):\s*"((?:[^"\\]|\\.)*)",?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const files = {
  en: "6be99db831ac-web_fetch.txt",
  zhMain: "210caae2f132-web_fetch.txt",
  zhOld: "6c347dc2079c-web_fetch.txt",
};
const blocks = {};
for (const [k, f] of Object.entries(files)) {
  blocks[k] = { filter: readBlock(f, "filter"), loader: readBlock(f, "loader"), seo: readBlock(f, "seo") };
  fs.writeFileSync(`fmt_${k}.json`, JSON.stringify(blocks[k], null, 1));
}
console.log("block key counts:", Object.fromEntries(Object.entries(blocks).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([b, o]) => [b, o ? Object.keys(o).length : null]))])));

const deck = new Set(fs.readFileSync("moenotes_live2d_en_zh.tsv", "utf8").split(/\r?\n/).filter(Boolean));

// every key used by the Live2D page's controls, outside the live2d namespace
const pageKeys = [
  "filter.title", "filter.search", "filter.sort", "filter.reset", "filter.collapse", "filter.expand",
  "filter.count", "filter.openQuickFilter", "filter.drawerHintTitle", "filter.drawerHintBody", "filter.drawerHintDismiss",
  "loader.loading",
  "seo.live2dViewer.title", "seo.live2dViewer.description",
];
console.log("\nkey\tinDeck?\tEN\tZH");
for (const key of pageKeys) {
  const [b, ...rest] = key.split(".");
  const flat = rest.join(".");
  const en = blocks.en[b] && blocks.en[b][flat];
  const zh = (blocks.zhMain[b] && blocks.zhMain[b][flat]) ?? (blocks.zhOld[b] && blocks.zhOld[b][flat]);
  const inDeck = en === undefined ? "-" : deck.has(en + "\t" + zh);
  console.log(`${key}\t${inDeck}\t${JSON.stringify(en)}\t${JSON.stringify(zh)}`);
}
