/**
 * 云函数 api · 课程签到系统全部业务逻辑
 *
 * 为什么只有一个云函数：
 *   三张表的系统体量很小，按「域」拆成 4~5 个函数会让公共代码被迫复制多份
 *   （uniCloud 每个函数独立打包）。用一个函数 + action 分发，公共逻辑只存在一份，
 *   部署也只需要上传一次，出错的概率最低。
 *
 * 调用约定：
 *   uniCloud.callFunction({ name: 'api', data: { action, token, ...payload } })
 *   返回 { code, msg, data }
 *
 * 安全边界：
 *   - 客户端不直连数据库（三张表的 schema 权限均为 false），只能经过本函数
 *   - 距离、时间窗、去重全部在服务端判定，客户端上报的只有经纬度
 *   - 登录态是无状态 HMAC 令牌，不额外占用一张会话表
 */
const { ok, CODE, BizError, assert, withHandler } = require('./lib/response')
const { hashPassword, verifyPassword, signToken, verifyToken } = require('./lib/crypto')
const T = require('./lib/time')
const { haversine, isValidLatLng } = require('./lib/distance')
const { buildSeed } = require('./lib/seed')

const db = uniCloud.database()

const C = {
  users: 'users',
  courses: 'courses',
  records: 'sign_records'
}

/* ------------------------------------------------------------------ */
/* 通用工具                                                            */
/* ------------------------------------------------------------------ */

function str(v) {
  return v === undefined || v === null ? '' : String(v).trim()
}

function num(v, fallback) {
  const n = Number(v)
  return isFinite(n) ? n : fallback
}

/** 对外输出的用户对象（绝不包含密码） */
function publicUser(u) {
  if (!u) return null
  return {
    _id: u._id,
    account: u.account,
    name: u.name,
    role: u.role,
    className: u.className || '',
    title: u.title || '',
    status: u.status === undefined ? 1 : u.status
  }
}

function isDuplicateKeyError(err) {
  const msg = String((err && (err.message || err.errMsg)) || '')
  return /duplicate key|E11000|已存在|duplicate/i.test(msg) || (err && err.errCode === -501001)
}

async function findOne(collection, where) {
  const res = await db.collection(collection).where(where).limit(1).get()
  return (res.data && res.data[0]) || null
}

/** 从 event.token 解析当前用户 */
async function currentUser(event) {
  const payload = verifyToken(str(event.token))
  assert(payload && payload.uid, CODE.UNAUTH)
  const user = await findOne(C.users, { _id: payload.uid })
  assert(user, CODE.UNAUTH, '账号不存在，请重新登录')
  assert(Number(user.status) === 1, CODE.FORBIDDEN, '账号已被停用')
  return user
}

/** 角色校验，返回当前用户 */
async function requireRole(event, roles) {
  const user = await currentUser(event)
  assert(roles.indexOf(user.role) >= 0, CODE.FORBIDDEN)
  return user
}

/* ------------------------------------------------------------------ */
/* 初始化演示数据                                                       */
/* ------------------------------------------------------------------ */

