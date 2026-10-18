const config = require('./config');

App({
  globalData: {
    /** 管理端返回列表时是否需要刷新（课程编辑页保存后置为 true） */
    dirty: { courses: false }
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: config.envId || wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: false
    });
  }
});
