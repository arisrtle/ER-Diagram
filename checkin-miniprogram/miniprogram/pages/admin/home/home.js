/**
 * 管理端主页：课程 / 学生 / 记录 三个面板，底部卵石形切换栏切换（不跳页，切换即时）。
 * 右上角头像打开「管理员」抽屉，处理管理员申请。
 */
const api = require('../../../utils/api');
const { toast } = require('../../../utils/ui');

const TITLES = { courses: '课程', students: '学生', records: '签到记录' };

Page({
  data: {
    tab: 'courses',
    title: TITLES.courses,
    counts: { courses: '', students: '', records: '' },
    visited: { courses: true, students: false, records: false },
    me: null,
    admins: [],
    pending: 0,
    adminSheet: false,
    reviewing: ''
  },

  onLoad(query) {
    if (query && query.first) setTimeout(() => toast('你是第一位管理员，之后的人登录需要你审核', 'success'), 400);
    this.loadAdmins();
  },

  onShow() {
    const app = getApp();
    if (app.globalData.dirty.courses) {
      app.globalData.dirty.courses = false;
      const pane = this.selectComponent('#courses');
      if (pane) pane.load();
      const rec = this.selectComponent('#records');
      if (rec) rec.loadCourses();
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    this.setData({ tab, title: TITLES[tab], [`visited.${tab}`]: true });
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail() {} });
  },

  onCount(e) {
    const { key, text } = e.detail;
    this.setData({ [`counts.${key}`]: text });
  },

  // ------------------------------------------------------------ 管理员
  async loadAdmins() {
    try {
      const { list } = await api.call('admin.list');
      const admins = list.map((a) => ({ ...a, initial: String(a.nickname || '管').slice(0, 1) }));
      this.setData({
        admins,
        me: admins.find((a) => a.me) || null,
        pending: admins.filter((a) => a.status === 'pending').length
      });
    } catch (e) {
      if (e.code === 'NOT_ADMIN' || e.code === 'ADMIN_PENDING') {
        wx.reLaunch({ url: '/pages/admin/login/login' });
      }
    }
  },

  openAdmins() {
    this.setData({ adminSheet: true });
    this.loadAdmins();
  },
  closeAdmins() {
    this.setData({ adminSheet: false });
  },

  async review(e) {
    const { id, approve } = e.currentTarget.dataset;
    if (this.data.reviewing) return;
    this.setData({ reviewing: id });
    try {
      const res = await api.call('admin.review', { id, approve: approve === '1' });
      const who = (this.data.admins.find((a) => a.id === id) || {}).nickname || '对方';
      toast(res.status === 'active' ? `已通过，${who} 现在是管理员` : '已拒绝申请', 'success');
      await this.loadAdmins();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      this.setData({ reviewing: '' });
    }
  }
});
