/**
 * 业务错误。
 *
 * 云函数里所有「可预期的失败」（参数不对、不在范围内、重复签到……）都抛 AppError，
 * 入口会把它转成 { ok: false, code, message, extra } 返回给小程序，
 * 小程序据 code 决定界面怎么呈现，message 可以直接展示给用户。
 */
class AppError extends Error {
  /**
   * @param {string} code    机器可读的错误码，例如 OUT_OF_RANGE
   * @param {string} message 给用户看的中文说明：说清发生了什么、怎么办
   * @param {object} [extra] 附带数据，例如距离、阈值
   */
  constructor(code, message, extra) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.extra = extra || null;
  }
}

/** 错误码一览，前后端共用同一套含义 */
const CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNKNOWN_ACTION: 'UNKNOWN_ACTION',
  NOT_ADMIN: 'NOT_ADMIN',
  ADMIN_PENDING: 'ADMIN_PENDING',
  NOT_FOUND: 'NOT_FOUND',
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  COURSE_NOT_FOUND: 'COURSE_NOT_FOUND',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  DEVICE_USED: 'DEVICE_USED',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  CONFLICT: 'CONFLICT',
  IMPORT_INVALID: 'IMPORT_INVALID',
  INTERNAL: 'INTERNAL'
};

module.exports = { AppError, CODES };
