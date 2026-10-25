/**
 * 密码哈希与登录令牌
 *
 * 只有三张表，不能为了存会话再加一张 sessions 表，因此登录态采用**无状态签名令牌**：
 *   token = base64url(payload) + "." + HMAC-SHA256(payload, SECRET)
 * 服务端不存 token，靠验签 + 过期时间判定。这样「三张表」的约束没有被打破。
 *
 * 密码用 PBKDF2-SHA256（10 万次迭代 + 每用户随机盐），不存明文。
 */
const crypto = require('crypto')

// 生产环境请通过云函数环境变量 TOKEN_SECRET 覆盖
const SECRET = process.env.TOKEN_SECRET || 'course-signin-xjtu-2026-please-change-me'
const TOKEN_TTL_HOURS = 12

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

/** 生成密码哈希，返回 "salt:hash" */
function hashPassword(password) {
  const salt = crypto.randomBytes(8).toString('hex')
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256').toString('hex')
  return `${salt}:${hash}`
}

/** 校验密码，使用定长比较避免时序攻击 */
function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || stored.indexOf(':') < 0) return false
  const [salt, hash] = stored.split(':')
  const calc = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256').toString('hex')
  const a = Buffer.from(calc, 'hex')
  const b = Buffer.from(hash, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** 签发令牌 */
function signToken(payload, ttlHours) {
  const body = {
    ...payload,
    exp: Date.now() + (ttlHours || TOKEN_TTL_HOURS) * 3600 * 1000
  }
  const encoded = base64url(JSON.stringify(body))
  const sig = base64url(crypto.createHmac('sha256', SECRET).update(encoded).digest())
  return `${encoded}.${sig}`
}

/** 验签并返回 payload，失败返回 null */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [encoded, sig] = parts
  const expect = base64url(crypto.createHmac('sha256', SECRET).update(encoded).digest())
  if (sig.length !== expect.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null
  try {
    const payload = JSON.parse(fromBase64url(encoded).toString('utf8'))
    if (!payload || !payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch (e) {
    return null
  }
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken }
