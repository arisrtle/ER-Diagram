/**
 * 业务规则测试：node --test test/
 * 不依赖微信环境，用内存数据库驱动 router.dispatch。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { dispatch } = require('../router');
const { distanceMeters } = require('../lib/geo');
const { createMemoryDb, createMemoryCloud } = require('./memory-db');

// 课程点位：某教学楼门口（gcj02）
const SPOT = { latitude: 30.5123, longitude: 114.4101 };
// 向北偏移约 n 米
const north = (m) => ({ latitude: SPOT.latitude + m / 111195, longitude: SPOT.longitude });

function setup() {
  const db = createMemoryDb();
  const cloud = createMemoryCloud();
  let clock = new Date('2026-10-13T02:00:00Z').getTime();
  const call = (openid, action, data) =>
    dispatch({ action, data }, { db, cloud, openid, now: () => new Date((clock += 1000)) });
  return { db, cloud, call };
}

async function xlsxBuffer(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('名单');
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** 初始化：管理员、课程、两名学生 */
async function seeded() {
  const env = setup();
  const { call, cloud } = env;
  const login = await call('admin-openid', 'admin.login', { nickname: '王老师' });
  assert.equal(login.data.status, 'active');
  const created = await call('admin-openid', 'course.create', { name: '数据库原理 第 5 周', ...SPOT });
  assert.ok(created.ok, JSON.stringify(created));
  const buf = await xlsxBuffer([
    ['班级', '姓名', '学号'],
    ['计科 2301', '林知夏', 2023010101],
    ['计科 2301', '周以安', '2023010102']
  ]);
  const { fileID } = await cloud.uploadFile({ cloudPath: 'imports/a.xlsx', fileContent: buf });
  const imp = await call('admin-openid', 'student.import', { fileID });
  assert.equal(imp.data.added, 2);
  return { ...env, courseId: created.data.course.id };
}

const DEV_A = 'device-aaaaaaaaaaaaaaaa';
const DEV_B = 'device-bbbbbbbbbbbbbbbb';
const LIN = { studentNo: '2023010101', name: '林知夏' };
const ZHOU = { studentNo: '2023010102', name: '周以安' };

test('Haversine：向北 50 米约等于 50 米', () => {
  const p = north(50);
  const d = distanceMeters(SPOT.latitude, SPOT.longitude, p.latitude, p.longitude);
  assert.ok(Math.abs(d - 50) < 0.5, `got ${d}`);
});

test('第一个登录的人成为管理员，之后的人需要申请并审核', async () => {
  const { call } = setup();
  assert.equal((await call('a', 'admin.login', {})).data.status, 'active');
  assert.equal((await call('b', 'admin.login', {})).data.status, 'none');
  assert.equal((await call('b', 'course.list', {})).code, 'NOT_ADMIN');
  assert.equal((await call('b', 'admin.apply', { nickname: '李老师' })).data.status, 'pending');
  assert.equal((await call('b', 'course.list', {})).code, 'ADMIN_PENDING');
  assert.ok((await call('a', 'admin.review', { id: 'b', approve: true })).ok);
  assert.ok((await call('b', 'course.list', {})).ok);
});

test('课程默认距离阈值 50 米，阈值越界被拒绝', async () => {
  const { call } = setup();
  await call('a', 'admin.login', {});
  const c = await call('a', 'course.create', { name: '高数', ...SPOT });
  assert.equal(c.data.course.radius, 50);
  const bad = await call('a', 'course.create', { name: '高数', ...SPOT, radius: 5 });
  assert.equal(bad.code, 'BAD_REQUEST');
});

test('学号 + 姓名与名单匹配才能登录', async () => {
  const { call } = await seeded();
  assert.ok((await call('s1', 'student.login', LIN)).ok);
  assert.equal((await call('s1', 'student.login', { ...LIN, name: '林夏' })).code, 'STUDENT_NOT_FOUND');
  assert.equal((await call('s1', 'student.login', { studentNo: '999999', name: '林知夏' })).code, 'STUDENT_NOT_FOUND');
});

