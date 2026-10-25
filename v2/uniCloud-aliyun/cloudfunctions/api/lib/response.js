/**
 * 统一返回体与业务错误码
 *
 * 约定：云函数永远返回 { code, msg, data }，不抛异常给前端。
 * code === 0 表示成功；其余为业务失败，前端据 code 做分支处理。
 */

const CODE = {
  OK: 0,
  PARAM: 400, // 参数不合法
  UNAUTH: 401, // 未登录 / token 失效
  FORBIDDEN: 403, // 角色无权限
  NOT_FOUND: 404, // 数据不存在
  DUPLICATE: 409, // 唯一键冲突
  OUT_OF_RANGE: 410, // 超出距离阈值
  ALREADY_SIGNED: 411, // 本节课已签到
  NO_COURSE: 412, // 无可用课程
  NOT_IN_WINDOW: 413, // 不在签到时间窗内
  SYS: 500
}

const CODE_MSG = {
  0: '成功',
  400: '参数不合法',
  401: '登录状态已失效，请重新登录',
  403: '当前账号无权执行该操作',
  404: '数据不存在',
  409: '数据已存在',
  410: '不在允许的签到范围内',
  411: '本节课已签到',
  412: '暂无可签到的课程',
  413: '不在签到时间内',
  500: '服务异常，请稍后重试'
}

function ok(data, msg) {
  return { code: CODE.OK, msg: msg || '成功', data: data === undefined ? null : data }
}

function fail(code, msg, data) {
  return {
    code,
    msg: msg || CODE_MSG[code] || '操作失败',
    data: data === undefined ? null : data
  }
}

class BizError extends Error {
  constructor(code, msg, data) {
    super(msg || CODE_MSG[code] || '业务异常')
    this.name = 'BizError'
    this.code = code
    this.data = data === undefined ? null : data
  }
}

function assert(condition, code, msg, data) {
  if (!condition) throw new BizError(code, msg, data)
}

/**
 * 云函数入口包装器：统一异常捕获 + 耗时日志
 * @param {(event:object, context:object)=>Promise<any>} fn
 */
function withHandler(fn) {
  return async function main(event, context) {
    const started = Date.now()
    const action = (event && event.action) || '(none)'
    try {
      const result = await fn(event || {}, context || {})
      const body =
        result && typeof result === 'object' && typeof result.code === 'number' ? result : ok(result)
      console.log(`[OK] ${action} ${Date.now() - started}ms`)
      return body
    } catch (err) {
      if (err instanceof BizError) {
        console.warn(`[BIZ] ${action} code=${err.code} msg=${err.message}`)
        return fail(err.code, err.message, err.data)
      }
      console.error(`[ERR] ${action}`, err)
      return fail(CODE.SYS, '服务异常，请稍后重试')
    }
  }
}

module.exports = { CODE, CODE_MSG, ok, fail, BizError, assert, withHandler }
