/**
 * 小程序界面离线预览（开发辅助，不参与小程序运行）。
 *
 * 在 Node 里运行真实的 Page / Component 代码（wx 与云函数用假数据模拟），
 * 把真实的 WXML + WXSS 渲染成 HTML，再由 shoot.py 用 Chromium 截图。
 * 用来在没有微信开发者工具的环境里检查布局。支持本项目用到的 WXML 子集：
 * {{}} 表达式、wx:if / wx:elif / wx:else、wx:for、block、slot、自定义组件、setData 路径写法。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MP = path.resolve(__dirname, '../../miniprogram');
const RPX = 0.5; // 375 宽屏幕：1rpx = 0.5px

// ------------------------------------------------------------------ WXML 解析
function parse(src) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  let i = 0;
  const VOID = new Set(['input', 'image', 'slider', 'ic', 'radar', 'hold-button', 'icon']);
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      i = src.indexOf('-->', i) + 3;
      continue;
    }
    if (src.startsWith('</', i)) {
      const end = src.indexOf('>', i);
      const name = src.slice(i + 2, end).trim();
      while (stack.length > 1) {
        const n = stack.pop();
        if (n.name === name) break;
      }
      i = end + 1;
      continue;
    }
    if (src[i] === '<') {
      let j = i + 1;
      while (j < src.length && /[\w:-]/.test(src[j])) j++;
      const name = src.slice(i + 1, j);
      const attrs = {};
      let selfClose = false;
      for (;;) {
        while (/\s/.test(src[j])) j++;
        if (src.startsWith('/>', j)) { selfClose = true; j += 2; break; }
        if (src[j] === '>') { j++; break; }
        let k = j;
        while (k < src.length && /[^\s=>/]/.test(src[k])) k++;
        const an = src.slice(j, k);
        j = k;
        while (/\s/.test(src[j])) j++;
        if (src[j] === '=') {
          j++;
          while (/\s/.test(src[j])) j++;
          const q = src[j];
          const end = src.indexOf(q, j + 1);
          attrs[an] = src.slice(j + 1, end);
          j = end + 1;
        } else {
          attrs[an] = true;
        }
      }
      const node = { type: 'el', name, attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!selfClose && !VOID.has(name)) stack.push(node);
      i = j;
      continue;
    }
    const next = src.indexOf('<', i);
    const text = src.slice(i, next < 0 ? src.length : next);
    if (/[^ \t\r\n]/.test(text)) stack[stack.length - 1].children.push({ type: 'text', text });
    i = next < 0 ? src.length : next;
  }
  return root;
}

// ------------------------------------------------------------------ 表达式
function evalExpr(expr, scope) {
  try {
    // eslint-disable-next-line no-new-func
    return new Function('scope', `with (scope) { return (${expr}); }`)(scope);
  } catch (e) {
    return undefined;
  }
}
function interp(value, scope) {
  if (value === true) return true;
  const m = /^[ \t\r\n]*\{\{([\s\S]*)\}\}[ \t\r\n]*$/.exec(value);
  if (m && value.indexOf('{{', 2) < 0) return evalExpr(m[1], scope);
  return value.replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => {
    const v = evalExpr(e, scope);
    return v === undefined || v === null ? '' : String(v);
  });
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rpx = (s) => String(s).replace(/(-?\d*\.?\d+)rpx/g, (_, n) => `${+(n * RPX).toFixed(2)}px`);

// ------------------------------------------------------------------ 运行环境
function makeEnv(mock) {
  const timers = [];
  const env = { pages: [], app: { globalData: { dirty: { courses: false } } }, mock };
  const storage = Object.assign({}, mock.storage || {});
  env.wx = {
    getWindowInfo: () => ({ windowWidth: 375, windowHeight: mock.height || 812, statusBarHeight: 47 }),
    getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: mock.height || 812, statusBarHeight: 47 }),
    getMenuButtonBoundingClientRect: () => ({ top: 51, left: 281, width: 87, height: 32, right: 368, bottom: 83 }),
    getStorageSync: (k) => storage[k],
    setStorageSync: (k, v) => { storage[k] = v; },
    removeStorageSync: (k) => { delete storage[k]; },
    getLocation: (o) => {
      const r = mock.location ? mock.location() : null;
      setTimeout(() => (r ? o.success && o.success(r) : o.fail && o.fail({ errMsg: 'getLocation:fail auth deny' })), 0);
    },
    vibrateShort() {},
    navigateTo() {}, redirectTo() {}, reLaunch() {}, navigateBack() {},
    showToast() {}, stopPullDownRefresh() {},
    env: { USER_DATA_PATH: 'wxfile://usr' },
    cloud: {
      init() {},
      DYNAMIC_CURRENT_ENV: 'dev',
      callFunction: ({ data, success, fail }) => {
        setTimeout(() => {
          try {
            const out = mock.api(data.action, data.data || {});
            success({ result: out && out.ok === false ? out : { ok: true, data: out } });
          } catch (e) {
            fail && fail(e);
          }
        }, 0);
      },
      uploadFile: async () => ({ fileID: 'cloud://x' }),
      downloadFile: () => {}
    }
  };
  return env;
}

function loadModule(file, env, registry) {
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const req = (p) => {
    const target = path.resolve(path.dirname(file), p.endsWith('.js') ? p : `${p}.js`);
    if (!registry.mods[target]) registry.mods[target] = loadModule(target, env, registry);
    return registry.mods[target];
  };
  const ctx = {
    module, exports: module.exports, require: req, console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    wx: env.wx, getApp: () => env.app, getCurrentPages: () => env.pages, Promise, Math, Date, JSON, Number, String, Object, Array, RegExp,
    Page: (def) => { registry.def = def; }, Component: (def) => { registry.def = def; }, App: () => {}
  };
  vm.runInNewContext(code, ctx, { filename: file });
  return module.exports;
}

function setPath(obj, key, value) {
  const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (o[parts[i]] === undefined || o[parts[i]] === null) o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = value;
}

/** 创建页面或组件实例（共用一套 setData / observers 逻辑） */
function instantiate(dir, base, env, kind) {
  const registry = { mods: {}, def: null };
  loadModule(path.join(dir, `${base}.js`), env, registry);
  const def = registry.def || {};
  const inst = {
    kind,
    dir,
    base,
    def,
    data: JSON.parse(JSON.stringify(def.data || {})),
    wxml: parse(fs.readFileSync(path.join(dir, `${base}.wxml`), 'utf8')),
    json: JSON.parse(fs.readFileSync(path.join(dir, `${base}.json`), 'utf8')),
    children: {},
    byId: {},
    parent: null,
    binds: {}
  };
  const props = def.properties || {};
  Object.keys(props).forEach((k) => {
    const p = props[k];
    if (inst.data[k] === undefined) inst.data[k] = p && typeof p === 'object' && 'value' in p ? p.value : p === Boolean ? false : p === Number ? 0 : '';
  });
  inst.setData = (patch, cb) => {
    Object.keys(patch || {}).forEach((k) => setPath(inst.data, k, patch[k]));
    runObservers(inst, Object.keys(patch || {}));
    if (cb) setTimeout(cb, 0);
  };
  inst.triggerEvent = (name, detail) => {
    const h = inst.binds[name];
    if (h && inst.parent) {
      const target = inst.parent.methods ? inst.parent.methods[h] : inst.parent[h];
      if (target) target.call(inst.parent.self, { detail });
    }
  };
  inst.selectComponent = (sel) => {
    const c = inst.byId[sel.replace('#', '')];
    return c ? c.self : null;
  };
  // 方法挂到 self 上：页面方法直接写在 def 里，组件方法在 def.methods 里
  const self = inst;
  const methods = kind === 'page' ? def : def.methods || {};
  Object.keys(methods).forEach((k) => {
    if (typeof methods[k] === 'function') self[k] = methods[k].bind(self);
  });
  inst.self = self;
  inst.methods = null;
  return inst;
}

