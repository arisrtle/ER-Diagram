/**
 * 路由表与分发逻辑，与云开发 SDK 解耦，便于单元测试直接注入内存数据库。
 */
const { AppError, CODES } = require('./lib/errors');
const { requireAdmin } = require('./lib/auth');

const routes = {
  ...require('./routes/admin'),
  ...require('./routes/course').routes,
  ...require('./routes/student').routes,
  ...require('./routes/checkin').routes,
  ...require('./routes/record').routes
};

/**
 * @param {object} event   { action, data }
 * @param {object} ctx     { db, cloud, openid, now }
 * @returns {Promise<{ok:true,data:any}|{ok:false,code:string,message:string,extra?:any}>}
 */
async function dispatch(event, ctx) {
  const action = event && event.action;
  const route = routes[action];
  if (!route) {
    return { ok: false, code: CODES.UNKNOWN_ACTION, message: `未知操作：${action}` };
  }
  try {
    if (route.auth === 'admin') ctx.admin = await requireAdmin(ctx.db, ctx.openid);
    const data = await route.run((event && event.data) || {}, ctx);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof AppError) {
      return { ok: false, code: e.code, message: e.message, extra: e.extra };
    }
    console.error(`[${action}]`, e);
    return { ok: false, code: CODES.INTERNAL, message: '服务暂时出了点问题，请稍后再试' };
  }
}

module.exports = { dispatch, routes };
