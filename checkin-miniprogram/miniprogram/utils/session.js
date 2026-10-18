/**
 * 学生登录状态（只存在本机）。
 * 学生端没有密码，也不绑定微信；每次签到时云函数都会用学号 + 姓名重新核对名单。
 */
const KEY = 'checkin.student';

function getStudent() {
  try {
    const s = wx.getStorageSync(KEY);
    return s && s.studentNo && s.name ? s : null;
  } catch (e) {
    return null;
  }
}

function setStudent(student) {
  wx.setStorageSync(KEY, {
    studentNo: student.studentNo,
    name: student.name,
    className: student.className
  });
}

function clearStudent() {
  try {
    wx.removeStorageSync(KEY);
  } catch (e) {
    /* 忽略 */
  }
}

module.exports = { getStudent, setStudent, clearStudent };