async function initSeed() {
  const seed = buildSeed()
  const idMap = {}
  const now = new Date()

  /*
   * 按账号逐个补齐，而不是「表里有数据就整体跳过」。
   *
   * 早期版本用的是 `if (users.count() > 0) return`，结果是：用户只要先注册了
   * 一个学生账号，演示数据就永远进不来，管理员和教师账号全部缺失，
   * 表现为「学生能登、教师和管理员登不上」。
   * 现在改成逐条判重，既能补齐缺失账号，又不会产生重复。
   */
  let addedUsers = 0
  let skippedUsers = 0

  for (const u of seed.users) {
    const exists = await findOne(C.users, { account: u.account })
    if (exists) {
      idMap[u.account] = exists._id
      skippedUsers += 1
      continue
    }
    const doc = {
      account: u.account,
      password: hashPassword(u.password),
      name: u.name,
      role: u.role,
      className: u.className || '',
      title: u.title || '',
      phone: u.phone || '',
      email: u.email || '',
      status: 1,
      createTime: now
    }
    const res = await db.collection(C.users).add(doc)
    idMap[u.account] = res.id
    addedUsers += 1
  }

  // 课程按「名称 + 星期 + 开始时间」判重
  let addedCourses = 0
  let skippedCourses = 0

  for (const c of seed.courses) {
    const exists = await findOne(C.courses, {
      name: c.name,
      weekday: c.weekday,
      startTime: c.startTime
    })
    if (exists) {
      skippedCourses += 1
      continue
    }
    const teacher = seed.users.find((u) => u.account === c.teacherAccount)
    await db.collection(C.courses).add({
      name: c.name,
      teacherId: idMap[c.teacherAccount],
      teacherName: teacher ? teacher.name : '',
      weekday: c.weekday,
      startTime: c.startTime,
      endTime: c.endTime,
      locationName: c.locationName,
      latitude: c.latitude,
      longitude: c.longitude,
      radius: c.radius,
      status: c.status,
      createTime: now,
      updateTime: now
    })
    addedCourses += 1
  }

  const seeded = addedUsers > 0 || addedCourses > 0

  return ok(
    {
      seeded,
      added: { users: addedUsers, courses: addedCourses },
      skipped: { users: skippedUsers, courses: skippedCourses },
      counts: { users: seed.users.length, courses: seed.courses.length },
      accounts: {
        admin: { account: 'admin', password: seed.defaultPassword },
        teacher: { account: 'T1001', password: seed.defaultPassword },
        student: { account: '20230101001', password: seed.defaultPassword }
      }
    },
    seeded ? '演示数据初始化完成' : '演示数据已存在，无需重复初始化'
  )
}

/* ------------------------------------------------------------------ */
/* 认证                                                                */
/* ------------------------------------------------------------------ */

async function authRegister(event) {
  const account = str(event.account)
  const password = str(event.password)
  const name = str(event.name)
  const className = str(event.className)

  assert(/^[A-Za-z0-9]{4,20}$/.test(account), CODE.PARAM, '账号需为 4~20 位字母或数字')
  assert(password.length >= 6 && password.length <= 32, CODE.PARAM, '密码需为 6~32 位')
  assert(name.length >= 1 && name.length <= 20, CODE.PARAM, '请填写真实姓名')
  assert(className.length <= 40, CODE.PARAM, '班级名称过长')

  const existed = await findOne(C.users, { account })
  assert(!existed, CODE.DUPLICATE, '该账号已被注册')

  // 注册一律是学生。教师与管理员由管理员在后台创建，
  // 否则任何人都能注册成老师，身份体系直接失效。
  const doc = {
    account,
    password: hashPassword(password),
    name,
    role: 'student',
    className,
    title: '',
    phone: '',
    email: '',
    status: 1,
    createTime: new Date()
  }
  const res = await db.collection(C.users).add(doc)
  doc._id = res.id

  return ok(
    { token: signToken({ uid: res.id, role: 'student' }), user: publicUser(doc) },
    '注册成功'
  )
}

async function authLogin(event) {
  const account = str(event.account)
  const password = str(event.password)
  assert(account, CODE.PARAM, '请输入账号')
  assert(password, CODE.PARAM, '请输入密码')

  const user = await findOne(C.users, { account })
  assert(user, CODE.UNAUTH, '账号或密码错误')
  assert(Number(user.status) === 1, CODE.FORBIDDEN, '账号已被停用，请联系管理员')
  assert(verifyPassword(password, user.password), CODE.UNAUTH, '账号或密码错误')

  return ok(
    { token: signToken({ uid: user._id, role: user.role }), user: publicUser(user) },
    '登录成功'
  )
}

async function authMe(event) {
  const user = await currentUser(event)
  return ok(publicUser(user))
}

/* ------------------------------------------------------------------ */
/* 课程                                                                */
/* ------------------------------------------------------------------ */

