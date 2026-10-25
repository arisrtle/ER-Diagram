/**
 * 展示层格式化
 */
import { WEEKDAYS } from './config'

export function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

export function weekdayText(n) {
  return WEEKDAYS[Number(n)] || ''
}

/** 480 -> "08:00" */
export function minutesToHM(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`
}

/** "08:00" -> 480，非法返回 NaN */
export function parseHM(str) {
  const m = String(str || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return NaN
  return Number(m[1]) * 60 + Number(m[2])
}

/** 人类可读的时长：95 -> "1 小时 35 分钟" */
export function humanMinutes(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0))
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} 小时 ${r} 分钟` : `${h} 小时`
}

export function distanceText(meters) {
  const m = Number(meters)
  if (!isFinite(m)) return '—'
  return m >= 1000 ? `${(m / 1000).toFixed(2)} 公里` : `${Math.round(m)} 米`
}

/**
 * 把服务端返回的 window 翻译成页面上的两行文案
 * @param {object} win   云函数返回的窗口对象
 * @param {boolean} signed 本节课是否已签到
 * @param {object} record 已签到的记录
 */
export function windowText(win, signed, record) {
  if (signed) {
    return {
      main: '已完成签到',
      sub: record && record.signTimeText ? `签到时间 ${record.signTimeText}` : '本节课已签到'
    }
  }
  if (!win || win.state === 'none') {
    return { main: '暂无可签到的课程', sub: '请确认管理员已创建并启用课程' }
  }

  const m = Number(win.minutesToStart) || 0
  switch (win.state) {
    case 'open':
      if (m > 0) {
        return {
          main: `距离开课还有 ${humanMinutes(m)}`,
          sub: `签到已开启 · ${win.openAt}–${win.closeAt}`
        }
      }
      return { main: '正在上课', sub: `签到将于 ${win.closeAt} 截止` }
    case 'before':
      return {
        main: `距离开课还有 ${humanMinutes(m)}`,
        sub: `开课前 10 分钟开启签到（${win.openAt}）`
      }
    case 'after':
      return { main: '本节签到已结束', sub: `${win.closeAt} 已截止` }
    case 'otherday':
      return {
        main: Number(win.daysUntil) === 1 ? '明天有这门课' : `${win.daysUntil} 天后有这门课`,
        sub: '今天不上这门课'
      }
    default:
      return { main: '今天没有课', sub: '' }
  }
}

/** 签到按钮的文案与可用状态 */
export function buttonState(win, signed) {
  if (signed) return { text: '已签到', sub: '不可重复签到', enabled: false, tone: 'success' }
  if (!win || win.state === 'none' || win.state === 'otherday') {
    return { text: '未开课', sub: '暂无可签到课程', enabled: false, tone: 'muted' }
  }
  if (win.state === 'before') {
    return { text: '未开始', sub: `${win.openAt} 开启`, enabled: false, tone: 'muted' }
  }
  if (win.state === 'after') {
    return { text: '已结束', sub: `${win.closeAt} 截止`, enabled: false, tone: 'muted' }
  }
  return { text: '签到', sub: '点击完成签到', enabled: true, tone: 'primary' }
}

/** 设备标识（仅审计用，不参与签到判定） */
export function getDeviceId() {
  const KEY = 'cs_device_id'
  try {
    let id = uni.getStorageSync(KEY)
    if (!id) {
      id = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
      uni.setStorageSync(KEY, id)
    }
    return id
  } catch (e) {
    return 'dev-unknown'
  }
}
