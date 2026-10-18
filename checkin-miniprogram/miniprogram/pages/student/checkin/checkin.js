/**
 * 学生签到页。
 *
 * 1. 读取课程列表与「我 / 这台手机」在各课程的签到状态（checkin.status）。
 * 2. 页面可见时每 5 秒定位一次（wx.getLocation，gcj02），实时画出与点位的距离。
 * 3. 在范围内时按住按钮约 1 秒提交；提交前再定位一次，以提交瞬间的位置为准。
 * 4. 是否允许签到完全由云函数判定（名单、距离、一机一次），前端只负责展示结果。
 */
const api = require('../../../utils/api');
const geo = require('../../../utils/geo');
const fmt = require('../../../utils/format');
const { toast, buzz } = require('../../../utils/ui');
const { getStudent, clearStudent } = require('../../../utils/session');
const { getDeviceId } = require('../../../utils/device');

const REFRESH_MS = 5000;

function getLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 3500,
      success: resolve,
      fail: reject
    });
  });
}

Page({
  data: {
    student: null,
    compact: false,
    loading: true,
    loadError: '',
    courses: [],
    idx: 0,
    states: {},
    // 定位
    phase: 'locating', // locating | ok | denied | off | error
    loc: null,
    // 当前课程派生出的展示数据
    course: null,
    mode: 'wait', // wait | in | out | done | used | removed
    distance: -1,
    distanceText: '—',
    angle: -60,
    accuracy: 0,
    over: 0,
    doneTime: '',
    justDone: false,
    submitting: false,
    holdMode: 'off',
    holdLabel: '正在定位',
    holdSub: '',
    hint: ''
  },

  onLoad() {
    const student = getStudent();
    if (!student) {
      wx.redirectTo({ url: '/pages/student/login/login' });
      return;
    }
    this.deviceId = getDeviceId();
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const heightRpx = (win.windowHeight * 750) / win.windowWidth;
    this.setData({ student, compact: heightRpx < 1520 });
    this.load();
  },

  onShow() {
    if (this.data.student) this.startLocating();
  },
  onHide() {
    this.stopLocating();
  },
  onUnload() {
    this.stopLocating();
    clearTimeout(this._doneT);
  },

  // ------------------------------------------------------------ 数据
  async load() {
    const s = this.data.student;
    this.setData({ loading: true, loadError: '' });
    try {
      const [{ list }, { states }] = await Promise.all([
        api.call('course.listPublic'),
        api.call('checkin.status', { studentNo: s.studentNo, name: s.name, deviceId: this.deviceId })
      ]);
      // 默认选中第一门还没签到的课程
      let idx = list.findIndex((c) => !states[c.id]);
      if (idx < 0) idx = 0;
      this.setData({ courses: list, states, idx, loading: false });
      this.derive();
    } catch (e) {
      if (e.code === 'STUDENT_NOT_FOUND') return this.kickOut(e.message);
      this.setData({ loading: false, loadError: e.message });
    }
  },

  async refreshStates() {
    const s = this.data.student;
    try {
      const { states } = await api.call('checkin.status', { studentNo: s.studentNo, name: s.name, deviceId: this.deviceId });
      this.setData({ states });
      this.derive();
    } catch (e) {
      /* 状态刷新失败不打断用户 */
    }
  },

  kickOut(message) {
    clearStudent();
    toast(message || '请重新登录', 'error');
    setTimeout(() => wx.redirectTo({ url: '/pages/student/login/login' }), 1200);
  },

  // ------------------------------------------------------------ 定位
  startLocating() {
    this.stopLocating();
    this.locate();
    this._timer = setInterval(() => this.locate(), REFRESH_MS);
  },
  stopLocating() {
    clearInterval(this._timer);
    this._timer = null;
  },

  async locate() {
    if (this._locating || this.data.submitting) return null;
    this._locating = true;
    try {
      const res = await getLocation();
      const loc = { latitude: res.latitude, longitude: res.longitude, accuracy: Math.round(res.accuracy || res.horizontalAccuracy || 0) };
      this.setData({ loc, phase: 'ok' });
      this.derive();
      return loc;
    } catch (e) {
      const msg = String((e && e.errMsg) || '');
      let phase = 'error';
      if (/auth|deny|denied|authorize/i.test(msg)) phase = 'denied';
      else if (/system permission|location service|LOCATIONSWITCHOFF|ERROR_NOCELL&WIFI_LOCATIONSWITCHOFF/i.test(msg)) phase = 'off';
      if (phase !== 'error') this.stopLocating();
      // 已经有位置时，偶发失败不改变界面
      if (!this.data.loc || phase !== 'error') this.setData({ phase });
      this.derive();
      return null;
    } finally {
      this._locating = false;
    }
  },

  async relocate() {
    const loc = await this.locate();
    if (loc) toast('位置已更新');
  },

  openSetting() {
    wx.openSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          this.setData({ phase: 'locating' });
          this.startLocating();
        }
      }
    });
  },

  retryLocate() {
    this.setData({ phase: 'locating' });
    this.derive();
    this.startLocating();
  },

  // ------------------------------------------------------------ 派生展示数据
  derive() {
    const { courses, idx, states, loc, phase, submitting } = this.data;
    const course = courses[idx] || null;
    if (!course) {
      this.setData({ course: null });
      return;
    }
    const st = states[course.id];
    let distance = -1;
    let angle = this.data.angle;
    if (loc) {
      distance = geo.distance(course.latitude, course.longitude, loc.latitude, loc.longitude);
      angle = geo.screenAngle(course.latitude, course.longitude, loc.latitude, loc.longitude);
    }

    let mode;
    if (st && st.state === 'done') mode = 'done';
    else if (st && st.state === 'deviceUsed') mode = 'used';
    else if (st && st.state === 'removed') mode = 'removed';
    else if (phase !== 'ok' || distance < 0) mode = 'wait';
    else mode = distance <= course.radius ? 'in' : 'out';

    const over = Math.max(0, Math.ceil(distance - course.radius));
    let holdMode = 'off';
    let holdLabel = '';
    let holdSub = '';
    let hint = '';
    if (submitting) {
      holdMode = 'busy';
      holdLabel = '正在提交';
    } else if (mode === 'in') {
      holdMode = 'ready';
      holdLabel = '按住签到';
      holdSub = '约 1 秒';
      hint = '按住直到外圈走满，松手前不会提交。';
    } else if (mode === 'out') {
      holdLabel = '不在范围内';
      holdSub = '靠近教室后再试';
      hint = `需要进入 ${course.radius} 米范围内才能签到。`;
    } else if (mode === 'wait') {
      holdLabel = '正在定位';
      hint = '正在获取你的位置。';
    }
    if (mode === 'done') hint = '这门课已经签到成功，不能再次提交。';
    if (mode === 'used') hint = '这台手机已经给其他同学签过这门课。每台手机每门课只能签到一次。';
    if (mode === 'removed') hint = '你这门课的签到记录已被老师处理，不能再次签到。如有疑问请联系老师。';

    const record = st && st.record;
    const shownDistance = mode === 'done' && record && typeof record.distance === 'number' ? record.distance : distance;

    this.setData({
      course,
      mode,
      distance,
      distanceText: shownDistance >= 0 ? String(Math.round(shownDistance)) : '—',
      angle,
      accuracy: loc ? loc.accuracy : 0,
      over,
      doneTime: record ? fmt.hm(record.checkedAt) : '',
      holdMode,
      holdLabel,
      holdSub,
      hint
    });
  },

  pickCourse(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (idx === this.data.idx) return;
    this.setData({ idx, justDone: false });
    this.derive();
  },

  // ------------------------------------------------------------ 提交
  onBlocked() {
    const { mode, course, over } = this.data;
    if (mode === 'out') toast(`还差 ${over} 米，进入 ${course.radius} 米范围内才能签到`);
    else if (mode === 'wait') toast('正在定位，请稍候');
  },

  async submit() {
    const { course, student } = this.data;
    if (!course || this.data.submitting) return;
    this.setData({ submitting: true });
    this.derive();

    // 提交前再定位一次，以提交瞬间的位置为准
    let loc = null;
    try {
      const res = await getLocation();
      loc = { latitude: res.latitude, longitude: res.longitude, accuracy: Math.round(res.accuracy || 0) };
      this.setData({ loc });
    } catch (e) {
      loc = this.data.loc;
    }
    if (!loc) {
      this.setData({ submitting: false });
      this.derive();
      toast('定位失败，请重试', 'error');
      return;
    }

    try {
      const { record } = await api.call('checkin.submit', {
        courseId: course.id,
        studentNo: student.studentNo,
        name: student.name,
        deviceId: this.deviceId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy
      });
      const states = { ...this.data.states, [course.id]: { state: 'done', record } };
      this.setData({ states, submitting: false, justDone: true });
      this.derive();
      buzz('heavy');
      toast('签到成功', 'success');
      clearTimeout(this._doneT);
      this._doneT = setTimeout(() => this.setData({ justDone: false }), 1200);
    } catch (e) {
      this.setData({ submitting: false });
      switch (e.code) {
        case 'OUT_OF_RANGE':
          toast(e.message, 'error');
          break;
        case 'ALREADY_CHECKED_IN':
        case 'DEVICE_USED':
          toast(e.message, 'error');
          await this.refreshStates();
          break;
        case 'COURSE_NOT_FOUND':
          toast(e.message, 'error');
          await this.load();
          break;
        case 'STUDENT_NOT_FOUND':
          this.kickOut(e.message);
          break;
        default:
          toast(e.message, 'error');
      }
      this.derive();
    }
  },

  logout() {
    clearStudent();
    wx.reLaunch({ url: '/pages/index/index' });
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  }
});
