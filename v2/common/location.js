/**
 * 定位封装
 *
 * 只负责拿到经纬度并原样上报，**不做任何范围判断**。
 * 是否在允许范围内由云函数计算（客户端算出来的结果不可信）。
 */

/**
 * 定位坐标系
 *
 * App 端用 gcj02（与高德/腾讯地图一致）。
 *
 * H5 端必须用 wgs84：浏览器只能拿到 wgs84，如果请求 gcj02，uni-app 会去调
 * 地图服务商的坐标转换接口；而没在 manifest 里配置地图 key 时，源码里直接
 * `reject(new Error('translate coordinate system faild, map provider not configured'))`。
 * 结果就是「浏览器明明定位成功了，页面却一直显示定位失败」。
 */
let LOCATION_TYPE = 'gcj02'
// #ifdef H5
LOCATION_TYPE = 'wgs84'
// #endif

/**
 * 获取当前位置
 * @returns {Promise<{latitude:number, longitude:number, accuracy:number}>}
 */
export function getLocation() {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: LOCATION_TYPE,
      isHighAccuracy: true,
      // H5 端这个值会直接作为 navigator.geolocation 的 timeout（毫秒）。
      // 4 秒对首次定位太短，容易还没拿到结果就超时。
      highAccuracyExpireTime: 10000,
      success: (res) => {
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy || 0
        })
      },
      fail: (err) => reject(err)
    })
  })
}

/** 把定位错误翻译成用户能看懂、并且知道下一步该干什么的一句话 */
export function locationErrorText(err) {
  const msg = String((err && (err.errMsg || err.message)) || '')

  if (/map provider|translate coordinate/i.test(msg)) {
    return '当前环境不支持 gcj02 坐标转换，请改用「演示定位」'
  }
  if (/denied|permission|auth deny|authorize/i.test(msg)) {
    return '浏览器未授予定位权限，点地址栏左侧的锁图标允许定位后重试'
  }
  if (/timeout/i.test(msg)) {
    return '定位超时，可点「重试」，或直接用「演示定位」'
  }
  if (/nonsupport|not support/i.test(msg)) {
    return '当前浏览器不支持定位，请使用「演示定位」'
  }
  if (!msg || msg === '{}' || /position unavailable/i.test(msg)) {
    return '拿不到当前位置（系统定位服务可能未开启），可用「演示定位」继续'
  }
  return '定位失败，可用「演示定位」继续流程'
}

/**
 * 距离计算（**仅用于页面展示**，不作为是否允许签到的依据）
 * 真正的判定在云函数里，客户端算出来的结果可以被篡改。
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371008.8
  const rad = (x) => (Number(x) * Math.PI) / 180
  const dLat = rad(lat2) - rad(lat1)
  const dLng = rad(lng2) - rad(lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

/**
 * 演示定位：定位不可用（如桌面浏览器、无 HTTPS）时，用课程点位附近的坐标兜底，
 * 让流程能完整走通。页面上会明确标注「演示定位」，不会伪装成真实定位。
 */
export function demoLocation(course) {
  const lat = Number(course && course.latitude) || 34.24695
  const lng = Number(course && course.longitude) || 108.98362
  return {
    latitude: lat + 0.00012,
    longitude: lng + 0.0001,
    accuracy: 15,
    demo: true
  }
}
