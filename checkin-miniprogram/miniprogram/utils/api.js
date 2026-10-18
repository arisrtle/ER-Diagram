/**
 * 云函数调用封装。
 *
 * 所有业务都走同一个云函数 `api`，按 action 分发：
 *   call('checkin.submit', { ... })
 * 成功返回 data；失败抛出 Error，带 code / extra，message 可直接展示给用户。
 */
function call(action, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'api',
      data: { action, data },
      success(res) {
        const r = res.result;
        if (r && r.ok) return resolve(r.data);
        const err = new Error((r && r.message) || '请求失败，请稍后再试');
        err.code = (r && r.code) || 'UNKNOWN';
        err.extra = (r && r.extra) || null;
        reject(err);
      },
      fail(e) {
        console.error(`[api] ${action}`, e);
        const err = new Error('网络不太稳定，请检查网络后重试');
        err.code = 'NETWORK';
        reject(err);
      }
    });
  });
}

module.exports = { call };
