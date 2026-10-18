/**
 * 预览场景：每个场景 = 页面 + 假数据 + 加载后的操作。
 *   node scripts/preview/build.js <输出目录>
 */
const SPOT = { latitude: 30.5123, longitude: 114.4101 };
const north = (m, east = 0) => ({ latitude: SPOT.latitude + m / 111195, longitude: SPOT.longitude + east / (111195 * Math.cos((SPOT.latitude * Math.PI) / 180)) });

const COURSES = [
  { id: 'c1', name: '数据库原理 第 5 周', note: '', ...SPOT, radius: 50, address: '教学楼 B 204', checkinCount: 38 },
  { id: 'c2', name: '计算机网络 第 5 周', note: '', ...north(400), radius: 30, address: '实验楼 302', checkinCount: 12 },
  { id: 'c3', name: '软件工程 第 4 周', note: '', ...north(-300), radius: 100, address: '图书馆报告厅', checkinCount: 86 }
];
const today = (h, m, s) => { const d = new Date(); d.setHours(h, m, s, 0); return d.toISOString(); };
const RECORDS = [
  ['c1', '2023010102', '周以安', '计科 2301', today(10, 21, 46), 12.4, 'student'],
  ['c1', '2023010103', '许南星', '计科 2301', today(10, 20, 5), 31.0, 'student'],
  ['c1', '2023020101', '王泽宇', '计科 2302', today(10, 19, 58), 8.7, 'student'],
  ['c1', '2023010104', '陈一鸣', '计科 2301', today(10, 18, 12), null, 'admin'],
  ['c1', '2023020103', '吴语桐', '计科 2302', today(10, 17, 40), 44.1, 'student'],
  ['c3', '2023010105', '赵书言', '计科 2301', today(9, 12, 31), 66.0, 'student'],
  ['c2', '2023020102', '李沐阳', '计科 2302', today(8, 5, 9), 21.9, 'student']
].map(([courseId, studentNo, name, className, checkedAt, distance, source], i) => ({
  id: `r${i}`, courseId, courseName: COURSES.find((c) => c.id === courseId).name, studentNo, name, className, checkedAt, distance,
  radius: COURSES.find((c) => c.id === courseId).radius, source, deviceTail: source === 'admin' ? '' : ['3b7c1e9a', '9d02f4c1', 'e51a77b0', '', '0c6b2d98', '71fa03e2', 'a4c8e1f7'][i],
  remark: source === 'admin' ? '手机没电' : ''
}));
const STUDENTS = [
  ['计科 2301', '林知夏', '2023010101'], ['计科 2301', '周以安', '2023010102'], ['计科 2301', '许南星', '2023010103'],
  ['计科 2301', '陈一鸣', '2023010104'], ['计科 2301', '赵书言', '2023010105'], ['计科 2301', '孙可欣', '2023010106'],
  ['计科 2302', '王泽宇', '2023020101'], ['计科 2302', '李沐阳', '2023020102'], ['计科 2302', '吴语桐', '2023020103']
].map(([className, name, studentNo]) => ({ className, name, studentNo }));

const ME = { studentNo: '2023010101', name: '林知夏', className: '计科 2301' };
const LOGGED_IN = { 'checkin.student': ME, 'checkin.deviceId': '3b7c1e9a-6d42-4f0b-9a1c-2e5d7f8a9b10' };

function api(states = {}, extra = {}) {
  return (action) => {
    if (extra[action]) return extra[action]();
    switch (action) {
      case 'course.listPublic': return { list: COURSES };
      case 'course.list': return { list: COURSES };
      case 'course.get': return { course: COURSES[0] };
      case 'checkin.status': return { states };
      case 'student.list': return { list: STUDENTS, total: 86, page: 1, pageSize: 50, classes: [{ name: '计科 2301', count: 43 }, { name: '计科 2302', count: 43 }], grandTotal: 86 };
      case 'record.list': return { list: RECORDS, total: RECORDS.length, page: 1, pageSize: 30 };
      case 'admin.list': return { list: [
        { id: 'o-li', nickname: '李助教', status: 'pending', tail: '7Hk2aQ', me: false },
        { id: 'o-wang', nickname: '王老师', status: 'active', tail: 'p3XcQ1', me: true },
        { id: 'o-liu', nickname: '刘老师', status: 'active', tail: 'Z0f9Tb', me: false }
      ] };
      default: return {};
    }
  };
}

const ev = (dataset = {}, detail = {}) => ({ currentTarget: { dataset }, detail });

