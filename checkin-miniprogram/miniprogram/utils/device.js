/**
 * 设备 ID。
 *
 * 小程序拿不到硬件序列号，这里在本机第一次打开时生成一个随机 UUID，
 * 用 wx.setStorageSync 持久保存，之后一直使用同一个值来标识这台手机。
 * 云函数把它和课程 ID 拼成签到记录的主键，保证「同一课程同一设备只能签 1 次」。
 *
 * 局限：用户清除小程序缓存或删除小程序后会生成新的 ID。
 * 为此云函数还会比对调用者的微信 OPENID（同一部手机上的同一个微信号），见 cloudfunctions/api/routes/checkin.js。
 */
const KEY = 'checkin.deviceId';

function uuid() {
  const hex = [];
  for (let i = 0; i < 32; i++) hex.push(Math.floor(Math.random() * 16).toString(16));
  // 混入时间戳，进一步降低碰撞概率
  const t = Date.now().toString(16).padStart(12, '0').slice(-12);
  for (let i = 0; i < 12; i++) hex[i] = t[i];
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function getDeviceId() {
  let id = '';
  try {
    id = wx.getStorageSync(KEY);
  } catch (e) {
    id = '';
  }
  if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
    id = uuid();
    try {
      wx.setStorageSync(KEY, id);
    } catch (e) {
      console.warn('保存设备 ID 失败', e);
    }
  }
  return id;
}

module.exports = { getDeviceId };
