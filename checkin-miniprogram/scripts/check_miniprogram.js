/**
 * 小程序静态检查：node scripts/check_miniprogram.js
 *  - 所有 .js 能通过语法检查
 *  - app.json 里的页面、各处 usingComponents 引用的组件文件齐全（js/json/wxml/wxss）
 *  - WXML 里绑定的事件处理函数在对应的 Page / Component 里都有定义
 *  - WXML 标签成对闭合
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MP = path.resolve(__dirname, '../miniprogram');
let errors = 0;
const fail = (msg) => { errors++; console.error('✗', msg); };

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(MP);
const rel = (p) => path.relative(MP, p);

// 1. JS 语法
files.filter((f) => f.endsWith('.js')).forEach((f) => {
  try {
    new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f });
  } catch (e) {
    fail(`语法错误 ${rel(f)}: ${e.message}`);
  }
});

// 2. 页面与组件文件
const app = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
const units = [];
app.pages.forEach((p) => units.push({ base: path.join(MP, p), kind: 'page' }));
const seen = new Set();
function addComponents(json, fromDir) {
  Object.values(json.usingComponents || {}).forEach((c) => {
    const base = c.startsWith('/') ? path.join(MP, c) : path.resolve(fromDir, c);
    if (seen.has(base)) return;
    seen.add(base);
    units.push({ base, kind: 'component' });
  });
}
addComponents(app, MP);
for (let i = 0; i < units.length; i++) {
  const u = units[i];
  for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
    if (!fs.existsSync(u.base + ext)) fail(`缺少文件 ${rel(u.base + ext)}`);
  }
  if (fs.existsSync(`${u.base}.json`)) addComponents(JSON.parse(fs.readFileSync(`${u.base}.json`, 'utf8')), path.dirname(u.base));
}

// 3. 事件处理函数 & 4. 标签闭合
function definedMethods(jsFile, kind) {
  let def = null;
  const ctx = {
    require: () => new Proxy({}, { get: () => () => ({}) }),
    module: { exports: {} }, console, wx: {}, getApp: () => ({ globalData: {} }), getCurrentPages: () => [],
    Page: (d) => { def = d; }, Component: (d) => { def = d; }, setTimeout, clearTimeout, setInterval, clearInterval
  };
  vm.runInNewContext(fs.readFileSync(jsFile, 'utf8'), ctx);
  if (!def) return new Set();
  return new Set(Object.keys(kind === 'page' ? def : def.methods || {}));
}

units.forEach((u) => {
  if (!fs.existsSync(`${u.base}.wxml`) || !fs.existsSync(`${u.base}.js`)) return;
  const wxml = fs.readFileSync(`${u.base}.wxml`, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const methods = definedMethods(`${u.base}.js`, u.kind);
  const re = /\s(?:bind|catch)(?::)?([a-z]+)="([^"{}]+)"/g;
  let m;
  while ((m = re.exec(wxml))) {
    if (!methods.has(m[2])) fail(`${rel(u.base)}.wxml 绑定的 ${m[2]}（${m[1]}）在 JS 里没有定义`);
  }
  // 标签闭合
  const VOID = new Set(['input', 'image', 'slider', 'ic', 'radar', 'hold-button']);
  const stack = [];
  const tagRe = /<\/?([a-z][\w-]*)((?:"[^"]*"|[^>"])*)>/g;
  while ((m = tagRe.exec(wxml))) {
    const [full, name, rest] = m;
    if (full.startsWith('</')) {
      const top = stack.pop();
      if (top !== name) fail(`${rel(u.base)}.wxml 标签不匹配：期望 </${top}>，遇到 </${name}>`);
    } else if (!rest.trim().endsWith('/') && !VOID.has(name)) {
      stack.push(name);
    }
  }
  if (stack.length) fail(`${rel(u.base)}.wxml 有未闭合的标签：${stack.join(', ')}`);
});

if (errors) {
  console.error(`\n${errors} 个问题`);
  process.exit(1);
}
console.log(`✓ 检查通过：${units.length} 个页面 / 组件，${files.filter((f) => f.endsWith('.js')).length} 个 JS 文件`);