test('超出距离阈值禁止签到，范围内签到成功', async () => {
  const { call, courseId } = await seeded();
  const far = await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(80) });
  assert.equal(far.code, 'OUT_OF_RANGE');
  assert.ok(far.extra.distance > 50);
  const ok = await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(30) });
  assert.ok(ok.ok, JSON.stringify(ok));
});

test('签到成功后不能再次签到（同设备、换设备都不行）', async () => {
  const { call, courseId } = await seeded();
  await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(10) });
  const again = await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(10) });
  assert.equal(again.code, 'ALREADY_CHECKED_IN');
  const otherPhone = await call('s9', 'checkin.submit', { ...LIN, deviceId: DEV_B, courseId, ...north(10) });
  assert.equal(otherPhone.code, 'ALREADY_CHECKED_IN');
});

test('同一设备同一课程只能签 1 次：不能替同学代签', async () => {
  const { call, courseId } = await seeded();
  await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(10) });
  const proxy = await call('s1', 'checkin.submit', { ...ZHOU, deviceId: DEV_A, courseId, ...north(10) });
  assert.equal(proxy.code, 'DEVICE_USED');
});

test('清缓存换了设备 ID，但同一微信仍被识别', async () => {
  const { call, courseId } = await seeded();
  await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(10) });
  const r = await call('s1', 'checkin.submit', { ...ZHOU, deviceId: DEV_B, courseId, ...north(10) });
  assert.equal(r.code, 'DEVICE_USED');
});

test('并发重复提交只会写入一条', async () => {
  const { call, courseId, db } = await seeded();
  const results = await Promise.all(
    Array.from({ length: 5 }, () => call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(10) }))
  );
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(db.store.checkins.size, 1);
});

test('管理员删除记录后，该设备、该学生都不能再自助签到；管理员可补录', async () => {
  const { call, courseId } = await seeded();
  const ok = await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(10) });
  assert.ok((await call('admin-openid', 'record.remove', { id: ok.data.record.id })).ok);

  const list = await call('admin-openid', 'record.list', { courseId });
  assert.equal(list.data.total, 0);

  assert.equal((await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(10) })).code, 'ALREADY_CHECKED_IN');
  assert.equal((await call('s2', 'checkin.submit', { ...ZHOU, deviceId: DEV_A, courseId, ...north(10) })).code, 'DEVICE_USED');

  const add = await call('admin-openid', 'record.add', { courseId, studentNo: LIN.studentNo, remark: '手机没电' });
  assert.ok(add.ok, JSON.stringify(add));
  assert.equal(add.data.record.source, 'admin');
  assert.equal((await call('admin-openid', 'record.add', { courseId, studentNo: LIN.studentNo })).code, 'CONFLICT');
});

test('修改记录：更正学生、改备注；不能改成已签到的学生', async () => {
  const { call, courseId } = await seeded();
  const a = await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(10) });
  const upd = await call('admin-openid', 'record.update', { id: a.data.record.id, remark: '前排', studentNo: ZHOU.studentNo });
  assert.equal(upd.data.record.name, '周以安');
  assert.equal(upd.data.record.remark, '前排');
  await call('admin-openid', 'record.add', { courseId, studentNo: LIN.studentNo });
  const clash = await call('admin-openid', 'record.update', { id: a.data.record.id, studentNo: LIN.studentNo });
  assert.equal(clash.code, 'CONFLICT');
});

test('学生端状态：done / deviceUsed / open', async () => {
  const { call, courseId } = await seeded();
  await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(10) });
  const mine = await call('s1', 'checkin.status', { ...LIN, deviceId: DEV_A });
  assert.equal(mine.data.states[courseId].state, 'done');
  const zhouOnSamePhone = await call('s1', 'checkin.status', { ...ZHOU, deviceId: DEV_A });
  assert.equal(zhouOnSamePhone.data.states[courseId].state, 'deviceUsed');
  const zhouOwnPhone = await call('s2', 'checkin.status', { ...ZHOU, deviceId: DEV_B });
  assert.equal(zhouOwnPhone.data.states[courseId], undefined);
});

