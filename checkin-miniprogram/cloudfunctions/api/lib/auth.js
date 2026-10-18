/**
 * 管理员身份校验。
 *
 * 管理员通过「微信授权登录」进入后台：小程序调用云函数时，云开发会自动在
 * 上下文里带上调用者的 OPENID，无需前端传任何凭证，也无法伪造。
 * admins 集合以 OPENID 作为文档 _id，status 为 active 才算管理员。
 */
const { AppError, CODES } = require('./errors');
const { getById } = require('./db-helpers');

const ADMINS = 'admins';

async function findAdmin(db, openid) {
  if (!openid) return null;
  return getById(db, ADMINS, openid);
}

/** 要求调用者是已启用的管理员，否则抛错；返回管理员文档 */
async function requireAdmin(db, openid) {
  const admin = await findAdmin(db, openid);
  if (!admin) throw new AppError(CODES.NOT_ADMIN, '你的微信还不是管理员，请先在首页选择「管理员」申请');
  if (admin.status !== 'active') throw new AppError(CODES.ADMIN_PENDING, '管理员申请还在等待审核');
  return admin;
}

module.exports = { ADMINS, findAdmin, requireAdmin };
