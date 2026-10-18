/**
 * 签到记录管理（管理端）：查看、补录、修改、删除、导出 Excel。
 *
 * 删除是软删除（deleted=true）：列表和导出里不再出现，但记录仍占着
 * 「课程 + 设备」「课程 + 学号」两个位置，保证「同一设备同一课程只能签 1 次，无例外」
 * 不会因为删除而被绕过。管理员可以给该学生补录，补录会复用这条记录。
 */
const { AppError, CODES } = require('../lib/errors');
const { getById, fetchAll } = require('../lib/db-helpers');
const { buildRecordsWorkbook, formatCST } = require('../lib/excel');
const { requireCourse } = require('./course');
const { STUDENTS } = require('./student');
const { CHECKINS } = require('./checkin');
const v = require('../lib/validate');

const COURSES = 'courses';
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function adminRecord(r, courseName) {
  return {
    id: r._id,
    courseId: r.courseId,
    courseName: courseName || '（课程已删除）',
    studentNo: r.studentNo,
    name: r.name,
    className: r.className,
    checkedAt: r.checkedAt,
    distance: typeof r.distance === 'number' ? r.distance : null,
    radius: r.radius || null,
    source: r.source,
    deviceTail: r.deviceId ? String(r.deviceId).slice(0, 8) : '',
    remark: r.remark || '',
    updatedAt: r.updatedAt || null
  };
}

async function courseNameMap(db) {
  const list = await fetchAll(db.collection(COURSES).field({ name: true }));
  return new Map(list.map((c) => [c._id, c.name]));
}

async function requireRecord(db, id) {
  const r = await getById(db, CHECKINS, id);
  if (!r || r.deleted) throw new AppError(CODES.NOT_FOUND, '这条签到记录不存在或已被删除');
  return r;
}

async function requireStudent(db, studentNoRaw) {
  const studentNo = v.studentNo(studentNoRaw);
  const s = await getById(db, STUDENTS, studentNo);
  if (!s) throw new AppError(CODES.STUDENT_NOT_FOUND, `名单里没有学号 ${studentNo}，请先导入该学生`);
  return s;
}

/** 解析管理员填写的签到时间：接受时间戳或 ISO 字符串，不允许晚于当前时间 */
function parseTime(value, now) {
  const d = typeof value === 'number' ? new Date(value) : new Date(String(value));
  if (Number.isNaN(d.getTime())) throw v.bad('签到时间格式不对');
  if (d.getTime() > now().getTime() + 5 * 60 * 1000) throw v.bad('签到时间不能晚于现在');
  return d;
}

