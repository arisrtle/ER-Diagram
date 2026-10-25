/**
 * 演示数据（西安交通大学 · 课程签到）
 *
 * 说明：
 * 1. 这是用于测试的模拟数据，不是真实教务数据。
 * 2. 其中「自动控制原理」的上下课时间按**播种时刻**动态生成，
 *    保证第一次打开小程序就能看到一节「距开课 10 分钟」或「正在上课」的课，
 *    这样签到按钮是亮的，演示不会因为时间不对而卡住。
 * 3. 所有账号初始密码统一为 123456（仅演示用）。
 */
const { bjParts, toHM } = require('./time')

const DEFAULT_PASSWORD = '123456'

/** 动态生成「当前这节课」的时间，确保窗口是开着的 */
function demoTimes() {
  const nowMin = bjParts().minutes
  let startMin
  let endMin
  if (nowMin <= 1439 - 110) {
    // 正常时段：距开课 10 分钟（窗口刚好开启）
    startMin = nowMin + 10
    endMin = startMin + 100
  } else if (nowMin >= 60) {
    // 深夜：设成正在上课，窗口仍然有效
    startMin = nowMin - 30
    endMin = 1439
  } else {
    // 凌晨：设成刚开课
    startMin = nowMin
    endMin = nowMin + 100
  }
  return { startTime: toHM(startMin), endTime: toHM(endMin) }
}

function buildSeed() {
  const t = demoTimes()
  const today = bjParts().weekday

  const users = [
    // ---- 管理员 ----
    {
      account: 'admin',
      password: DEFAULT_PASSWORD,
      name: '王敏',
      role: 'admin',
      className: '',
      title: '教务老师',
      phone: '',
      email: '',
      status: 1
    },
    // ---- 教师 ----
    { account: 'T1001', password: DEFAULT_PASSWORD, name: '张伟', role: 'teacher', title: '教授', className: '电气工程学院', status: 1 },
    { account: 'T1002', password: DEFAULT_PASSWORD, name: '李静', role: 'teacher', title: '副教授', className: '数学学院', status: 1 },
    { account: 'T1003', password: DEFAULT_PASSWORD, name: '王建国', role: 'teacher', title: '讲师', className: '物理学院', status: 1 },
    { account: 'T1004', password: DEFAULT_PASSWORD, name: '刘芳', role: 'teacher', title: '副教授', className: '电气工程学院', status: 1 },
    // ---- 学生 ----
    { account: '20230101001', password: DEFAULT_PASSWORD, name: '李小明', role: 'student', className: '电气工程及其自动化 2301 班', status: 1 },
    { account: '20230101002', password: DEFAULT_PASSWORD, name: '王小红', role: 'student', className: '电气工程及其自动化 2301 班', status: 1 },
    { account: '20230101003', password: DEFAULT_PASSWORD, name: '赵小刚', role: 'student', className: '电气工程及其自动化 2301 班', status: 1 },
    { account: '20230101004', password: DEFAULT_PASSWORD, name: '陈雨欣', role: 'student', className: '电气工程及其自动化 2301 班', status: 1 },
    { account: '20230101005', password: DEFAULT_PASSWORD, name: '周子豪', role: 'student', className: '电气工程及其自动化 2301 班', status: 1 },
    { account: '20230101006', password: DEFAULT_PASSWORD, name: '吴静怡', role: 'student', className: '电气工程及其自动化 2301 班', status: 1 },
    { account: '20230101007', password: DEFAULT_PASSWORD, name: '郑浩然', role: 'student', className: '电气工程及其自动化 2301 班', status: 1 },
    { account: '20230101008', password: DEFAULT_PASSWORD, name: '孙梦琪', role: 'student', className: '电气工程及其自动化 2301 班', status: 1 },
    { account: '20230102001', password: DEFAULT_PASSWORD, name: '林思远', role: 'student', className: '自动化 2302 班', status: 1 },
    { account: '20230102002', password: DEFAULT_PASSWORD, name: '何雨桐', role: 'student', className: '自动化 2302 班', status: 1 },
    { account: '20230102003', password: DEFAULT_PASSWORD, name: '马俊杰', role: 'student', className: '自动化 2302 班', status: 1 },
    { account: '20230102004', password: DEFAULT_PASSWORD, name: '胡佳怡', role: 'student', className: '自动化 2302 班', status: 1 }
  ]

  // 兴庆校区附近的坐标（模拟）
  const courses = [
    {
      name: '自动控制原理',
      teacherAccount: 'T1001',
      weekday: today,
      startTime: t.startTime,
      endTime: t.endTime,
      locationName: '教二楼 301',
      latitude: 34.24695,
      longitude: 108.98362,
      radius: 50,
      status: 1
    },
    {
      name: '高等数学（下）',
      teacherAccount: 'T1002',
      weekday: 1,
      startTime: '08:00',
      endTime: '09:40',
      locationName: '主楼 A203',
      latitude: 34.24712,
      longitude: 108.98401,
      radius: 50,
      status: 1
    },
    {
      name: '大学物理',
      teacherAccount: 'T1003',
      weekday: 2,
      startTime: '10:00',
      endTime: '11:40',
      locationName: '教一楼 105',
      latitude: 34.24588,
      longitude: 108.98257,
      radius: 60,
      status: 1
    },
    {
      name: '信号与系统',
      teacherAccount: 'T1001',
      weekday: 3,
      startTime: '14:00',
      endTime: '15:40',
      locationName: '教二楼 301',
      latitude: 34.24695,
      longitude: 108.98362,
      radius: 50,
      status: 1
    },
    {
      name: '电机学',
      teacherAccount: 'T1004',
      weekday: 4,
      startTime: '08:00',
      endTime: '09:40',
      locationName: '电气楼 402',
      latitude: 34.24831,
      longitude: 108.98512,
      radius: 80,
      status: 1
    },
    {
      name: '大学英语（四）',
      teacherAccount: 'T1002',
      weekday: 5,
      startTime: '10:00',
      endTime: '11:40',
      locationName: '外语楼 201',
      latitude: 34.24601,
      longitude: 108.98624,
      radius: 50,
      status: 1
    },
    {
      name: '数据结构与算法',
      teacherAccount: 'T1003',
      weekday: 3,
      startTime: '10:00',
      endTime: '11:40',
      locationName: '计算机楼 301',
      latitude: 34.24543,
      longitude: 108.98486,
      radius: 60,
      status: 1
    }
  ]

  return { users, courses, defaultPassword: DEFAULT_PASSWORD }
}

module.exports = { buildSeed, DEFAULT_PASSWORD }
