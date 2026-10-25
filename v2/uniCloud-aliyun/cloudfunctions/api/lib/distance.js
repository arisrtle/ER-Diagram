/**
 * 距离计算（Haversine 球面模型）
 *
 * 地球半径取 IUGG 推荐平均值 6371008.8 米。
 * 球面与 WGS84 椭球在几百米尺度上的差异远小于手机 GPS 误差，够用。
 *
 * 重要：距离只由云端计算。客户端算出的「是否在范围内」可被篡改，
 * 客户端上报的只有经纬度。
 */

const EARTH_RADIUS = 6371008.8

function toRad(deg) {
  return (Number(deg) * Math.PI) / 180
}

/** 两点间距离（米），保留 1 位小数 */
function haversine(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2) - toRad(lat1)
  const dLng = toRad(lng2) - toRad(lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(EARTH_RADIUS * c * 10) / 10
}

/** 经纬度合法性：越界、(0,0)、NaN 一律拒绝 */
function isValidLatLng(lat, lng) {
  const a = Number(lat)
  const b = Number(lng)
  if (!isFinite(a) || !isFinite(b)) return false
  if (a < -90 || a > 90 || b < -180 || b > 180) return false
  if (Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6) return false
  return true
}

/** 距离的人类可读写法 */
function distanceText(meters) {
  const m = Number(meters)
  if (!isFinite(m)) return '—'
  return m >= 1000 ? `${(m / 1000).toFixed(2)} 公里` : `${Math.round(m)} 米`
}

module.exports = { EARTH_RADIUS, haversine, isValidLatLng, distanceText }
