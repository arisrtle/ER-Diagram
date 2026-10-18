/**
 * 签到范围图：点位在圆心，实线圆是签到阈值，虚线圆是两倍阈值，黑点是「我」。
 * 显示范围是阈值的 2.3 倍；更远时黑点停在最外圈边上，方向仍然正确。
 *
 * mode: wait 定位中 | in 在范围内 | out 超出范围 | done 已签到 | used 本机已用
 */
const SIZE = 480; // 组件边长（rpx）
const MID = SIZE / 2;
const MAX_R = MID - 12;
const SPAN = 2.3; // 最外圈 = 阈值 × SPAN

Component({
  options: { addGlobalClass: true },
  properties: {
    radius: { type: Number, value: 50 },
    distance: { type: Number, value: -1 },
    angle: { type: Number, value: -60 },
    accuracy: { type: Number, value: 0 },
    mode: { type: String, value: 'wait' }
  },
  data: { size: SIZE, rT: 100, ux: MID, uy: MID, accR: 0, lineLen: 0, showMe: false, labelTop: 0 },
  observers: {
    'radius, distance, angle, accuracy, mode': function (radius, distance, angle, accuracy, mode) {
      const r = radius > 0 ? radius : 50;
      const k = MAX_R / (r * SPAN);
      const rT = r * k;
      const showMe = distance >= 0 && mode !== 'done';
      const d = Math.min(Math.max(distance, 0), r * SPAN) * k;
      const a = (angle * Math.PI) / 180;
      this.setData({
        rT,
        labelTop: MID - rT - 40,
        showMe,
        ux: MID + d * Math.cos(a),
        uy: MID + d * Math.sin(a),
        lineLen: d,
        accR: Math.min(Math.max(accuracy, 0) * k, 90)
      });
    }
  }
});
