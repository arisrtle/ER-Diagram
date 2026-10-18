/**
 * 地理计算。
 *
 * 小程序端 wx.getLocation / wx.chooseLocation 统一使用 gcj02 坐标系，
 * 课程点位与学生位置在同一坐标系下，直接用球面距离即可。
 * 50 米量级上 Haversine 与椭球公式的误差远小于手机定位误差，足够用。
 */

const EARTH_RADIUS_M = 6371008.8; // 地球平均半径（米）

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * 两点间球面距离（米），Haversine 公式。
 * @returns {number} 四舍五入到 0.1 米
 */
function distanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const d = 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.round(d * 10) / 10;
}

/** 经纬度是否合法 */
function isValidCoord(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

module.exports = { distanceMeters, isValidCoord, EARTH_RADIUS_M };
