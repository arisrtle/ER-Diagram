/** 日期时间格式化（按手机本地时区显示） */
const pad = (n) => String(n).padStart(2, '0');

function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v.$date) return new Date(v.$date);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 10:24 */
function hm(v) {
  const d = toDate(v);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}

/** 10:24:08 */
function hms(v) {
  const d = toDate(v);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : '';
}

/** 2026-10-13 */
function ymd(v) {
  const d = toDate(v);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
}

/** 10月13日 */
function md(v) {
  const d = toDate(v);
  return d ? `${d.getMonth() + 1}月${d.getDate()}日` : '';
}

/** 今天显示时间，其他日期显示「10月13日 10:24」 */
function smart(v) {
  const d = toDate(v);
  if (!d) return '';
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? hm(d) : `${md(d)} ${hm(d)}`;
}

module.exports = { toDate, hm, hms, ymd, md, smart, pad };
