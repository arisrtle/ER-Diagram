/**
 * 本地会话（token + 用户信息）
 *
 * token 是云函数签发的无状态令牌，客户端只负责保存与携带。
 */

const TOKEN_KEY = 'cs_token'
const USER_KEY = 'cs_user'

export function saveSession(token, user) {
  try {
    uni.setStorageSync(TOKEN_KEY, token || '')
    uni.setStorageSync(USER_KEY, user || null)
  } catch (e) {
    console.warn('保存登录态失败', e)
  }
}

export function getToken() {
  try {
    return uni.getStorageSync(TOKEN_KEY) || ''
  } catch (e) {
    return ''
  }
}

export function getUser() {
  try {
    return uni.getStorageSync(USER_KEY) || null
  } catch (e) {
    return null
  }
}

export function clearSession() {
  try {
    uni.removeStorageSync(TOKEN_KEY)
    uni.removeStorageSync(USER_KEY)
  } catch (e) {
    console.warn('清除登录态失败', e)
  }
}

export function isLoggedIn() {
  return !!getToken() && !!getUser()
}

/** 未登录时跳登录页（保留当前页面栈，避免死循环） */
export function requireLogin() {
  if (isLoggedIn()) return true
  uni.reLaunch({ url: '/pages/login/login' })
  return false
}
