/**
 * 云函数调用封装
 *
 * 统一约定：云函数返回 { code, msg, data }
 *   code === 0  → resolve(data)
 *   code !== 0  → reject(Error{code, data, message})
 *
 * 云端不可用（未关联服务空间 / 云函数未部署）时自动降级为离线演示模式，
 * 页面上会显示「离线演示」标识，避免打开就是一片报错。
 */
import { CLOUD, MOCK_ENABLED } from './config'
import { getToken, clearSession } from './session'
import mock from './mock'

let mockMode = false
let mockReason = ''

export function isMockMode() {
  return mockMode
}

export function getMockReason() {
  return mockReason
}

function isCloudUnavailable(err) {
  const msg = String((err && (err.errMsg || err.message)) || '')
  return /uniCloud|spaceId|未关联|关联服务空间|FunctionName|FUNCTION_NOT_FOUND|function not found|not found|callFunction:fail|云函数/i.test(
    msg
  )
}

function normalizeError(body) {
  const err = new Error(body.msg || '操作失败')
  err.code = body.code
  err.data = body.data
  return err
}

/**
 * @param {string} action 业务动作，如 'auth.login'
 * @param {object} [payload] 业务参数
 */
export function call(action, payload = {}) {
  const data = Object.assign({ action, token: getToken() }, payload)

  if (mockMode) {
    return mock.call(action, data).then((body) => {
      if (body.code !== 0) throw normalizeError(body)
      return body.data
    })
  }

  // 极端情况：运行时没有 uniCloud 全局（例如用了非 HBuilderX 的构建方式）
  if (typeof uniCloud === 'undefined' || !uniCloud || !uniCloud.callFunction) {
    if (!MOCK_ENABLED) {
      return Promise.reject(new Error('当前运行环境不支持 uniCloud，请用 HBuilderX 运行本项目'))
    }
    mockMode = true
    mockReason = 'uniCloud 不可用'
    console.warn('[离线演示模式]', mockReason)
    return call(action, payload)
  }

  return new Promise((resolve, reject) => {
    uniCloud.callFunction({
      name: CLOUD.fn,
      data,
      success: (res) => {
        const body = (res && res.result) || {}
        if (typeof body.code !== 'number') {
          reject(new Error('云函数返回格式异常，请确认已上传部署 api 云函数'))
          return
        }
        if (body.code === 401) {
          clearSession()
        }
        if (body.code !== 0) {
          reject(normalizeError(body))
          return
        }
        resolve(body.data)
      },
      fail: (err) => {
        if (MOCK_ENABLED && isCloudUnavailable(err)) {
          mockMode = true
          mockReason = (err && err.errMsg) || '云端未就绪'
          console.warn('[离线演示模式]', mockReason)
          call(action, payload).then(resolve, reject)
          return
        }
        const msg = (err && err.errMsg) || '网络异常'
        reject(new Error(/timeout/i.test(msg) ? '请求超时，请检查网络' : msg))
      }
    })
  })
}

/** 常用动作的语义化封装，避免页面里到处写字符串 */
export const api = {
  init: () => call('init'),

  login: (account, password) => call('auth.login', { account, password }),
  register: (payload) => call('auth.register', payload),
  me: () => call('auth.me'),

  courseList: (scope) => call('course.list', { scope }),
  courseSave: (payload) => call('course.save', payload),
  courseRemove: (id) => call('course.remove', { id }),
  teacherList: () => call('teacher.list'),

  userList: (params) => call('user.list', params || {}),
  userCreate: (payload) => call('user.create', payload),

  signContext: (courseId) => call('sign.context', courseId ? { courseId } : {}),
  signSubmit: (payload) => call('sign.submit', payload),

  recordMine: () => call('record.mine'),
  recordList: (params) => call('record.list', params || {}),
  recordRemove: (id) => call('record.remove', { id }),
  recordExport: (params) => call('record.export', params || {}),

  overview: () => call('stats.overview')
}
