/**
 * v2 工程静态校验
 *
 * 在没有 HBuilderX 的环境下尽量把错误挡在前面：
 *   1. 所有 .vue 能否被 @vue/compiler-sfc 解析（script + template 都要能编译）
 *   2. 所有 .js 的语法（按 ESM 解析）
 *   3. pages.json 里的每个页面是否真实存在
 *   4. 相对路径 import 是否能解析到文件
 *   5. 前端调用的 action 是否都在云函数 actions 表里注册
 *
 * 用法：node scripts/v2/check.js
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '../..')
const V2 = path.join(ROOT, 'v2')
const SFC_PATH = path.join(os.homedir(), '.workbuddy-ai/tmp/vuecheck/node_modules/@vue/compiler-sfc')
const { parse, compileScript, compileTemplate } = require(SFC_PATH)

let pass = 0
const fails = []

function ok(msg) {
  pass++
  console.log('  ✓ ' + msg)
}

function fail(msg, detail) {
  fails.push({ msg, detail })
  console.log('  ✗ ' + msg + (detail ? '\n      ' + String(detail).split('\n')[0] : ''))
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue
      walk(p, out)
    } else {
      out.push(p)
    }
  }
  return out
}

const files = walk(V2)
const vueFiles = files.filter((f) => f.endsWith('.vue'))
const jsFiles = files.filter((f) => f.endsWith('.js'))
const jsonFiles = files.filter((f) => f.endsWith('.json'))

/* ---------------- 1. JSON ---------------- */
console.log('\n[1] JSON 语法')
jsonFiles.forEach((f) => {
  try {
    JSON.parse(fs.readFileSync(f, 'utf8'))
    ok(path.relative(V2, f))
  } catch (e) {
    fail(path.relative(V2, f), e.message)
  }
})

/* ---------------- 2. Vue SFC ---------------- */
console.log('\n[2] Vue 单文件组件（script + template 编译）')
vueFiles.forEach((f) => {
  const rel = path.relative(V2, f)
  const source = fs.readFileSync(f, 'utf8')
  try {
    const { descriptor, errors } = parse(source, { filename: f })
    if (errors && errors.length) throw new Error(errors[0].message)

    if (descriptor.script) {
      compileScript(descriptor, { id: rel })
    }

    if (descriptor.template) {
      const r = compileTemplate({
        source: descriptor.template.content,
        filename: f,
        id: rel
      })
      if (r.errors && r.errors.length) {
        throw new Error(typeof r.errors[0] === 'string' ? r.errors[0] : r.errors[0].message)
      }
    }
    ok(rel)
  } catch (e) {
    fail(rel, e.message)
  }
})

/* ---------------- 3. JS 语法（ESM） ---------------- */
console.log('\n[3] JS 语法（按 ES Module 解析）')
const tmpDir = path.join(os.tmpdir(), 'v2-js-check-' + Date.now())
fs.mkdirSync(tmpDir, { recursive: true })

jsFiles.forEach((f) => {
  const rel = path.relative(V2, f)
  const tmp = path.join(tmpDir, rel.replace(/[\\/]/g, '_') + '.mjs')
  fs.writeFileSync(tmp, fs.readFileSync(f, 'utf8'))
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' })
    ok(rel)
  } catch (e) {
    fail(rel, String(e.stderr || e.message))
  }
})

/* ---------------- 4. 页面路由 ---------------- */
console.log('\n[4] pages.json 路由与文件对应')
const pagesJson = JSON.parse(fs.readFileSync(path.join(V2, 'pages.json'), 'utf8'))
pagesJson.pages.forEach((p) => {
  const file = path.join(V2, p.path + '.vue')
  if (fs.existsSync(file)) ok(p.path)
  else fail(p.path, '缺少文件 ' + path.relative(V2, file))
})

/* ---------------- 5. 相对路径 import ---------------- */
console.log('\n[5] 相对路径 import 解析')
const importRe = /(?:from\s+|require\()\s*['"](\.[^'"]+)['"]/g
let importFail = 0
const allSrc = vueFiles.concat(jsFiles)
allSrc.forEach((f) => {
  const src = fs.readFileSync(f, 'utf8')
  let m
  while ((m = importRe.exec(src))) {
    const spec = m[1]
    const base = path.resolve(path.dirname(f), spec)
    const candidates = [base, base + '.js', base + '.vue', path.join(base, 'index.js')]
    if (!candidates.some((c) => fs.existsSync(c) && fs.statSync(c).isFile())) {
      importFail++
      fail(path.relative(V2, f), '无法解析 ' + spec)
      return
    }
  }
})
if (!importFail) ok('全部相对路径 import 均可解析')

/* ---------------- 6. action 前后端对齐 ---------------- */
console.log('\n[6] 前端调用的 action 是否在云函数注册')
const cloudIndex = fs.readFileSync(
  path.join(V2, 'uniCloud-aliyun/cloudfunctions/api/index.js'),
  'utf8'
)
const actionBlock = cloudIndex.slice(cloudIndex.indexOf('const actions = {'))
const registered = new Set()
const regRe = /'([a-zA-Z]+\.[a-zA-Z]+)'\s*:/g
let rm
while ((rm = regRe.exec(actionBlock))) registered.add(rm[1])
registered.add('init')

const requestSrc = fs.readFileSync(path.join(V2, 'common/request.js'), 'utf8')
const usedRe = /call\('([a-zA-Z]+\.[a-zA-Z]+)'/g
const used = new Set()
let um
while ((um = usedRe.exec(requestSrc))) used.add(um[1])
used.add('init')

let missing = 0
used.forEach((a) => {
  if (!registered.has(a)) {
    missing++
    fail('action ' + a, '云函数未注册')
  }
})
if (!missing) ok(`前端 ${used.size} 个 action 全部已注册`)

/* ---------------- 7. mock 覆盖 ---------------- */
console.log('\n[7] 离线 mock 覆盖度')
const mockSrc = fs.readFileSync(path.join(V2, 'common/mock.js'), 'utf8')
let uncovered = 0
used.forEach((a) => {
  if (mockSrc.indexOf(`'${a}'`) < 0) {
    uncovered++
    console.log('  ! mock 未实现：' + a)
  }
})
if (!uncovered) ok('全部 action 均有离线实现')

/* ---------------- 8. 组件生命周期 ---------------- */
console.log('\n[8] 组件不应使用页面生命周期')
const PAGE_HOOKS = ['onLoad', 'onShow', 'onHide', 'onUnload', 'onReady', 'onPullDownRefresh']
const compFiles = vueFiles.filter((f) => /[\\/]components[\\/]/.test(f))
compFiles.forEach((f) => {
  const src = fs.readFileSync(f, 'utf8')
  const bad = PAGE_HOOKS.filter((h) => new RegExp('^\\s{2}' + h + '\\s*\\(', 'm').test(src))
  if (bad.length) fail(path.relative(V2, f), '组件里使用了页面生命周期：' + bad.join(', '))
  else ok(path.relative(V2, f))
})

/* ---------------- 汇总 ---------------- */
console.log('\n' + '='.repeat(52))
console.log(`通过 ${pass} 项，失败 ${fails.length} 项`)
console.log('='.repeat(52))
if (fails.length) process.exitCode = 1