function runObservers(inst, keys) {
  const obs = inst.def.observers;
  if (!obs || inst._inObserver) return;
  inst._inObserver = true;
  Object.keys(obs).forEach((spec) => {
    const fields = spec.split(',').map((s) => s.trim());
    if (keys && !fields.some((f) => keys.includes(f))) return;
    obs[spec].apply(inst.self, fields.map((f) => inst.data[f]));
  });
  inst._inObserver = false;
}

// ------------------------------------------------------------------ 组件注册与样式
const css = { component: {} };
function componentPath(inst, name) {
  const local = (inst.json.usingComponents || {})[name];
  const app = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8')).usingComponents || {};
  const p = local || app[name];
  return p ? path.join(MP, p) : null;
}
function prefixCss(src, scope) {
  // 逐条规则加前缀；@keyframes 与 @font-face 原样保留
  let out = '';
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) break;
    const head = src.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (depth && j < src.length) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') depth--;
      j++;
    }
    const body = src.slice(open, j);
    const cleanHead = head.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (cleanHead.startsWith('@')) out += `${cleanHead}${body}\n`;
    else {
      const sel = cleanHead
        .split(',')
        .map((s) => s.trim())
        .map((s) => (s === ':host' ? `.${scope}` : s.startsWith(':host') ? s.replace(':host', `.${scope}`) : `.${scope} ${s}`))
        .join(', ');
      out += `${sel}${body}\n`;
    }
    i = j;
  }
  return out;
}

// ------------------------------------------------------------------ 渲染
const TAG = { view: 'div', text: 'span', 'scroll-view': 'div', picker: 'div', block: '', slot: '', button: 'div' };

