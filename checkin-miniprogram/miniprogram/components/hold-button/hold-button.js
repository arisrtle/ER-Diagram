/**
 * 按住签到。外圈随按住时间走满（默认 0.9 秒），走满才触发 confirm；中途松手什么都不发生。
 * 这样可以避免误触，也让「只能提交一次」这件事在操作上有分量。
 *
 * mode: ready 可按 | off 不可按 | busy 提交中
 */
Component({
  options: { addGlobalClass: true },
  properties: {
    mode: { type: String, value: 'off' },
    label: { type: String, value: '按住签到' },
    sub: { type: String, value: '' },
    duration: { type: Number, value: 900 }
  },
  data: { holding: false },
  lifetimes: {
    detached() {
      clearTimeout(this._t);
    }
  },
  observers: {
    mode(m) {
      if (m !== 'ready') this.cancel();
    }
  },
  methods: {
    start() {
      if (this.data.mode !== 'ready') {
        this.triggerEvent('blocked');
        return;
      }
      clearTimeout(this._t);
      this.setData({ holding: true });
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail() {} });
      this._t = setTimeout(() => {
        this.setData({ holding: false });
        if (wx.vibrateShort) wx.vibrateShort({ type: 'heavy', fail() {} });
        this.triggerEvent('confirm');
      }, this.data.duration);
    },
    cancel() {
      clearTimeout(this._t);
      if (this.data.holding) this.setData({ holding: false });
    }
  }
});