function normalizeCourse(c) {
  return {
    _id: c._id,
    name: c.name,
    teacherId: c.teacherId || '',
    teacherName: c.teacherName || '',
    weekday: Number(c.weekday),
    startTime: c.startTime,
    endTime: c.endTime,
    locationName: c.locationName || '',
    latitude: Number(c.latitude),
    longitude: Number(c.longitude),
    radius: Number(c.radius) > 0 ? Number(c.radius) : 50,
    status: Number(c.status) === 1 ? 1 : 0,
    createTime: c.createTime,
    updateTime: c.updateTime
  }
}

function sortCourses(list) {
  return list.sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday
    return T.parseHM(a.startTime) - T.parseHM(b.startTime)
  })
}

async function courseList(event) {
  // 学生只看到启用课程；管理员与教师看到全部
  let where = {}
  if (str(event.scope) === 'enabled') where.status = 1
  if (!event.token) where.status = 1

  if (event.token) {
    const user = await currentUser(event)
    if (user.role === 'student') where.status = 1
  }

  const res = await db.collection(C.courses).where(where).limit(200).get()
  return ok(sortCourses((res.data || []).map(normalizeCourse)))
}

function validateCoursePayload(p) {
  const name = str(p.name)
  assert(name.length >= 1 && name.length <= 30, CODE.PARAM, '课程名称需为 1~30 个字')

  const weekday = num(p.weekday, 0)
  assert(weekday >= 1 && weekday <= 7, CODE.PARAM, '请选择上课星期')

  const startMin = T.parseHM(str(p.startTime))
  const endMin = T.parseHM(str(p.endTime))
  assert(isFinite(startMin) && isFinite(endMin), CODE.PARAM, '请填写正确的上课时间')
  assert(endMin > startMin, CODE.PARAM, '下课时间必须晚于上课时间')

  const radius = num(p.radius, 50)
  assert(radius >= 10 && radius <= 1000, CODE.PARAM, '距离阈值需在 10 ~ 1000 米之间')

  assert(isValidLatLng(p.latitude, p.longitude), CODE.PARAM, '请设置有效的签到点位坐标')

  return {
    name,
    weekday,
    startTime: T.toHM(startMin),
    endTime: T.toHM(endMin),
    locationName: str(p.locationName).slice(0, 40),
    latitude: num(p.latitude, 0),
    longitude: num(p.longitude, 0),
    radius: Math.round(radius),
    status: num(p.status, 1) === 0 ? 0 : 1
  }
}

async function courseSave(event) {
  await requireRole(event, ['admin'])
  const data = validateCoursePayload(event)

  const teacherId = str(event.teacherId)
  assert(teacherId, CODE.PARAM, '请选择授课教师')
  const teacher = await findOne(C.users, { _id: teacherId })
  assert(teacher && teacher.role === 'teacher', CODE.PARAM, '授课教师不存在')

  const doc = { ...data, teacherId, teacherName: teacher.name, updateTime: new Date() }

  if (str(event.id)) {
    const existed = await findOne(C.courses, { _id: str(event.id) })
    assert(existed, CODE.NOT_FOUND, '课程不存在或已被删除')
    await db.collection(C.courses).doc(str(event.id)).update(doc)
    return ok({ _id: str(event.id) }, '课程已更新')
  }

  doc.createTime = new Date()
  const res = await db.collection(C.courses).add(doc)
  return ok({ _id: res.id }, '课程已创建')
}

async function courseRemove(event) {
  await requireRole(event, ['admin'])
  const id = str(event.id)
  assert(id, CODE.PARAM, '缺少课程 ID')

  const existed = await findOne(C.courses, { _id: id })
  assert(existed, CODE.NOT_FOUND, '课程不存在或已被删除')

  // 签到记录是教学凭证，不随课程删除而消失（课程名已冗余在记录里）
  const cnt = await db.collection(C.records).where({ courseId: id }).count()

  await db.collection(C.courses).doc(id).remove()
  return ok({ removedRecords: 0, keptRecords: cnt.total }, '课程已删除，历史签到记录已保留')
}

async function teacherList(event) {
  await requireRole(event, ['admin'])
  const res = await db.collection(C.users).where({ role: 'teacher' }).limit(200).get()
  return ok((res.data || []).map(publicUser))
}

