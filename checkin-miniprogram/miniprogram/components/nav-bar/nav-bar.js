/**
 * 自定义导航栏：避开状态栏和右上角胶囊按钮，左侧是卵石形的返回按钮。
 * 用法：<nav-bar title="编辑课程" back /> ；也可以通过默认插槽放自定义内容。
 */
Component({
  options: { addGlobalClass: true, multipleSlots: true },
  properties: {
    title: { type: String, value: '' },
    back: { type: Boolean, value: false }
  },
  data: { statusBar: 20, navH: 44, rightGap: 96 },
  lifetimes: {
    attached() {
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const statusBar = win.statusBarHeight || 20;
      let navH = 44;
      let rightGap = 96;
      try {
        const m = wx.getMenuButtonBoundingClientRect();
        if (m && m.height) {
          navH = (m.top - statusBar) * 2 + m.height;
          rightGap = win.windowWidth - m.left + 8;
        }
      } catch (e) {
        /* 取不到胶囊位置时用默认值 */
      }
      this.setData({ statusBar, navH, rightGap });
    }
  },
  methods: {
    onBack() {
      this.triggerEvent('back');
      if (getCurrentPages().length > 1) wx.navigateBack();
      else wx.reLaunch({ url: '/pages/index/index' });
    }
  }
});