module.exports = {
  routes: {
    /** 记录列表：可按课程筛选、按学号或姓名搜索 */
    'record.list': {
      auth: 'admin',
      async run(data, { db }) {
        const page = Math.max(1, Math.floor(Number(data.page) || 1));
        const pageSize = Math.min(100, Math.max(10, Math.floor(Number(data.pageSize) || 30)));
        const where = { deleted: false };
        if (data.courseId) where.courseId = v.id(data.courseId, '课程');
        const keyword = v.str(data.keyword, '关键词', { required: false, max: 32 });
        if (keyword) {
          const re = db.RegExp({ regexp: escapeRegExp(keyword), options: 'i' });
          if (/^[A-Za-z0-9-]+$/.test(keyword)) where.studentNo = re;
          else where.name = re;
        }
        const coll = db.collection(CHECKINS);
        const [{ total }, res, names] = await Promise.all([
          coll.where(where).count(),
          coll.where(where).orderBy('checkedAt', 'desc').skip((page - 1) * pageSize).limit(pageSize).get(),
          courseNameMap(db)
        ]);
        return { list: res.data.map((r) => adminRecord(r, names.get(r.courseId))), total, page, pageSize };
      }
    },

    'record.get': {
      auth: 'admin',
      async run(data, { db }) {
        const r = await requireRecord(db, v.id(data.id, '记录'));
        const course = await getById(db, COURSES, r.courseId);
        return { record: adminRecord(r, course && course.name) };
      }
    },

    /** 管理员补录：用于学生手机没电、定位异常等情况 */
    'record.add': {
      auth: 'admin',
      async run(data, { db, openid, now }) {
        const course = await requireCourse(db, v.id(data.courseId, '课程'));
        const student = await requireStudent(db, data.studentNo);
        const remark = v.str(data.remark, '备注', { required: false, max: 60 });
        const checkedAt = data.checkedAt ? parseTime(data.checkedAt, now) : now();
        const coll = db.collection(CHECKINS);

        const existing = await coll.where({ courseId: course._id, studentNo: student._id }).limit(1).get();
        if (existing.data.length) {
          const r = existing.data[0];
          if (!r.deleted) throw new AppError(CODES.CONFLICT, `${student.name} 已经签到过这门课了`);
          // 复用被删除的那条记录，保持「课程 + 学号」只有一条
          const patch = {
            deleted: false, source: 'admin', remark, checkedAt,
            name: student.name, className: student.className,
            updatedAt: now(), updatedBy: openid
          };
          await coll.doc(r._id).update({ data: patch });
          return { record: adminRecord({ ...r, ...patch }, course.name) };
        }

        const doc = {
          _id: `${course._id}_admin_${student._id}`,
          courseId: course._id,
          studentNo: student._id,
          name: student.name,
          className: student.className,
          deviceId: null,
          openid: null,
          latitude: null,
          longitude: null,
          accuracy: null,
          distance: null,
          radius: course.radius,
          checkedAt,
          source: 'admin',
          remark,
          deleted: false,
          createdBy: openid,
          updatedAt: now()
        };
        await coll.add({ data: doc });
        return { record: adminRecord(doc, course.name) };
      }
    },

    /** 修改记录：可改对应学生（填错人时更正）、签到时间、备注 */
    'record.update': {
      auth: 'admin',
      async run(data, { db, openid, now }) {
        const id = v.id(data.id, '记录');
        const r = await requireRecord(db, id);
        const patch = { updatedAt: now(), updatedBy: openid };

        if (data.studentNo !== undefined && data.studentNo !== r.studentNo) {
          const student = await requireStudent(db, data.studentNo);
          const clash = await db.collection(CHECKINS)
            .where({ courseId: r.courseId, studentNo: student._id }).limit(1).get();
          if (clash.data.length && clash.data[0]._id !== id) {
            throw new AppError(CODES.CONFLICT, `${student.name} 在这门课已经有签到记录了`);
          }
          Object.assign(patch, { studentNo: student._id, name: student.name, className: student.className });
        }
        if (data.checkedAt !== undefined) patch.checkedAt = parseTime(data.checkedAt, now);
        if (data.remark !== undefined) patch.remark = v.str(data.remark, '备注', { required: false, max: 60 });

        await db.collection(CHECKINS).doc(id).update({ data: patch });
        const course = await getById(db, COURSES, r.courseId);
        return { record: adminRecord({ ...r, ...patch }, course && course.name) };
      }
    },

    /** 删除记录（软删除，见文件头说明） */
    'record.remove': {
      auth: 'admin',
      async run(data, { db, openid, now }) {
        const id = v.id(data.id, '记录');
        await requireRecord(db, id);
        await db.collection(CHECKINS).doc(id).update({
          data: { deleted: true, deletedAt: now(), deletedBy: openid }
        });
        return { id };
      }
    },

    /** 导出 Excel：生成文件存入云存储，返回 fileID 由前端下载打开 */
    'record.export': {
      auth: 'admin',
      async run(data, { db, cloud, now }) {
        const where = { deleted: false };
        let title = '全部课程';
        if (data.courseId) {
          const course = await requireCourse(db, v.id(data.courseId, '课程'));
          where.courseId = course._id;
          title = course.name;
        }
        const records = await fetchAll(
          db.collection(CHECKINS).where(where).orderBy('courseId', 'asc').orderBy('checkedAt', 'asc')
        );
        if (!records.length) throw new AppError(CODES.NOT_FOUND, '还没有可导出的签到记录');

        const names = await courseNameMap(db);
        const fileContent = await buildRecordsWorkbook(records, names);
        const stamp = formatCST(now()).replace(/[-: ]/g, '').slice(0, 12);
        const res = await cloud.uploadFile({ cloudPath: `exports/checkin-${stamp}-${Date.now() % 100000}.xlsx`, fileContent });
        const safeTitle = title.replace(/[\\/:*?"<>|]/g, '').slice(0, 20);
        return { fileID: res.fileID, fileName: `签到记录-${safeTitle}-${stamp}.xlsx`, count: records.length };
      }
    }
  }
};
