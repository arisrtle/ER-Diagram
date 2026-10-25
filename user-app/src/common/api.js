import { getToken } from './auth'
import { mockLogin, mockGetCurrentSession, mockCheckin } from './mock'

// 已接入 FastAPI 后端；如果想回到纯前端演示，把 USE_MOCK 改回 true。
export const USE_MOCK = false
// mock 模式下如果浏览器拒绝定位，用模拟位置继续演示；接后端后必须为 false。
export const MOCK_FALLBACK_LOCATION = false
// H5 走同源 /api，由 Vite 代理到 FastAPI；小程序构建时用 VITE_API_BASE 指定完整地址。
const BASE_URL = import.meta.env.VITE_API_BASE || ''

export function login(studentNo, name) {
  if (USE_MOCK) {
    return mockLogin(studentNo, name)
  }
  return request('/api/auth/student-login', 'POST', {
    student_no: studentNo,
    name
  })
}

export function getCurrentSession() {
  if (USE_MOCK) {
    return mockGetCurrentSession()
  }
  return request('/api/student/current-session', 'GET')
}

export function checkin(sessionId, location) {
  if (USE_MOCK) {
    return mockCheckin(sessionId, location)
  }
  return request('/api/student/checkin', 'POST', {
    session_id: sessionId,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy
  })
}

function request(path, method, data) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    uni.request({
      url: `${BASE_URL}${path}`,
      method,
      data,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        const body = res.data || {}
        const detail = body.detail
        const message =
          body.message ||
          (detail && detail.message) ||
          (typeof detail === 'string' ? detail : '请求失败')
        const error = new Error(message)
        error.statusCode = res.statusCode
        error.data = body
        reject(error)
      },
      fail: () => reject(new Error('网络异常，请稍后重试'))
    })
  })
}