async function userList(event) {
  const me = await requireRole(event, ['admin'])
  const role = str(event.role)
  const keyword = str(event.keyword)
  const page = Math.max(1, num(event.page, 1))
  const pageSize = Math.min(100, Math.max(1, num(event.pageSize, 20)))

  const where = {}
  if (role) where.role = role
  const res = await db.collection(C.users).where(where).limit(1000).get()
  let list = (res.data || []).map(publicUser)

  if (keyword) {
    const k = keyword.toLowerCase()
    list = list.filter(
      (u) =>
        (u.name || '').toLowerCase().indexOf(k) >= 0 ||
        (u.account || '').toLowerCase().indexOf(k) >= 0 ||
        (u.className || '').toLowerCase().indexOf(k) >= 0
    )
  }
  list.sort((a, b) => String(a.account).localeCompare(String(b.account)))

  const total = list.length
  const start = (page - 1) * pageSize
  return ok({ list: list.slice(start, start + pageSize), total, page, pageSize, me: publicUser(me) })
}

async function userCreate(event) {
  await requireRole(event, ['admin'])
  const account = str(event.account)
  const name = str(event.name)
  const role = str(event.role) || 'student'
  const password = str(event.password) || '123456'

  assert(['teacher', 'student'].indexOf(role) >= 0, CODE.PARAM, '角色只能是教师或学生')
  assert(/^[A-Za-z0-9]{4,20}$/.test(account), CODE.PARAM, '账号需为 4~20 位字母或数字')
  assert(name, CODE.PARAM, '请填写姓名')
  assert(password.length >= 6, CODE.PARAM, '密码至少 6 位')

  const existed = await findOne(C.users, { account })
  assert(!existed, CODE.DUPLICATE, '该账号已存在')

  const res = await db.collection(C.users).add({
    account,
    password: hashPassword(password),
    name,
    role,
    className: str(event.className),
    title: str(event.title),
    phone: '',
    email: '',
    status: 1,
    createTime: new Date()
  })

  return ok({ _id: res.id, account, name, role }, '账号已创建')
}

/* ------------------------------------------------------------------ */
/* 签到                                                                */
/* ------------------------------------------------------------------ */

/**
 * 挑选「当前该显示哪门课」
 * 优先级：今天正在窗口内 → 今天尚未开始 → 未来 7 天最近一节
 */
function pickCurrentCourse(list, nowParts) {
  const today = list.filter((c) => Number(c.weekday) === nowParts.weekday)
  const decorated = today
    .map((c) => ({ course: c, win: T.windowOf(c, nowParts) }))
    .sort((a, b) => T.parseHM(a.course.startTime) - T.parseHM(b.course.startTime))

  const open = decorated.find((x) => x.win.state === 'open')
  if (open) return { ...open, daysUntil: 0 }

  const before = decorated.find((x) => x.win.state === 'before')
  if (before) return { ...before, daysUntil: 0 }

  // 未来 7 天（含今天已结束的情况）
  for (let d = 1; d <= 7; d++) {
    const wd = ((nowParts.weekday - 1 + d) % 7) + 1
    const dayList = list
      .filter((c) => Number(c.weekday) === wd)
      .sort((a, b) => T.parseHM(a.startTime) - T.parseHM(b.startTime))
    if (dayList.length) {
      const c = dayList[0]
      return { course: c, win: T.windowOf(c, nowParts), daysUntil: d }
    }
  }
  return null
}

