/**
 * 首页：选择身份。学生和管理员共用一套小程序，在这里分流。
 * 本机登录过的学生点「我是学生」直接进入签到页。
 */
const { getStudent } = require('../../utils/session');

Page({
  data: {
    statusBar: 20
  },

  onLoad() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBar: win.statusBarHeight || 20 });
  },

  toStudent() {
    const s = getStudent();
    wx.navigateTo({ url: s ? '/pages/student/checkin/checkin' : '/pages/student/login/login' });
  },

  toAdmin() {
    wx.navigateTo({ url: '/pages/admin/login/login' });
  }
});
