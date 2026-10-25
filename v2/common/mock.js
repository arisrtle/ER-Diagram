/**
 * 离线演示数据（仅在云端不可用时启用）
 *
 * 目的：HBuilderX 还没上传云函数、或演示环境断网时，页面仍然是可点可看的，
 * 而不是一片报错。所有逻辑只做最小可用，真实判定一律以云函数为准。
 *
 * 页面顶部会显示「离线演示」标识，避免把演示数据误当成真实数据。
 */

const TOKEN_PREFIX = 'mock-'

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

function hm(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

function nowParts() {
  const d = new Date()
  return {
    weekday: d.getDay() === 0 ? 7 : d.getDay(),
    minutes: d.getHours() * 60 + d.getMinutes(),
    dateKey: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
}

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseHM(s) {
  const m = String(s).match(/^(\d{1,2}):(\d{2})$/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371008.8
  const rad = (x) => (x * Math.PI) / 180
  const dLat = rad(lat2) - rad(lat1)
  const dLng = rad(lng2) - rad(lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

const P = nowParts()
const START = P.minutes + 10

const db = {
  users: [
    { _id: 'u-admin', account: 'admin', password: '123456', name: '王敏', role: 'admin', className: '', title: '教务老师', status: 1 },
    { _id: 'u-t1', account: 'T1001', password: '123456', name: '张伟', role: 'teacher', className: '电气工程学院', title: '教授', status: 1 },
    { _id: 'u-t2', account: 'T1002', password: '123456', name: '李静', role: 'teacher', className: '数学学院', title: '副教授', status: 1 },
    { _id: 'u-s1', account: '20230101001', password: '123456', name: '李小明', role: 'student', className: '电气工程及其自动化 2301 班', status: 1 },
    { _id: 'u-s2', account: '20230101002', password: '123456', name: '王小红', role: 'student', className: '电气工程及其自动化 2301 班', status: 1 },
    { _id: 'u-s3', account: '20230101003', password: '123456', name: '赵小刚', role: 'student', className: '电气工程及其自动化 2301 班', status: 1 }
  ],
  courses: [
    { _id: 'c1', name: '自动控制原理', teacherId: 'u-t1', teacherName: '张伟', weekday: P.weekday, startTime: hm(START), endTime: hm(START + 100), locationName: '教二楼 301', latitude: 34.24695, longitude: 108.98362, radius: 50, status: 1 },
    { _id: 'c2', name: '高等数学（下）', teacherId: 'u-t2', teacherName: '李静', weekday: 1, startTime: '08:00', endTime: '09:40', locationName: '主楼 A203', latitude: 34.24712, longitude: 108.98401, radius: 50, status: 1 },
    { _id: 'c3', name: '信号与系统', teacherId: 'u-t1', teacherName: '张伟', weekday: 3, startTime: '14:00', endTime: '15:40', locationName: '教二楼 301', latitude: 34.24695, longitude: 108.98362, radius: 50, status: 1 },
    { _id: 'c4', name: '电机学', teacherId: 'u-t1', teacherName: '张伟', weekday: 4, startTime: '08:00', endTime: '09:40', locationName: '电气楼 402', latitude: 34.24831, longitude: 108.98512, radius: 80, status: 1 }
  ],
  records: [
    { _id: 'r1', userId: 'u-s2', userName: '王小红', account: '20230101002', className: '电气工程及其自动化 2301 班', courseId: 'c1', courseName: '自动控制原理', teacherName: '张伟', sessionDate: P.dateKey, signTime: new Date(Date.now() - 6 * 60000), result: 'success', distance: 18.4, latitude: 34.24698, longitude: 108.9837 },
    { _id: 'r2', userId: 'u-s3', userName: '赵小刚', account: '20230101003', className: '电气工程及其自动化 2301 班', courseId: 'c1', courseName: '自动控制原理', teacherName: '张伟', sessionDate: P.dateKey, signTime: new Date(Date.now() - 4 * 60000), result: 'success', distance: 32.1, latitude: 34.2471, longitude: 108.9835 }
  ]
}

let seq = 100

function ok(data, msg) {
  return { code: 0, msg: msg || '成功', data }
}
function fail(code, msg, data) {
  return { code, msg, data: data || null }
}

function publicUser(u) {
  return { _id: u._id, account: u.account, name: u.name, role: u.role, className: u.className || '', title: u.title || '', status: 1 }
}

function userByToken(token) {
  const id = String(token || '').replace(TOKEN_PREFIX, '')
  return db.users.find((u) => u._id === id) || null
}

function windowOf(course, p) {
  const startMin = parseHM(course.startTime)
  const endMin = parseHM(course.endTime)
  const openMin = startMin - 10
  const closeMin = endMin + 10
  const base = {
    openAt: hm(openMin),
    closeAt: hm(closeMin),
    durationMin: endMin - startMin,
    minutesToStart: startMin - p.minutes,
    minutesToClose: closeMin - p.minutes
  }
  if (course.weekday !== p.weekday) return { ...base, state: 'otherday' }
  if (p.minutes < openMin) return { ...base, state: 'before' }
  if (p.minutes > closeMin) return { ...base, state: 'after' }
  return { ...base, state: 'open' }
}

function sortedCourses(list) {
  return list.slice().sort((a, b) => (a.weekday - b.weekday) || (parseHM(a.startTime) - parseHM(b.startTime)))
}

function handle(action, payload) {
  const p = nowParts()
  const me = userByToken(payload.token)

  switch (action) {
    case 'init':
      return ok({ seeded: true, counts: { users: db.users.length, courses: db.courses.length } }, '演示数据已就绪')

    case 'auth.login': {
      const u = db.users.find((x) => x.account === String(payload.account || '').trim())
      if (!u || u.password !== payload.password) return fail(401, '账号或密码错误')
      return ok({ token: TOKEN_PREFIX + u._id, user: publicUser(u) }, '登录成功')
    }

    case 'auth.register': {
      const account = String(payload.account || '').trim()
      if (!account) return fail(400, '请输入账号')
      if (db.users.some((u) => u.account === account)) return fail(409, '该账号已被注册')
      const u = {
        _id: 'u' + ++seq,
        account,
        password: payload.password,
        name: payload.name,
        role: 'student',
        className: payload.className || '',
        status: 1
      }
      db.users.push(u)
      return ok({ token: TOKEN_PREFIX + u._id, user: publicUser(u) }, '注册成功')
    }

    case 'auth.me':
      return me ? ok(publicUser(me)) : fail(401, '登录状态已失效')

    case 'course.list': {
      const list = payload.scope === 'enabled' || !me || me.role === 'student'
        ? db.courses.filter((c) => c.status === 1)
        : db.courses
      return ok(sortedCourses(list))
    }

    case 'course.save': {
      if (!me || me.role !== 'admin') return fail(403, '无权操作')
      const t = db.users.find((u) => u._id === payload.teacherId)
      const doc = {
        name: payload.name,
        teacherId: payload.teacherId,
        teacherName: t ? t.name : '',
        weekday: Number(payload.weekday),
        startTime: payload.startTime,
        endTime: payload.endTime,
        locationName: payload.locationName,
        latitude: Number(payload.latitude),
        longitude: Number(payload.longitude),
        radius: Number(payload.radius) || 50,
        status: Number(payload.status) === 0 ? 0 : 1
      }
      if (payload.id) {
        const c = db.courses.find((x) => x._id === payload.id)
        if (!c) return fail(404, '课程不存在')
        Object.assign(c, doc)
        return ok({ _id: c._id }, '课程已更新')
      }
      const c = Object.assign({ _id: 'c' + ++seq }, doc)
      db.courses.push(c)
      return ok({ _id: c._id }, '课程已创建')
    }

    case 'course.remove': {
      if (!me || me.role !== 'admin') return fail(403, '无权操作')
      db.courses = db.courses.filter((c) => c._id !== payload.id)
      return ok({ keptRecords: db.records.filter((r) => r.courseId === payload.id).length }, '课程已删除')
    }

    case 'teacher.list':
      return ok(db.users.filter((u) => u.role === 'teacher').map(publicUser))

    case 'user.list': {
      let list = db.users.filter((u) => (payload.role ? u.role === payload.role : true))
      if (payload.keyword) {
        const k = String(payload.keyword).toLowerCase()
        list = list.filter((u) => (u.name + u.account + (u.className || '')).toLowerCase().indexOf(k) >= 0)
      }
      return ok({ list: list.map(publicUser), total: list.length, page: 1, pageSize: 100 })
    }

    case 'user.create': {
      if (!me || me.role !== 'admin') return fail(403, '无权操作')
      const u = {
        _id: 'u' + ++seq,
        account: payload.account,
        password: payload.password || '123456',
        name: payload.name,
        role: payload.role || 'student',
        className: payload.className || '',
        title: payload.title || '',
        status: 1
      }
      db.users.push(u)
      return ok(publicUser(u), '账号已创建')
    }

    case 'sign.context': {
      if (!me) return fail(401, '请先登录')
      let course = payload.courseId ? db.courses.find((c) => c._id === payload.courseId) : null
      if (!course) {
        course =
          db.courses.filter((c) => c.status === 1 && c.weekday === p.weekday).sort((a, b) => parseHM(a.startTime) - parseHM(b.startTime))[0] ||
          db.courses.filter((c) => c.status === 1)[0]
      }
      if (!course) return ok({ course: null, window: { state: 'none' }, signed: false })
      const win = windowOf(course, p)
      const rec = db.records.find((r) => r.userId === me._id && r.courseId === course._id && r.sessionDate === p.dateKey)
      return ok({
        course,
        window: { ...win, daysUntil: 0 },
        signed: !!rec,
        record: rec
          ? { _id: rec._id, signTime: rec.signTime, signTimeText: `${pad(new Date(rec.signTime).getHours())}:${pad(new Date(rec.signTime).getMinutes())}`, distance: rec.distance, result: rec.result }
          : null,
        serverTime: `${p.dateKey} ${hm(p.minutes)}`
      })
    }

    case 'sign.submit': {
      if (!me) return fail(401, '请先登录')
      const course = db.courses.find((c) => c._id === payload.courseId)
      if (!course) return fail(412, '课程不存在')
      const win = windowOf(course, p)
      if (win.state !== 'open') return fail(413, win.state === 'before' ? `签到将在 ${win.openAt} 开启` : `本节签到已于 ${win.closeAt} 结束`, { state: win.state })
      const distance = haversine(Number(payload.latitude), Number(payload.longitude), course.latitude, course.longitude)
      if (distance > course.radius) {
        return fail(410, `当前位置距离签到点位 ${Math.round(distance)} 米，超出允许范围 ${course.radius} 米`, { status: 'OUT_OF_RANGE', distance, radius: course.radius })
      }
      const dup = db.records.find((r) => r.userId === me._id && r.courseId === course._id && r.sessionDate === p.dateKey)
      if (dup) return fail(411, '本节课已签到，不可重复签到', { status: 'ALREADY_SIGNED' })

      const rec = {
        _id: 'r' + ++seq,
        userId: me._id,
        userName: me.name,
        account: me.account,
        className: me.className,
        courseId: course._id,
        courseName: course.name,
        teacherName: course.teacherName,
        sessionDate: p.dateKey,
        signTime: new Date(),
        result: 'success',
        distance,
        latitude: Number(payload.latitude),
        longitude: Number(payload.longitude)
      }
      db.records.unshift(rec)
      return ok({ status: 'SUCCESS', courseName: course.name, signTimeText: hm(p.minutes), distance, radius: course.radius }, '签到成功')
    }

    case 'record.mine':
      return ok(db.records.filter((r) => r.userId === (me && me._id)))

    case 'record.list': {
      if (!me || (me.role !== 'admin' && me.role !== 'teacher')) return fail(403, '无权查看')
      let list = db.records
      if (me.role === 'teacher') {
        const ids = db.courses.filter((c) => c.teacherId === me._id).map((c) => c._id)
        list = list.filter((r) => ids.indexOf(r.courseId) >= 0)
      }
      if (payload.courseId) list = list.filter((r) => r.courseId === payload.courseId)
      if (payload.keyword) {
        const k = String(payload.keyword).toLowerCase()
        list = list.filter((r) => (r.userName + r.account + r.courseName).toLowerCase().indexOf(k) >= 0)
      }
      const mapped = list.map((r) => {
        const d = new Date(r.signTime)
        return {
          ...r,
          signTimeText: `${dateKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
        }
      })
      return ok({
        list: mapped,
        total: mapped.length,
        page: 1,
        pageSize: 100,
        stats: {
          total: mapped.length,
          today: mapped.filter((r) => r.sessionDate === p.dateKey).length,
          students: new Set(mapped.map((r) => r.userId)).size
        }
      })
    }

    case 'record.remove': {
      if (!me || me.role !== 'admin') return fail(403, '无权操作')
      db.records = db.records.filter((r) => r._id !== payload.id)
      return ok({ _id: payload.id }, '记录已删除')
    }

    case 'record.export':
      return fail(500, '离线演示模式不支持导出 Excel，请先部署云函数')

    case 'stats.overview': {
      if (!me) return fail(401, '请先登录')
      let courses = db.courses
      if (me.role === 'teacher') courses = courses.filter((c) => c.teacherId === me._id)
      return ok({
        role: me.role,
        courseCount: courses.length,
        teacherCount: db.users.filter((u) => u.role === 'teacher').length,
        studentCount: db.users.filter((u) => u.role === 'student').length,
        todaySignCount: db.records.filter((r) => r.sessionDate === p.dateKey).length,
        recent: db.records.slice(0, 8).map((r) => {
          const d = new Date(r.signTime)
          return { ...r, signTimeText: `${dateKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` }
        }),
        todayCourses: courses.filter((c) => c.weekday === p.weekday)
      })
    }

    default:
      return fail(400, `离线演示模式未实现的接口：${action}`)
  }
}

export default {
  call(action, payload) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(handle(action, payload || {})), 120)
    })
  }
}
