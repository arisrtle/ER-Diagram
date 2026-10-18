/**
 * 云函数入口：api
 *
 * 小程序统一调用：
 *   wx.cloud.callFunction({ name: 'api', data: { action: 'checkin.submit', data: {...} } })
 *
 * 返回统一结构：
 *   成功 { ok: true,  data }
 *   失败 { ok: false, code, message, extra }
 *
 * 所有 action 的实现见 routes/ 目录，路由表见 router.js。
 */
const cloud = require('wx-server-sdk');
const { dispatch } = require('./router');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  return dispatch(event, {
    db,
    cloud,
    openid: OPENID,
    now: () => new Date()
  });
};
