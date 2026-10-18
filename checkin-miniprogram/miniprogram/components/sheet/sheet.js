/**
 * 底部抽屉：从底部滑出，点遮罩关闭。
 * <app-sheet show="{{x}}" bind:close="onClose">内容</app-sheet>
 */
Component({
  options: { addGlobalClass: true },
  properties: {
    show: { type: Boolean, value: false },
    /** 为 true 时点遮罩不关闭（例如正在提交） */
    locked: { type: Boolean, value: false }
  },
  data: { mounted: false, on: false },
  observers: {
    show(v) {
      clearTimeout(this._t);
      if (v) {
        this.setData({ mounted: true }, () => {
          this._t = setTimeout(() => this.setData({ on: true }), 20);
        });
      } else if (this.data.mounted) {
        this.setData({ on: false });
        this._t = setTimeout(() => this.setData({ mounted: false }), 300);
      }
    }
  },
  lifetimes: {
    detached() {
      clearTimeout(this._t);
    }
  },
  methods: {
    onScrim() {
      if (!this.data.locked) this.triggerEvent('close');
    },
    noop() {}
  }
});
