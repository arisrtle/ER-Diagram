import { haversine, formatClock } from './geo'

const MOCK_SESSION_KEY = 'mock_checked_in_session_1'
const MOCK_POINT_OFFSET = 0.0001

function todayString(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function mockLogin(studentNo, name) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!studentNo || !name) {
        reject(new Error('请输入学号和姓名'))
        return
      }
      resolve({
        access_token: `mock-token-${studentNo}`,
        user: { student_no: studentNo, name, role: 'student' }
      })
    }, 300)
  })
}

export function mockGetCurrentSession() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const now = new Date()
      const start = new Date(now.getTime() + 10 * 60 * 1000)
      const end = new Date(now.getTime() + 110 * 60 * 1000)
      resolve({
        session_id: 1,
        course_name: '自动控制原理',
        section_name: '1班',
        classroom: 'A101',
        class_date: todayString(now),
        start_time: formatClock(start),
        end_time: formatClock(end),
        checkin_status: 'open',
        distance_limit: 50,
        already_checked_in: !!uni.getStorageSync(MOCK_SESSION_KEY),
        latitude: 30.2741,
        longitude: 120.1551
      })
    }, 300)
  })
}

export function mockCheckin(sessionId, location) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (uni.getStorageSync(MOCK_SESSION_KEY)) {
        resolve({ success: false, code: 'already', message: '本节课已签到' })
        return
      }
      const point = {
        latitude: location.latitude - MOCK_POINT_OFFSET,
        longitude: location.longitude - MOCK_POINT_OFFSET
      }
      const distance = haversine(location, point)
      uni.setStorageSync(MOCK_SESSION_KEY, { checked_in_at: Date.now() })
      resolve({ success: true, distance, message: '签到成功' })
    }, 500)
  })
}

export function resetMockCheckin() {
  uni.removeStorageSync(MOCK_SESSION_KEY)
}
