/**
 * 线条图标。颜色跟随文字颜色（currentColor）。
 * <ic name="pin" size="28" />   size 单位为 rpx
 * 可用图标见 ic.wxss（由 scripts/build_icons.py 生成）。
 */
Component({
  properties: {
    name: { type: String, value: '' },
    size: { type: Number, value: 36 }
  }
});