function renderChildren(nodes, scope, inst, env, keyPath, slotHtml) {
  let html = '';
  let chain = null; // 上一个 if 链是否已命中
  nodes.forEach((n, idx) => {
    if (n.type === 'text') {
      html += esc(interp(n.text, scope));
      return;
    }
    const a = n.attrs;
    if ('wx:if' in a) {
      chain = !!interp(a['wx:if'], scope);
      if (!chain) return;
    } else if ('wx:elif' in a) {
      if (chain) return;
      chain = !!interp(a['wx:elif'], scope);
      if (!chain) return;
    } else if ('wx:else' in a) {
      if (chain) { chain = null; return; }
      chain = null;
    } else chain = null;

    if ('wx:for' in a) {
      const list = interp(a['wx:for'], scope) || [];
      const itemName = a['wx:for-item'] || 'item';
      const indexName = a['wx:for-index'] || 'index';
      const arr = Array.isArray(list) ? list : Object.values(list);
      arr.forEach((item, i) => {
        const s = Object.create(scope);
        s[itemName] = item;
        s[indexName] = i;
        html += renderEl(n, s, inst, env, `${keyPath}.${idx}[${i}]`, slotHtml);
      });
      return;
    }
    html += renderEl(n, scope, inst, env, `${keyPath}.${idx}`, slotHtml);
  });
  return html;
}

