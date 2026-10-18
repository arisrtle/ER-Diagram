/**
 * 页面内轻提示：顶部弹出的卵石形气泡，2 秒后收起。
 * 页面里放 <app-toast id="toast" />，再用 utils/ui.js 的 toast('已保存') 调用。
 */
Component({
  options: { addGlobalClass: true },
  data: { text: '', type: 'info', on: false, top: 100 },
  lifetimes: {
    attached() {
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ top: (win.statusBarHeight || 20) + 52 });
    },
    detached() {
      clearTimeout(this._t);
    }
  },
  methods: {
    show(text, type = 'info') {
      clearTimeout(this._t);
      this.setData({ text, type, on: true });
      this._t = setTimeout(() => this.setData({ on: false }), 2000);
    }
  }
});