async function signContext(event) {
  const user = await requireRole(event, ['student'])
  const nowParts = T.bjParts()
  const res = await db.collection(C.courses).where({ status: 1 }).limit(200).get()
  const list = (res.data || []).map(normalizeCourse)

  let picked = null
  if (str(event.courseId)) {
    const c = list.find((x) => x._id === str(event.courseId))
    if (c) picked = { course: c, win: T.windowOf(c, nowParts), daysUntil: 0 }
  }
  if (!picked) picked = pickCurrentCourse(list, nowParts)

  if (!picked) {
    return ok({ course: null, window: { state: 'none' }, signed: false, serverTime: T.formatBJ() })
  }

  // 只有今天且窗口内才需要查「是否已签」
  let signed = false
  let record = null
  if (picked.daysUntil === 0) {
    const r = await findOne(C.records, {
      userId: user._id,
      courseId: picked.course._id,
      sessionDate: nowParts.dateKey
    })
    if (r) {
      signed = true
      record = {
        _id: r._id,
        signTime: r.signTime,
        signTimeText: T.formatTimeBJ(r.signTime),
        distance: r.distance,
        result: r.result
      }
    }
  }

  return ok({
    course: picked.course,
    window: { ...picked.win, daysUntil: picked.daysUntil, weekday: picked.course.weekday },
    signed,
    record,
    serverTime: T.formatBJ()
  })
}

async function signSubmit(event) {
  const user = await requireRole(event, ['student'])
  const courseId = str(event.courseId)
  assert(courseId, CODE.PARAM, '缺少课程信息')

  const latitude = Number(event.latitude)
  const longitude = Number(event.longitude)
  assert(isValidLatLng(latitude, longitude), CODE.PARAM, '定位数据不合法，请重新定位后再试')

  const course = await findOne(C.courses, { _id: courseId })
  assert(course, CODE.NO_COURSE, '课程不存在或已被删除')
  assert(Number(course.status) === 1, CODE.NO_COURSE, '该课程已停用，无法签到')

  const nowParts = T.bjParts()
  const win = T.windowOf(course, nowParts)

  // ---- 时间窗（服务端时间，客户端改不了） ----
  if (win.state !== 'open') {
    const text =
      win.state === 'before'
        ? `签到将在开课前 ${T.OPEN_BEFORE_MIN} 分钟开启（${win.openAt}）`
        : win.state === 'after'
        ? `本节签到已于 ${win.closeAt} 结束`
        : '今天没有这门课'
    throw new BizError(CODE.NOT_IN_WINDOW, text, { state: win.state, window: win })
  }

  // ---- 距离（服务端计算） ----
  const distance = haversine(latitude, longitude, course.latitude, course.longitude)
  const radius = Number(course.radius) > 0 ? Number(course.radius) : 50
  if (distance > radius) {
    throw new BizError(
      CODE.OUT_OF_RANGE,
      `当前位置距离签到点位 ${Math.round(distance)} 米，超出允许范围 ${radius} 米`,
      { status: 'OUT_OF_RANGE', distance, radius, locationName: course.locationName }
    )
  }

  // ---- 快路径去重 ----
  const sessionDate = nowParts.dateKey
  const existed = await findOne(C.records, { userId: user._id, courseId, sessionDate })
  if (existed) {
    throw new BizError(CODE.ALREADY_SIGNED, '本节课已签到，不可重复签到', {
      status: 'ALREADY_SIGNED',
      signTime: existed.signTime,
      signTimeText: T.formatTimeBJ(existed.signTime),
      distance: existed.distance
    })
  }

  // ---- 写入（唯一索引兜底，防并发） ----
  const doc = {
    userId: user._id,
    userName: user.name,
    account: user.account,
    className: user.className || '',
    courseId,
    courseName: course.name,
    teacherName: course.teacherName || '',
    sessionDate,
    signTime: new Date(),
    result: 'success',
    distance,
    latitude,
    longitude,
    accuracy: num(event.accuracy, 0),
    deviceId: str(event.deviceId).slice(0, 64),
    createTime: new Date()
  }

  try {
    const res = await db.collection(C.records).add(doc)
    doc._id = res.id
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // 并发场景：两个请求同时通过了快路径，第二个被唯一索引拒绝
      console.warn('唯一索引拦截并发重复签到', user._id, courseId, sessionDate)
      throw new BizError(CODE.ALREADY_SIGNED, '本节课已签到，不可重复签到', {
        status: 'ALREADY_SIGNED'
      })
    }
    throw err
  }

  return ok(
    {
      status: 'SUCCESS',
      recordId: doc._id,
      courseName: course.name,
      teacherName: course.teacherName,
      locationName: course.locationName,
      sessionDate,
      signTimeText: T.formatTimeBJ(doc.signTime),
      distance,
      radius
    },
    '签到成功'
  )
}

