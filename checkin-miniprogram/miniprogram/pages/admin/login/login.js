/**
 * 管理员登录：微信授权登录。
 *
 * 不需要账号密码——云函数从调用上下文拿到当前微信的 OPENID 判断身份：
 *   active  已是管理员 → 进入后台
 *   none    还不是管理员 → 填称呼提交申请
 *   pending 已申请 → 等待已有管理员通过
 * 系统里还没有任何管理员时，第一个登录的微信自动成为管理员。
 */
const api = require('../../../utils/api');
const { toast } = require('../../../utils/ui');

Page({
  data: {
    view: 'login', // login | apply | pending
    loading: false,
    nickname: '',
    applyName: ''
  },

  async login() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await api.call('admin.login', {});
      this.route(res);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      this.setData({ loading: false });
    }
  },

  route(res) {
    if (res.status === 'active') {
      wx.reLaunch({ url: `/pages/admin/home/home${res.firstAdmin ? '?first=1' : ''}` });
    } else if (res.status === 'pending') {
      this.setData({ view: 'pending', nickname: (res.admin && res.admin.nickname) || '' });
    } else {
      this.setData({ view: 'apply' });
    }
  },

  onName(e) {
    this.setData({ applyName: e.detail.value });
  },

  async apply() {
    const nickname = this.data.applyName.trim();
    if (!nickname) {
      toast('请填写称呼');
      return;
    }
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await api.call('admin.apply', { nickname });
      this.route(res);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      this.setData({ loading: false });
    }
  },

  async refresh() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await api.call('admin.login', {});
      if (res.status === 'pending') toast('还在等待审核');
      this.route(res);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      this.setData({ loading: false });
    }
  }
});