function renderEl(n, scope, inst, env, keyPath, slotHtml) {
  const a = n.attrs;
  if (n.name === 'slot') return slotHtml || '';
  if (n.name === 'block') return renderChildren(n.children, scope, inst, env, keyPath, slotHtml);

  const cls = a.class ? interp(a.class, scope) : '';
  let style = a.style ? rpx(interp(a.style, scope)) : '';
  if (a.hidden && interp(a.hidden, scope)) style += ';display:none';
  const idAttr = a.id ? interp(a.id, scope) : '';

  // 自定义组件
  const cp = componentPath(inst, n.name);
  if (cp) {
    const key = `${keyPath}`;
    let child = inst.children[key];
    const props = {};
    Object.keys(a).forEach((k) => {
      if (/^(bind|catch)/.test(k) || k.startsWith('wx:') || k === 'class' || k === 'style' || k === 'id') return;
      props[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = interp(a[k], scope);
    });
    const dir = path.dirname(cp);
    const base = path.basename(cp);
    if (!child) {
      child = instantiate(dir, base, env, 'component');
      child.parent = inst;
      Object.keys(a).forEach((k) => {
        const m = /^bind:?(\w+)$/.exec(k);
        if (m) child.binds[m[1]] = a[k];
      });
      Object.assign(child.data, props);
      inst.children[key] = child;
      if (idAttr) inst.byId[idAttr] = child;
      const scope2 = `c-${base}`;
      if (!css.component[scope2]) css.component[scope2] = prefixCss(fs.readFileSync(path.join(dir, `${base}.wxss`), 'utf8'), scope2);
      runObservers(child, null);
      if (child.def.lifetimes && child.def.lifetimes.attached) child.def.lifetimes.attached.call(child.self);
    } else {
      const changed = Object.keys(props).filter((k) => JSON.stringify(child.data[k]) !== JSON.stringify(props[k]));
      if (changed.length) {
        changed.forEach((k) => { child.data[k] = props[k]; });
        runObservers(child, changed);
      }
    }
    const inner = renderChildren(n.children, scope, inst, env, `${keyPath}>`, slotHtml);
    const body = renderChildren(child.wxml.children, child.data, child, env, 'r', inner);
    return `<div class="c-${base} ${esc(cls)}" style="${esc(style)}">${body}</div>`;
  }

  if (n.name === 'input') {
    const v = a.value ? interp(a.value, scope) : '';
    const ph = a.placeholder ? interp(a.placeholder, scope) : '';
    return `<input class="${esc(cls)}" style="${esc(style)}" value="${esc(v)}" placeholder="${esc(ph)}">`;
  }
  if (n.name === 'slider') {
    const v = Number(interp(a.value, scope));
    const pct = ((v - Number(a.min)) / (Number(a.max) - Number(a.min))) * 100;
    return `<div class="wx-slider ${esc(cls)}"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div>`;
  }
  if (n.name === 'map') {
    return `<div class="wx-map ${esc(cls)}"><svg viewBox="0 0 343 220" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><rect width="343" height="220" fill="#DCE7E1"/><path d="M-10 160 C 80 140, 140 180, 360 140" stroke="#C3DCEB" stroke-width="22" fill="none"/><path d="M40 -10 L 70 240" stroke="#fff" stroke-width="12"/><path d="M-10 64 L 360 86" stroke="#fff" stroke-width="14"/><path d="M230 -10 L 250 240" stroke="#fff" stroke-width="9"/><rect x="150" y="96" width="70" height="46" rx="7" fill="#BFD2C9"/><circle cx="172" cy="110" r="58" fill="rgba(47,125,109,.18)" stroke="#2F7D6D" stroke-width="2"/><path d="M172 110 l-9 -20 a10 10 0 1 1 18 0 z" fill="#D9415B"/><circle cx="172" cy="87" r="3.6" fill="#fff"/></svg></div>`;
  }
  if (n.name === 'image') return `<img class="${esc(cls)}" style="${esc(style)}" src="${esc(interp(a.src, scope))}">`;

  const tag = TAG[n.name] === undefined ? 'div' : TAG[n.name];
  let extra = '';
  if (n.name === 'scroll-view') extra = a['scroll-x'] ? ';overflow-x:auto;overflow-y:hidden' : ';overflow-y:auto';
  const body = renderChildren(n.children, scope, inst, env, keyPath, slotHtml);
  const klass = `${n.name === 'text' ? 'wx-text ' : ''}${cls}`.trim();
  return `<${tag} class="${esc(klass)}" style="${esc(style + extra)}">${body}</${tag}>`;
}

function loadAppCss() {
  let app = fs.readFileSync(path.join(MP, 'app.wxss'), 'utf8');
  app = app.replace(/@import\s+"([^"]+)";/g, (_, p) => fs.readFileSync(path.join(MP, p), 'utf8'));
  return app.replace(/(^|\n)page\s*\{/g, '$1.page-root {');
}

/**
 * 渲染一个页面。
 * @param {string} route 例如 'pages/student/checkin/checkin'
 * @param {object} mock  { api(action,data), location(), storage }
 * @param {function} [act] 页面加载完成后执行的操作 (page, wait) => Promise
 */
async function renderPage(route, mock, act) {
  css.component = {};
  const env = makeEnv(mock);
  const dir = path.join(MP, path.dirname(route));
  const page = instantiate(dir, path.basename(route), env, 'page');
  env.pages.push(page.self);
  const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
  const render = () => renderChildren(page.wxml.children, page.data, page, env, 'p');
  if (page.def.onLoad) await page.def.onLoad.call(page.self, mock.query || {});
  if (page.def.onShow) page.def.onShow.call(page.self);
  render();
  await wait(120);
  render();
  await wait(120);
  if (act) await act(page.self, wait, render);
  render();
  await wait(450);
  const html = render();
  const pageCss = fs.readFileSync(path.join(dir, `${path.basename(route)}.wxss`), 'utf8');
  const allCss = rpx(loadAppCss() + '\n' + pageCss + '\n' + Object.values(css.component).join('\n'));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:375px;height:${mock.height || 812}px;overflow:hidden}
body{font-family:"Noto Sans SC",sans-serif;-webkit-font-smoothing:antialiased}
.page-root{min-height:100%} .wx-text{display:inline} div{box-sizing:border-box}
input{border:0;outline:0;font:inherit;background:transparent;box-sizing:border-box}
input::placeholder{color:#7E958F;font-weight:400;letter-spacing:0}
.wx-slider{position:relative;height:28px;margin:4px 2px}.wx-slider::before{content:"";position:absolute;left:0;right:0;top:12px;height:4px;border-radius:2px;background:#DCE6E1}
.wx-slider i{position:absolute;left:0;top:12px;height:4px;border-radius:2px;background:#2F7D6D}.wx-slider b{position:absolute;top:1px;width:26px;height:26px;margin-left:-13px;border-radius:50%;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.25)}
.wx-map{width:100%;height:100%}
${allCss}
/* 模拟胶囊按钮 */
.capsule-sim{position:fixed;right:7px;top:51px;width:87px;height:32px;border-radius:16px;border:1px solid rgba(19,49,46,.14);background:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:space-around;z-index:9999}
.capsule-sim i{display:block;width:16px;height:4px;background:radial-gradient(circle,#13312E 2px,transparent 2.5px) 0 0/6px 4px repeat-x}
.capsule-sim b{display:block;width:15px;height:15px;border-radius:50%;border:2.4px solid #13312E;box-sizing:border-box;box-shadow:inset 0 0 0 2.5px #fff,inset 0 0 0 8px #13312E}
.status-sim{position:fixed;left:0;right:0;top:0;height:47px;display:flex;align-items:center;justify-content:space-between;padding:0 30px 0 36px;font:600 16px "Bricolage Grotesque",sans-serif;color:#13312E;z-index:9999;pointer-events:none}
</style></head><body><div class="page-root">${html}</div><div class="status-sim"><span>9:41</span><span>●●● ▮</span></div><div class="capsule-sim"><i></i><b></b></div></body></html>`;
}

module.exports = { renderPage, parse };