/* ------------------------------------------------------------------ */
/* 签到记录                                                            */
/* ------------------------------------------------------------------ */

function normalizeRecord(r) {
  return {
    _id: r._id,
    userId: r.userId,
    userName: r.userName,
    account: r.account,
    className: r.className,
    courseId: r.courseId,
    courseName: r.courseName,
    teacherName: r.teacherName,
    sessionDate: r.sessionDate,
    signTime: r.signTime,
    signTimeText: T.formatBJ(r.signTime),
    result: r.result || 'success',
    distance: r.distance,
    latitude: r.latitude,
    longitude: r.longitude
  }
}

async function recordMine(event) {
  const user = await requireRole(event, ['student'])
  const res = await db
    .collection(C.records)
    .where({ userId: user._id })
    .orderBy('signTime', 'desc')
    .limit(200)
    .get()
  return ok((res.data || []).map(normalizeRecord))
}

/** 管理员/教师的记录查询（教师只看自己课程） */
async function queryRecords(event, me) {
  const where = {}
  const courseId = str(event.courseId)
  if (courseId) where.courseId = courseId

  // 教师只能看自己课程
  if (me.role === 'teacher') {
    const cs = await db.collection(C.courses).where({ teacherId: me._id }).limit(200).get()
    const ids = (cs.data || []).map((c) => c._id)
    if (!ids.length) return []
    where.courseId = courseId && ids.indexOf(courseId) >= 0 ? courseId : db.command.in(ids)
  }

  const res = await db
    .collection(C.records)
    .where(where)
    .orderBy('signTime', 'desc')
    .limit(1000)
    .get()

  let list = (res.data || []).map(normalizeRecord)

  const dateFrom = str(event.dateFrom)
  const dateTo = str(event.dateTo)
  if (dateFrom) list = list.filter((r) => r.sessionDate >= dateFrom)
  if (dateTo) list = list.filter((r) => r.sessionDate <= dateTo)

  const keyword = str(event.keyword)
  if (keyword) {
    const k = keyword.toLowerCase()
    list = list.filter(
      (r) =>
        (r.userName || '').toLowerCase().indexOf(k) >= 0 ||
        (r.account || '').toLowerCase().indexOf(k) >= 0 ||
        (r.courseName || '').toLowerCase().indexOf(k) >= 0
    )
  }
  return list
}

async function recordList(event) {
  const me = await requireRole(event, ['admin', 'teacher'])
  const list = await queryRecords(event, me)

  const page = Math.max(1, num(event.page, 1))
  const pageSize = Math.min(100, Math.max(1, num(event.pageSize, 20)))
  const start = (page - 1) * pageSize

  const today = T.bjParts().dateKey
  const students = {}
  list.forEach((r) => {
    students[r.userId] = 1
  })

  return ok({
    list: list.slice(start, start + pageSize),
    total: list.length,
    page,
    pageSize,
    stats: {
      total: list.length,
      today: list.filter((r) => r.sessionDate === today).length,
      students: Object.keys(students).length
    },
    role: me.role
  })
}

async function recordRemove(event) {
  await requireRole(event, ['admin'])
  const id = str(event.id)
  assert(id, CODE.PARAM, '缺少记录 ID')
  const existed = await findOne(C.records, { _id: id })
  assert(existed, CODE.NOT_FOUND, '记录不存在')
  await db.collection(C.records).doc(id).remove()
  return ok({ _id: id }, '记录已删除')
}

/**
 * 懒加载 xlsx
 *
 * 放在函数体内按需 require，好处是「云端没装依赖」时只有导出功能不可用，
 * 不会让整个云函数在加载阶段就崩掉（那样连登录都会失败）。
 * 缺失时给出可操作的提示，而不是一句 MODULE_NOT_FOUND 让人猜。
 */
