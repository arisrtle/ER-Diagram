/**
 * 学生登录：学号 + 姓名与名单匹配即可，不需要密码，不绑定微信。
 */
const api = require('../../../utils/api');
const { getStudent, setStudent } = require('../../../utils/session');

Page({
  data: {
    studentNo: '',
    name: '',
    focus: '',
    error: '',
    loading: false
  },

  onLoad() {
    // 之前登录过：预填学号姓名，方便确认后直接进
    const s = getStudent();
    if (s) this.setData({ studentNo: s.studentNo, name: s.name });
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [key]: e.detail.value, error: '' });
  },
  onFocus(e) {
    this.setData({ focus: e.currentTarget.dataset.key });
  },
  onBlur() {
    this.setData({ focus: '' });
  },
  nextField() {
    this.setData({ focus: 'name' });
  },

  async submit() {
    const studentNo = this.data.studentNo.trim();
    const name = this.data.name.trim();
    if (!studentNo || !name || this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      const { student } = await api.call('student.login', { studentNo, name });
      setStudent(student);
      wx.redirectTo({ url: '/pages/student/checkin/checkin' });
    } catch (e) {
      this.setData({ error: e.message });
    } finally {
      this.setData({ loading: false });
    }
  }
});