test('导入：识别乱序表头、跳过问题行、重复导入为更新', async () => {
  const { call, cloud } = await seeded();
  const buf = await xlsxBuffer([
    ['2026 秋 学生名单'],
    ['学号', '班级', '姓名'],
    ['2023010101', '计科 2302', '林知夏'],
    ['2023010103', '计科 2301', '许南星'],
    ['2023010103', '计科 2301', '许南星'],
    ['abc def', '计科 2301', '错学号'],
    ['', '计科 2301', '']
  ]);
  const { fileID } = await cloud.uploadFile({ cloudPath: 'imports/b.xlsx', fileContent: buf });
  const r = await call('admin-openid', 'student.import', { fileID });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.data.added, 1);
  assert.equal(r.data.updated, 1);
  assert.equal(r.data.skipped, 3);
  assert.equal(cloud.files.has(fileID), false, '原始名单文件应被删除');

  const list = await call('admin-openid', 'student.list', { className: '计科 2302' });
  assert.equal(list.data.total, 1);
  assert.equal(list.data.grandTotal, 3);
});

test('导入：CSV 与缺表头', async () => {
  const { call, cloud } = await seeded();
  const csv = Buffer.from('﻿班级,姓名,学号\n"计科 2303","陈一",2023030101\n', 'utf8');
  const a = await cloud.uploadFile({ cloudPath: 'imports/c.csv', fileContent: csv });
  assert.equal((await call('admin-openid', 'student.import', { fileID: a.fileID })).data.added, 1);
  const noHeader = await xlsxBuffer([['张三', '123456']]);
  const b = await cloud.uploadFile({ cloudPath: 'imports/d.xlsx', fileContent: noHeader });
  assert.equal((await call('admin-openid', 'student.import', { fileID: b.fileID })).code, 'IMPORT_INVALID');
});

test('导出 Excel：内容与表头正确，删除的记录不导出', async () => {
  const { call, cloud, courseId } = await seeded();
  const a = await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(12) });
  await call('s2', 'checkin.submit', { ...ZHOU, deviceId: DEV_B, courseId, ...north(20) });
  await call('admin-openid', 'record.remove', { id: a.data.record.id });
  const exp = await call('admin-openid', 'record.export', { courseId });
  assert.ok(exp.ok, JSON.stringify(exp));
  assert.equal(exp.data.count, 1);
  assert.match(exp.data.fileName, /^签到记录-数据库原理 第 5 周-\d{12}\.xlsx$/);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(cloud.files.get(exp.data.fileID));
  const ws = wb.worksheets[0];
  assert.equal(ws.getRow(1).getCell(4).value, '学号');
  assert.equal(ws.getRow(2).getCell(5).value, '周以安');
  assert.equal(ws.rowCount, 2);
});

test('删除课程会一并删除其签到记录', async () => {
  const { call, courseId, db } = await seeded();
  await call('s1', 'checkin.submit', { ...LIN, deviceId: DEV_A, courseId, ...north(10) });
  const r = await call('admin-openid', 'course.remove', { id: courseId });
  assert.equal(r.data.removedCheckins, 1);
  assert.equal(db.store.checkins.size, 0);
});

test('未知操作与非法参数返回清晰错误', async () => {
  const { call } = await seeded();
  assert.equal((await call('x', 'nope', {})).code, 'UNKNOWN_ACTION');
  const r = await call('s1', 'checkin.submit', { ...LIN, deviceId: 'short', courseId: 'x', latitude: 1, longitude: 1 });
  assert.equal(r.code, 'BAD_REQUEST');
});
