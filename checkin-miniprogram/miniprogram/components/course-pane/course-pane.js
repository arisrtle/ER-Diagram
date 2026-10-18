/**
 * 管理端「课程」面板：课程列表（含签到点位范围、已签到人数），新增 / 编辑跳转到 course-edit 页。
 */
const api = require('../../utils/api');

Component({
  options: { addGlobalClass: true },
  data: { list: [], loading: true, error: '', refreshing: false },
  lifetimes: {
    attached() {
      this.load();
    }
  },
  methods: {
    async load() {
      try {
        const { list } = await api.call('course.list');
        this.setData({ list, loading: false, error: '' });
        this.triggerEvent('count', { key: 'courses', text: `${list.length} 门` });
      } catch (e) {
        this.setData({ loading: false, error: e.message });
      }
    },
    open(e) {
      wx.navigateTo({ url: `/pages/admin/course-edit/course-edit?id=${e.currentTarget.dataset.id}` });
    },
    add() {
      wx.navigateTo({ url: '/pages/admin/course-edit/course-edit' });
    },
    onRefresh() {
      this.setData({ refreshing: true });
      this.load().finally(() => this.setData({ refreshing: false }));
    }
  }
});
