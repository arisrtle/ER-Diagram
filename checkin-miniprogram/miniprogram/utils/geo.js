/**
 * 前端的距离与方位计算，只用于实时显示；是否允许签到以云函数的计算为准。
 */
const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

/** 球面距离（米） */
function distance(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * 从点位指向「我」的屏幕角度（度）：0 = 正东（右），90 = 正南（下）。
 * 小范围内用平面近似即可。
 */
function screenAngle(fromLat, fromLng, toLat, toLng) {
  const dx = (toLng - fromLng) * Math.cos(rad(fromLat));
  const dy = -(toLat - fromLat);
  if (dx === 0 && dy === 0) return -90;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

module.exports = { distance, screenAngle };
