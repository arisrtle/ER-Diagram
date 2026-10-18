/**
 * 入参校验小工具。校验失败一律抛 BAD_REQUEST，message 说清是哪个字段、该怎么填。
 */
const { AppError, CODES } = require('./errors');

const bad = (msg) => new AppError(CODES.BAD_REQUEST, msg);

/** 去首尾空白的字符串；required 时不能为空；限制最大长度 */
function str(value, field, { required = true, max = 64 } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value === 'number') value = String(value);
  if (typeof value !== 'string') throw bad(`${field}格式不对`);
  const v = value.trim();
  if (required && !v) throw bad(`请填写${field}`);
  if (v.length > max) throw bad(`${field}最多 ${max} 个字`);
  return v;
}

/** 学号：字母、数字、短横线，3–32 位 */
function studentNo(value) {
  const v = str(value, '学号', { max: 32 });
  if (!/^[A-Za-z0-9-]{3,32}$/.test(v)) throw bad('学号只能包含字母、数字和短横线，长度 3–32 位');
  return v;
}

/** 有限数字，可选范围 */
function num(value, field, { min = -Infinity, max = Infinity } = {}) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw bad(`${field}必须是数字`);
  if (n < min || n > max) throw bad(`${field}应在 ${min}–${max} 之间`);
  return n;
}

/** 文档 _id：只允许常见安全字符，防止奇怪的查询注入 */
function id(value, field = 'id') {
  const v = str(value, field, { max: 128 });
  if (!/^[A-Za-z0-9_-]+$/.test(v)) throw bad(`${field}格式不对`);
  return v;
}

/**
 * 设备 ID：小程序首次启动时生成并持久化在本机的随机串（见 miniprogram/utils/device.js）。
 * 只接受 16–64 位的字母数字与短横线。
 */
function deviceId(value) {
  const v = str(value, '设备 ID', { max: 64 });
  if (!/^[A-Za-z0-9-]{16,64}$/.test(v)) throw bad('设备 ID 无效，请重新打开小程序');
  return v;
}

module.exports = { str, studentNo, num, id, deviceId, bad };