module.exports = [
  { name: 'index', route: 'pages/index/index', mock: { api: api() } },
  { name: 'student-login', route: 'pages/student/login/login', mock: { api: api() } },
  {
    name: 'student-login-error', route: 'pages/student/login/login', mock: { api: api() },
    act: async (p) => p.setData({ studentNo: '2023010101', name: '林夏', error: '名单里没有这个学号和姓名的组合，请核对后再试，或联系老师确认是否已导入' })
  },
  { name: 'checkin-out', route: 'pages/student/checkin/checkin', mock: { storage: LOGGED_IN, api: api({ c3: { state: 'done', record: { checkedAt: today(9, 8, 2), distance: 40 } } }), location: () => ({ ...north(60, 40), accuracy: 15 }) } },
  { name: 'checkin-in', route: 'pages/student/checkin/checkin', mock: { storage: LOGGED_IN, api: api({ c3: { state: 'done', record: { checkedAt: today(9, 8, 2), distance: 40 } } }), location: () => ({ ...north(22, 16), accuracy: 12 }) } },
  {
    name: 'checkin-hold', route: 'pages/student/checkin/checkin', mock: { storage: LOGGED_IN, api: api({ c3: { state: 'done', record: { checkedAt: today(9, 8, 2), distance: 40 } } }), location: () => ({ ...north(22, 16), accuracy: 12 }) },
    act: async (p) => { const h = p.selectComponent ? null : null; return h; },
    holding: true
  },
  {
    name: 'checkin-done', route: 'pages/student/checkin/checkin', mock: { storage: LOGGED_IN, api: api({ c1: { state: 'done', record: { checkedAt: today(10, 24, 8), distance: 26.8 } }, c3: { state: 'done', record: { checkedAt: today(9, 8, 2), distance: 40 } } }), location: () => ({ ...north(22, 16), accuracy: 12 }) },
    act: async (p) => p.pickCourse(ev({ idx: 0 }))
  },
  { name: 'checkin-used', route: 'pages/student/checkin/checkin', mock: { storage: LOGGED_IN, api: api({ c1: { state: 'deviceUsed' } }), location: () => ({ ...north(18, 8), accuracy: 12 }) }, act: async (p) => p.pickCourse(ev({ idx: 0 })) },
  { name: 'checkin-denied', route: 'pages/student/checkin/checkin', mock: { storage: LOGGED_IN, api: api({}), location: () => null } },
  { name: 'checkin-se', route: 'pages/student/checkin/checkin', mock: { height: 667, storage: LOGGED_IN, api: api({}), location: () => ({ ...north(22, 16), accuracy: 12 }) } },
  { name: 'admin-login', route: 'pages/admin/login/login', mock: { api: api() } },
  { name: 'admin-apply', route: 'pages/admin/login/login', mock: { api: api() }, act: async (p) => p.setData({ view: 'apply', applyName: '李助教' }) },
  { name: 'admin-pending', route: 'pages/admin/login/login', mock: { api: api() }, act: async (p) => p.setData({ view: 'pending', nickname: '李助教' }) },
  { name: 'admin-courses', route: 'pages/admin/home/home', mock: { api: api() } },
  { name: 'admin-admins', route: 'pages/admin/home/home', mock: { api: api() }, act: async (p, wait) => { p.openAdmins(); await wait(100); } },
  { name: 'admin-students', route: 'pages/admin/home/home', mock: { api: api() }, act: async (p, wait, render) => { p.switchTab(ev({ tab: 'students' })); render(); await wait(150); } },
  {
    name: 'admin-import', route: 'pages/admin/home/home', mock: { api: api() },
    act: async (p, wait, render) => {
      p.switchTab(ev({ tab: 'students' })); render(); await wait(150);
      const s = p.selectComponent('#students');
      s.setData({ resultSheet: true, importing: false, result: { added: 40, updated: 3, skipped: 2, fileName: '学生名单.xlsx', problems: [{ row: 7, reason: '学号「2023 0105」格式不对' }, { row: 19, reason: '学号与第 4 行重复' }] } });
      render(); await wait(150);
    }
  },
  { name: 'admin-records', route: 'pages/admin/home/home', mock: { api: api() }, act: async (p, wait, render) => { p.switchTab(ev({ tab: 'records' })); render(); await wait(150); } },
  {
    name: 'admin-record-edit', route: 'pages/admin/home/home', mock: { api: api() },
    act: async (p, wait, render) => { p.switchTab(ev({ tab: 'records' })); render(); await wait(150); p.selectComponent('#records').openEdit(ev({ i: 0 })); render(); await wait(150); }
  },
  {
    name: 'admin-record-delete', route: 'pages/admin/home/home', mock: { api: api() },
    act: async (p, wait, render) => { p.switchTab(ev({ tab: 'records' })); render(); await wait(150); const r = p.selectComponent('#records'); r.openEdit(ev({ i: 0 })); r.askDel(); render(); await wait(150); }
  },
  {
    name: 'admin-record-add', route: 'pages/admin/home/home', mock: { api: api() },
    act: async (p, wait, render) => { p.switchTab(ev({ tab: 'records' })); render(); await wait(150); const r = p.selectComponent('#records'); r.openAdd(); r.setData({ addNo: '2023010101', addRemark: '定位失败，课上点名确认' }); render(); await wait(150); }
  },
  {
    name: 'admin-export', route: 'pages/admin/home/home', mock: { api: api() },
    act: async (p, wait, render) => { p.switchTab(ev({ tab: 'records' })); render(); await wait(150); const r = p.selectComponent('#records'); r.pickCourse(ev({ id: 'c1' })); await wait(80); r.openExport(); render(); await wait(150); }
  },
  {
    name: 'admin-export-done', route: 'pages/admin/home/home', mock: { api: api() },
    act: async (p, wait, render) => { p.switchTab(ev({ tab: 'records' })); render(); await wait(150); const r = p.selectComponent('#records'); r.openExport(); r.setData({ exportStage: 'done', exportFile: { fileName: '签到记录-数据库原理 第 5 周-202610131030.xlsx', count: 38 } }); render(); await wait(150); }
  },
  { name: 'course-edit', route: 'pages/admin/course-edit/course-edit', mock: { api: api(), query: { id: 'c1' }, location: () => ({ ...SPOT, accuracy: 10 }) } },
  { name: 'course-new', route: 'pages/admin/course-edit/course-edit', mock: { api: api(), location: () => ({ ...SPOT, accuracy: 10 }) }, act: async (p) => p.setData({ name: '' }) },
  { name: 'course-delete', route: 'pages/admin/course-edit/course-edit', mock: { api: api(), query: { id: 'c1' }, location: () => ({ ...SPOT, accuracy: 10 }) }, act: async (p, wait) => { p.askDelete(); await wait(100); } }
];
