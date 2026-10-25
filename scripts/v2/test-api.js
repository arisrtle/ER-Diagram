/**
 * 云函数业务逻辑自测（不需要部署）
 *
 * 做法：用内存数据库模拟 uniCloud 的数据库 API，把 cloudfunctions/api/index.js
 * 原样加载进来跑真实分支。这样可以在没有服务空间的情况下验证：
 *   时间窗判定 / 距离拦截 / 一人一课一节一次 / 角色权限 / 唯一索引兜底
 *
 * 用法：node scripts/v2/test-api.js
 */
const path = require('path')
const assert = require('assert')

/* ------------------------------------------------------------------ */
/* 内存数据库                                                          */
/* ------------------------------------------------------------------ */

const store = {}
let seq = 0
const nextId = () => 'id_' + ++seq

function matchDoc(doc, cond) {
  if (!cond) return true
  return Object.keys(cond).every((k) => {
    const expect = cond[k]
    if (expect && typeof expect === 'object' && expect.__op === 'in') {
      return expect.value.indexOf(doc[k]) >= 0
    }
    return doc[k] === expect
  })
}

class Query {
  constructor(name, cond) {
    this.name = name
    this.cond = cond || null
    this._limit = 100
    this._order = null
  }
  where(cond) {
    this.cond = cond
    return this
  }
  orderBy(field, dir) {
    this._order = { field, dir }
    return this
  }
  limit(n) {
    this._limit = n
    return this
  }
  get() {
    let list = (store[this.name] || []).filter((d) => matchDoc(d, this.cond))
    if (this._order) {
      const { field, dir } = this._order
      list = list.slice().sort((a, b) => {
        const x = a[field]
        const y = b[field]
        const r = x > y ? 1 : x < y ? -1 : 0
        return dir === 'desc' ? -r : r
      })
    }
    return Promise.resolve({ data: list.slice(0, this._limit).map((d) => ({ ...d })) })
  }
  count() {
    const total = (store[this.name] || []).filter((d) => matchDoc(d, this.cond)).length
    return Promise.resolve({ total })
  }
}

function collection(name) {
  if (!store[name]) store[name] = []
  const q = new Query(name)
  return {
    where: (cond) => new Query(name, cond),
    orderBy: (f, d) => new Query(name).orderBy(f, d),
    limit: (n) => new Query(name).limit(n),
    count: () => new Query(name).count(),
    get: () => new Query(name).get(),
    add(doc) {
      // 模拟 records 的复合唯一索引 (userId + courseId + sessionDate)
      if (name === 'sign_records') {
        const dup = store[name].some(
          (d) =>
            d.userId === doc.userId &&
            d.courseId === doc.courseId &&
            d.sessionDate === doc.sessionDate
        )
        if (dup) {
          const err = new Error('E11000 duplicate key error collection: sign_records')
          err.errCode = -501001
          return Promise.reject(err)
        }
      }
      const _id = nextId()
      store[name].push({ ...doc, _id })
      return Promise.resolve({ id: _id })
    },
    doc(id) {
      return {
        get: () =>
          Promise.resolve({
            data: (store[name] || []).find((d) => d._id === id) || null
          }),
        update(patch) {
          const target = (store[name] || []).find((d) => d._id === id)
          if (target) Object.assign(target, patch)
          return Promise.resolve({ updated: target ? 1 : 0 })
        },
        remove() {
          const i = (store[name] || []).findIndex((d) => d._id === id)
          if (i >= 0) store[name].splice(i, 1)
          return Promise.resolve({ removed: i >= 0 ? 1 : 0 })
        }
      }
    }
  }
}

const db = {
  collection,
  command: {
    in: (arr) => ({ __op: 'in', value: arr })
  }
}

global.uniCloud = {
  database: () => db,
  uploadFile: () => Promise.resolve({ fileID: 'cloud://mock/exports/demo.xlsx' })
}

const api = require(path.join(__dirname, '../../v2/uniCloud-aliyun/cloudfunctions/api/index.js'))

/* ------------------------------------------------------------------ */
/* 测试脚手架                                                          */
/* ------------------------------------------------------------------ */

let pass = 0
const failures = []

async function run(name, fn) {
  try {
    await fn()
    pass++
    console.log('  ✓ ' + name)
  } catch (e) {
    failures.push({ name, e })
    console.log('  ✗ ' + name + '\n      ' + e.message)
  }
}