function loadXLSX() {
  try {
    return require('xlsx')
  } catch (err) {
    throw new BizError(
      CODE.SYS,
      '云端未安装 xlsx 依赖。请右键 cloudfunctions/api → 上传部署，勾选「云端安装依赖」；或在云函数控制台的「依赖管理」中上传 package.json 后安装。'
    )
  }
}

/** 导出 Excel（依赖 xlsx，需在 HBuilderX 中选择「上传并安装依赖」） */
async function recordExport(event) {
  const me = await requireRole(event, ['admin', 'teacher'])
  const XLSX = loadXLSX()
  const list = await queryRecords(event, me)

  const header = [
    '序号',
    '课程名称',
    '授课教师',
    '学号',
    '姓名',
    '班级',
    '上课日期',
    '签到时间',
    '签到结果',
    '距点位距离(米)',
    '签到纬度',
    '签到经度'
  ]
  const rows = list.map((r, i) => [
    i + 1,
    r.courseName,
    r.teacherName,
    r.account,
    r.userName,
    r.className,
    r.sessionDate,
    r.signTimeText,
    '成功',
    Math.round(r.distance),
    r.latitude,
    r.longitude
  ])

  const ws = XLSX.utils.aoa_to_sheet([header].concat(rows))
  ws['!cols'] = [
    { wch: 6 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 26 },
    { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '签到记录')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const stamp = T.formatBJ().replace(/[-: ]/g, '')
  const uploaded = await uniCloud.uploadFile({
    cloudPath: `exports/签到记录_${stamp}.xlsx`,
    fileContent: buffer
  })

  return ok({ fileID: uploaded.fileID, count: rows.length }, `已生成 ${rows.length} 条记录`)
}

/* ------------------------------------------------------------------ */
/* 概览                                                                */
/* ------------------------------------------------------------------ */

async function statsOverview(event) {
  const me = await requireRole(event, ['admin', 'teacher'])
  const [courses, users, records] = await Promise.all([
    db.collection(C.courses).limit(200).get(),
    db.collection(C.users).limit(500).get(),
    db.collection(C.records).orderBy('signTime', 'desc').limit(200).get()
  ])

  let courseList = courses.data || []
  if (me.role === 'teacher') courseList = courseList.filter((c) => c.teacherId === me._id)
  const courseIds = courseList.map((c) => c._id)

  const allUsers = users.data || []
  const allRecords = (records.data || []).filter(
    (r) => me.role === 'admin' || courseIds.indexOf(r.courseId) >= 0
  )
  const today = T.bjParts().dateKey

  return ok({
    role: me.role,
    courseCount: courseList.length,
    teacherCount: allUsers.filter((u) => u.role === 'teacher').length,
    studentCount: allUsers.filter((u) => u.role === 'student').length,
    todaySignCount: allRecords.filter((r) => r.sessionDate === today).length,
    recent: allRecords.slice(0, 8).map(normalizeRecord),
    todayCourses: sortCourses(
      courseList
        .filter((c) => Number(c.weekday) === T.bjParts().weekday)
        .map(normalizeCourse)
    )
  })
}

/* ------------------------------------------------------------------ */
/* 路由                                                                */
/* ------------------------------------------------------------------ */

const actions = {
  init: initSeed,

  'auth.register': authRegister,
  'auth.login': authLogin,
  'auth.me': authMe,

  'course.list': courseList,
  'course.save': courseSave,
  'course.remove': courseRemove,
  'teacher.list': teacherList,

  'user.list': userList,
  'user.create': userCreate,

  'sign.context': signContext,
  'sign.submit': signSubmit,

  'record.mine': recordMine,
  'record.list': recordList,
  'record.remove': recordRemove,
  'record.export': recordExport,

  'stats.overview': statsOverview
}

exports.main = withHandler(async (event, context) => {
  const action = str(event.action)
  assert(action, CODE.PARAM, '缺少 action')
  const handler = actions[action]
  assert(handler, CODE.PARAM, `未知的 action：${action}`)
  return handler(event, context)
})
