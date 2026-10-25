/**
 * 时间工具（云函数运行环境时区不保证是东八区，这里显式换算）
 *
 * 课程采用「周课表」模型：courses 里存 weekday(1-7) + startTime/endTime("HH:mm")，
 * 不额外建「课次表」，这样三张表的约束不会被打破。
 * 每次上课对应一个 sessionDate（YYYY-MM-DD），签到去重键是
 * (userId, courseId, sessionDate) —— 保证「一人一课一节一次」。
 */

const BJ_OFFSET = 8 * 60 * 60 * 1000

// 签到时间窗：开课前 10 分钟 ~ 下课后 10 分钟
const OPEN_BEFORE_MIN = 10
const CLOSE_AFTER_MIN = 10

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

/** 把任意时间换算成北京时间的各字段 */
function bjParts(date) {
  const t = new Date((date ? date.getTime() : Date.now()) + BJ_OFFSET)
  const y = t.getUTCFullYear()
  const m = t.getUTCMonth() + 1
  const d = t.getUTCDate()
  const weekday = t.getUTCDay() === 0 ? 7 : t.getUTCDay()
  return {
    y,
    m,
    d,
    weekday,
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
    dateKey: `${y}-${pad(m)}-${pad(d)}`
  }
}

/** "08:00" -> 480 */
function parseHM(str) {
  if (typeof str !== 'string') return NaN
  const m = str.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

/** 480 -> "08:00" */
function toHM(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/**
 * 计算某门课「此刻」的签到窗口状态
 * @returns {{state:'open'|'before'|'after'|'otherday', openAt:string, closeAt:string,
 *            minutesToStart:number, minutesToClose:number, durationMin:number}}
 */
function windowOf(course, parts) {
  const startMin = parseHM(course.startTime)
  const endMin = parseHM(course.endTime)
  const durationMin = Math.max(endMin - startMin, 0)
  const openMin = startMin - OPEN_BEFORE_MIN
  const closeMin = endMin + CLOSE_AFTER_MIN
  const base = {
    openAt: toHM(openMin),
    closeAt: toHM(closeMin),
    durationMin,
    minutesToStart: startMin - parts.minutes,
    minutesToClose: closeMin - parts.minutes
  }

  // 不是今天 → 窗口不成立
  if (Number(course.weekday) !== parts.weekday) {
    return { ...base, state: 'otherday' }
  }
  if (parts.minutes < openMin) return { ...base, state: 'before' }
  if (parts.minutes > closeMin) return { ...base, state: 'after' }
  return { ...base, state: 'open' }
}

/** 北京时间字符串 "2026-10-24 23:30" */
function formatBJ(date) {
  const p = bjParts(date instanceof Date ? date : new Date(date))
  return `${p.dateKey} ${pad(p.hour)}:${pad(p.minute)}`
}

/** 仅时间 "23:30" */
function formatTimeBJ(date) {
  const p = bjParts(date instanceof Date ? date : new Date(date))
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** 相对今天偏移 n 天的 dateKey */
function dateKeyOffset(days) {
  return bjParts(new Date(Date.now() + (days || 0) * 86400000)).dateKey
}

/** 相对现在的分钟数 → "HH:mm"（用于生成演示课程） */
function hmFromNow(deltaMinutes) {
  const p = bjParts()
  return toHM(p.minutes + (deltaMinutes || 0))
}

const WEEKDAY_TEXT = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

module.exports = {
  BJ_OFFSET,
  OPEN_BEFORE_MIN,
  CLOSE_AFTER_MIN,
  WEEKDAY_TEXT,
  pad,
  bjParts,
  parseHM,
  toHM,
  windowOf,
  formatBJ,
  formatTimeBJ,
  dateKeyOffset,
  hmFromNow
}
