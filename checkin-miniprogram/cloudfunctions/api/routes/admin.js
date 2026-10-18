/**
 * 管理员：微信授权登录、申请、审核。
 *
 * 规则：
 * - 系统里还没有任何管理员时，第一个用微信授权登录的人自动成为管理员（初始化）。
 * - 之后的新人登录会得到 status=none，可提交申请（pending），由任一管理员通过或拒绝。
 */
const { ADMINS, findAdmin } = require('../lib/auth');
const { AppError, CODES } = require('../lib/errors');
const v = require('../lib/validate');

/** 返回给前端的管理员信息（openid 只露尾号，便于辨认又不完整暴露） */
function publicAdmin(doc) {
  return {
    id: doc._id,
    nickname: doc.nickname || '管理员',
    status: doc.status,
    tail: String(doc._id).slice(-6),
    createdAt: doc.createdAt,
    lastLoginAt: doc.lastLoginAt || null
  };
}

module.exports = {
  /** 微信授权登录：根据 OPENID 判断身份 */
  'admin.login': {
    async run(data, { db, openid, now }) {
      const nickname = v.str(data.nickname, '昵称', { required: false, max: 20 });
      const existing = await findAdmin(db, openid);

      if (existing) {
        if (existing.status === 'active') {
          const patch = { lastLoginAt: now() };
          if (nickname) patch.nickname = nickname;
          await db.collection(ADMINS).doc(openid).update({ data: patch });
          return { status: 'active', admin: publicAdmin({ ...existing, ...patch }) };
        }
        return { status: existing.status, admin: publicAdmin(existing) };
      }

      // 还没有任何启用的管理员：第一个登录的人成为管理员
      const { total } = await db.collection(ADMINS).where({ status: 'active' }).count();
      if (total === 0) {
        const doc = {
          _id: openid,
          nickname: nickname || '管理员',
          status: 'active',
          createdAt: now(),
          lastLoginAt: now()
        };
        await db.collection(ADMINS).add({ data: doc });
        return { status: 'active', admin: publicAdmin(doc), firstAdmin: true };
      }
      return { status: 'none' };
    }
  },

  /** 提交管理员申请 */
  'admin.apply': {
    async run(data, { db, openid, now }) {
      const nickname = v.str(data.nickname, '昵称', { max: 20 });
      const existing = await findAdmin(db, openid);
      if (existing) return { status: existing.status, admin: publicAdmin(existing) };
      const doc = { _id: openid, nickname, status: 'pending', createdAt: now() };
      await db.collection(ADMINS).add({ data: doc });
      return { status: 'pending', admin: publicAdmin(doc) };
    }
  },

  /** 管理员列表（含待审核） */
  'admin.list': {
    auth: 'admin',
    async run(data, { db, openid }) {
      const res = await db.collection(ADMINS).limit(100).get();
      const list = res.data.map((d) => ({ ...publicAdmin(d), me: d._id === openid }));
      list.sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1));
      return { list };
    }
  },

  /** 审核申请：approve=true 通过，false 拒绝（删除申请） */
  'admin.review': {
    auth: 'admin',
    async run(data, { db, now }) {
      const id = v.str(data.id, '申请人', { max: 64 });
      const target = await findAdmin(db, id);
      if (!target || target.status !== 'pending') {
        throw new AppError(CODES.NOT_FOUND, '这条申请已经处理过了');
      }
      if (data.approve) {
        await db.collection(ADMINS).doc(id).update({ data: { status: 'active', approvedAt: now() } });
        return { status: 'active' };
      }
      await db.collection(ADMINS).doc(id).remove();
      return { status: 'rejected' };
    }
  }
};