function expectCode(res, code) {
  assert.strictEqual(res.code, code, `期望 code=${code}，实际 ${res.code}（${res.msg}）`)
}

const call = (data) => api.main(data, {})

/* ------------------------------------------------------------------ */
/* 用例                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('\n[1] 初始化演示数据')
  let adminToken = ''
  let studentToken = ''
  let student2Token = ''
  let courseId = ''
  let course = null

  await run('首次初始化成功', async () => {
    const res = await call({ action: 'init' })
    expectCode(res, 0)
    assert.strictEqual(res.data.seeded, true)
  })

  await run('重复初始化被拒绝（幂等）', async () => {
    const res = await call({ action: 'init' })
    expectCode(res, 0)
    assert.strictEqual(res.data.seeded, false)
  })

  await run('用户与课程数量正确', async () => {
    const users = store.users
    const courses = store.courses
    assert.strictEqual(users.filter((u) => u.role === 'admin').length, 1)
    assert.strictEqual(users.filter((u) => u.role === 'teacher').length, 4)
    assert.strictEqual(users.filter((u) => u.role === 'student').length, 12)
    assert.strictEqual(courses.length, 7)
  })

  await run('密码不落明文', async () => {
    const u = store.users.find((x) => x.account === 'admin')
    assert.ok(u.password.indexOf(':') > 0)
    assert.ok(u.password.indexOf('123456') < 0)
  })

  console.log('\n[2] 登录与鉴权')
  await run('管理员登录', async () => {
    const res = await call({ action: 'auth.login', account: 'admin', password: '123456' })
    expectCode(res, 0)
    assert.ok(res.data.token)
    assert.strictEqual(res.data.user.role, 'admin')
    assert.strictEqual(res.data.user.password, undefined, '返回体不应包含密码')
    adminToken = res.data.token
  })

  await run('学生登录', async () => {
    const res = await call({ action: 'auth.login', account: '20230101001', password: '123456' })
    expectCode(res, 0)
    studentToken = res.data.token
  })

  await run('第二位学生登录', async () => {
    const res = await call({ action: 'auth.login', account: '20230101002', password: '123456' })
    expectCode(res, 0)
    student2Token = res.data.token
  })

  await run('错误密码被拒绝', async () => {
    const res = await call({ action: 'auth.login', account: 'admin', password: 'wrong' })
    expectCode(res, 401)
  })

  await run('无 token 访问受保护接口被拒绝', async () => {
    const res = await call({ action: 'record.list' })
    expectCode(res, 401)
  })

  await run('学生不能改课程（角色隔离）', async () => {
    const res = await call({ action: 'course.save', token: studentToken, name: 'x', teacherId: 'x' })
    expectCode(res, 403)
  })

  console.log('\n[3] 当前课程与时间窗')
  await run('学生能拿到当前课程，且窗口是开启的', async () => {
    const res = await call({ action: 'sign.context', token: studentToken })
    expectCode(res, 0)
    assert.ok(res.data.course, '应返回一门课程')
    course = res.data.course
    courseId = course._id
    assert.strictEqual(res.data.window.state, 'open', '演示课程应处于可签到窗口')
    assert.strictEqual(res.data.signed, false)
  })

  await run('签到窗口边界：开课前 11 分钟不可签', async () => {
    // 直接构造一门 11 分钟后开课的课，调用 sign.submit 应被 413 拦下
    const T = require('../../v2/uniCloud-aliyun/cloudfunctions/api/lib/time')
    const now = T.bjParts()
    const startMin = now.minutes + 11
    const id = nextId()
    store.courses.push({
      _id: id,
      name: '边界测试课',
      teacherId: store.users.find((u) => u.role === 'teacher')._id,
      teacherName: '张伟',
      weekday: now.weekday,
      startTime: T.toHM(startMin),
      endTime: T.toHM(startMin + 90),
      locationName: '测试点',
      latitude: 34.24695,
      longitude: 108.98362,
      radius: 50,
      status: 1
    })
    const res = await call({
      action: 'sign.submit',
      token: studentToken,
      courseId: id,
      latitude: 34.24695,
      longitude: 108.98362
    })
    expectCode(res, 413)
    store.courses = store.courses.filter((c) => c._id !== id)
  })

  await run('停用课程不可签到', async () => {
    const id = nextId()
    store.courses.push({
      _id: id,
      name: '停用课',
      teacherId: 'x',
      teacherName: '张伟',
      weekday: 1,
      startTime: '08:00',
      endTime: '09:40',
      locationName: '测试点',
      latitude: 34.24695,
      longitude: 108.98362,
      radius: 50,
      status: 0
    })
    const res = await call({
      action: 'sign.submit',
      token: studentToken,
      courseId: id,
      latitude: 34.24695,
      longitude: 108.98362
    })
    expectCode(res, 412)
    store.courses = store.courses.filter((c) => c._id !== id)
  })

  console.log('\n[4] 距离判定')
  await run('超出阈值被拦截，且不写入记录', async () => {
    const before = store.sign_records.length
    const res = await call({
      action: 'sign.submit',
      token: student2Token,
      courseId,
      latitude: course.latitude + 0.01,
      longitude: course.longitude
    })
    expectCode(res, 410)
    assert.ok(res.data.distance > 1000, '距离应超过 1 公里')
    assert.strictEqual(store.sign_records.length, before, '超范围不应写库')
  })

  await run('非法坐标被拒绝', async () => {
    const res = await call({
      action: 'sign.submit',
      token: studentToken,
      courseId,
      latitude: 0,
      longitude: 0
    })
    expectCode(res, 400)
  })

  console.log('\n[5] 签到与去重')
  await run('范围内签到成功', async () => {
    const res = await call({
      action: 'sign.submit',
      token: studentToken,
      courseId,
      latitude: course.latitude + 0.0001,
      longitude: course.longitude + 0.0001
    })
    expectCode(res, 0)
    assert.strictEqual(res.data.status, 'SUCCESS')
    assert.ok(res.data.distance < 50)
    assert.strictEqual(store.sign_records.length, 1)
  })

  await run('同一人同一节课重复签到被拒（411）', async () => {
    const res = await call({
      action: 'sign.submit',
      token: studentToken,
      courseId,
      latitude: course.latitude,
      longitude: course.longitude
    })
    expectCode(res, 411)
    assert.strictEqual(store.sign_records.length, 1)
  })

  await run('并发两次签到只落一条（唯一索引兜底）', async () => {
    const payload = {
      action: 'sign.submit',
      token: student2Token,
      courseId,
      latitude: course.latitude,
      longitude: course.longitude
    }
    const results = await Promise.all([call(payload), call(payload)])
    const codes = results.map((r) => r.code).sort()
    assert.deepStrictEqual(codes, [0, 411], '应一个成功一个被拒')
    const mine = store.sign_records.filter((r) => r.courseId === courseId)
    assert.strictEqual(mine.length, 2, '两名学生各一条')
    const dup = store.sign_records.filter(
      (r) => r.courseId === courseId && r.userId === mine[1].userId
    )
    assert.strictEqual(dup.length, 1, '同一人不应出现两条')
  })

  await run('已签到后 context 返回 signed=true', async () => {
    const res = await call({ action: 'sign.context', token: studentToken })
    expectCode(res, 0)
    assert.strictEqual(res.data.signed, true)
    assert.ok(res.data.record.signTimeText)
  })

  await run('签到记录带课次日期与距离', async () => {
    const r = store.sign_records[0]
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.sessionDate))
    assert.ok(r.distance >= 0)
    assert.strictEqual(r.result, 'success')
    assert.ok(r.courseName && r.teacherName, '应冗余课程与教师名')
  })

  console.log('\n[6] 课程与记录管理')
  await run('管理员新增课程', async () => {
    const teacher = store.users.find((u) => u.role === 'teacher')
    const res = await call({
      action: 'course.save',
      token: adminToken,
      name: '测试课程',
      teacherId: teacher._id,
      weekday: 6,
      startTime: '14:00',
      endTime: '15:40',
      locationName: '测试楼 101',
      latitude: 34.24695,
      longitude: 108.98362,
      radius: 80,
      status: 1
    })
    expectCode(res, 0)
    assert.ok(res.data._id)
  })

  await run('阈值越界被拒绝', async () => {
    const teacher = store.users.find((u) => u.role === 'teacher')
    const res = await call({
      action: 'course.save',
      token: adminToken,
      name: '阈值异常课',
      teacherId: teacher._id,
      weekday: 6,
      startTime: '14:00',
      endTime: '15:40',
      latitude: 34.24695,
      longitude: 108.98362,
      radius: 99999
    })
    expectCode(res, 400)
  })

  await run('下课早于上课被拒绝', async () => {
    const teacher = store.users.find((u) => u.role === 'teacher')
    const res = await call({
      action: 'course.save',
      token: adminToken,
      name: '时间倒置课',
      teacherId: teacher._id,
      weekday: 6,
      startTime: '15:00',
      endTime: '14:00',
      latitude: 34.24695,
      longitude: 108.98362,
      radius: 50
    })
    expectCode(res, 400)
  })

  await run('管理员查看记录列表', async () => {
    const res = await call({ action: 'record.list', token: adminToken })
    expectCode(res, 0)
    assert.ok(res.data.total >= 2)
    assert.ok(res.data.stats.today >= 2)
  })

  await run('教师只能看到自己课程的记录', async () => {
    const login = await call({ action: 'auth.login', account: 'T1002', password: '123456' })
    const res = await call({ action: 'record.list', token: login.data.token })
    expectCode(res, 0)
    assert.ok(res.data.list.every((r) => r.teacherName === '李静'), '不应看到其他教师的课')
  })

  await run('删除记录后可以重新签到', async () => {
    const mine = store.sign_records.find((r) => r.courseId === courseId)
    const del = await call({ action: 'record.remove', token: adminToken, id: mine._id })
    expectCode(del, 0)
    const ctx = await call({ action: 'sign.context', token: studentToken })
    assert.strictEqual(ctx.data.signed, false, '删除后应恢复可签到')
  })

  await run('学生不能删除记录', async () => {
    const any = store.sign_records[0]
    const res = await call({ action: 'record.remove', token: studentToken, id: any._id })
    expectCode(res, 403)
  })

  await run('概览统计可用', async () => {
    const res = await call({ action: 'stats.overview', token: adminToken })
    expectCode(res, 0)
    assert.ok(res.data.courseCount >= 7)
    assert.strictEqual(res.data.teacherCount, 4)
    assert.ok(Array.isArray(res.data.recent))
  })

  console.log('\n[7] 注册')
  await run('新用户注册后默认是学生', async () => {
    const res = await call({
      action: 'auth.register',
      account: '20239999',
      password: '123456',
      name: '测试同学',
      className: '测试班'
    })
    expectCode(res, 0)
    assert.strictEqual(res.data.user.role, 'student')
  })

  await run('重复账号注册被拒绝', async () => {
    const res = await call({
      action: 'auth.register',
      account: '20239999',
      password: '123456',
      name: '测试同学'
    })
    expectCode(res, 409)
  })

  await run('弱密码被拒绝', async () => {
    const res = await call({
      action: 'auth.register',
      account: '20239998',
      password: '123',
      name: '测试同学'
    })
    expectCode(res, 400)
  })

  console.log('\n[8] 补齐缺失账号（回归：先注册过学生再初始化）')

  await run('删掉管理员后重新初始化能补齐', async () => {
    const before = store.users.length
    store.users = store.users.filter((u) => u.role !== 'admin')
    assert.strictEqual(store.users.length, before - 1)

    const res = await call({ action: 'init' })
    expectCode(res, 0)
    assert.strictEqual(res.data.seeded, true, '应判定为有新写入')
    assert.strictEqual(res.data.added.users, 1, '只应补 1 个管理员')
    assert.strictEqual(res.data.skipped.users, res.data.counts.users - 1, '除管理员外其余种子账号应被跳过')
    assert.strictEqual(store.users.filter((u) => u.role === 'admin').length, 1)
  })

  await run('补齐后管理员可以登录', async () => {
    const res = await call({ action: 'auth.login', account: 'admin', password: '123456' })
    expectCode(res, 0)
    assert.strictEqual(res.data.user.role, 'admin')
  })

  await run('全部账号齐全时再次初始化不写入', async () => {
    const res = await call({ action: 'init' })
    expectCode(res, 0)
    assert.strictEqual(res.data.seeded, false)
    assert.strictEqual(res.data.added.users, 0)
    assert.strictEqual(res.data.added.courses, 0)
  })

  console.log('\n' + '='.repeat(52))
  console.log(`通过 ${pass} 项，失败 ${failures.length} 项`)
  console.log('='.repeat(52))
  if (failures.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
