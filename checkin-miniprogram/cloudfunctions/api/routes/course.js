/**
 * 课程与签到点位。
 *
 * 一门课程只有一个签到点位（经纬度 + 距离阈值），点位直接作为课程字段保存，
 * 不另设点位表——业务上明确不支持多点位，单独建表只会增加一致性风险。
 */
const { AppError, CODES } = require('../lib/errors');
const { getById, fetchAll, pool } = require('../lib/db-helpers');
const { isValidCoord } = require('../lib/geo');
const v = require('../lib/validate');

const COURSES = 'courses';
const CHECKINS = 'checkins';
const DEFAULT_RADIUS = 50;
const MIN_RADIUS = 10;
const MAX_RADIUS = 1000;

/** 把前端提交的课程表单清洗成可入库的字段 */
function parseCourse(data) {
  const name = v.str(data.name, '课程名称', { max: 40 });
  const note = v.str(data.note, '备注', { required: false, max: 60 });
  const latitude = v.num(data.latitude, '纬度', { min: -90, max: 90 });
  const longitude = v.num(data.longitude, '经度', { min: -180, max: 180 });
  if (!isValidCoord(latitude, longitude)) throw v.bad('请先在地图上选择签到点位');
  const radius =
    data.radius === undefined || data.radius === null || data.radius === ''
      ? DEFAULT_RADIUS
      : Math.round(v.num(data.radius, '签到距离', { min: MIN_RADIUS, max: MAX_RADIUS }));
  const address = v.str(data.address, '地点名称', { required: false, max: 80 });
  return { name, note, latitude, longitude, radius, address };
}

/** 学生端只需要这些字段 */
function publicCourse(c) {
  return {
    id: c._id,
    name: c.name,
    note: c.note || '',
    latitude: c.latitude,
    longitude: c.longitude,
    radius: c.radius,
    address: c.address || ''
  };
}

async function requireCourse(db, id) {
  const course = await getById(db, COURSES, id);
  if (!course) throw new AppError(CODES.COURSE_NOT_FOUND, '找不到这门课程，可能已被删除');
  return course;
}

module.exports = {
  requireCourse,
  publicCourse,
  DEFAULT_RADIUS,
  routes: {
    /** 课程列表（学生端，无需登录） */
    'course.listPublic': {
      async run(data, { db }) {
        const list = await fetchAll(db.collection(COURSES).orderBy('createdAt', 'desc'));
        return { list: list.map(publicCourse) };
      }
    },

    /** 课程列表（管理端，附带每门课的签到人数） */
    'course.list': {
      auth: 'admin',
      async run(data, { db }) {
        const list = await fetchAll(db.collection(COURSES).orderBy('createdAt', 'desc'));
        const counts = await pool(list, 8, async (c) => {
          const { total } = await db.collection(CHECKINS).where({ courseId: c._id, deleted: false }).count();
          return total;
        });
        return {
          list: list.map((c, i) => ({ ...publicCourse(c), checkinCount: counts[i], createdAt: c.createdAt }))
        };
      }
    },

    'course.get': {
      auth: 'admin',
      async run(data, { db }) {
        const course = await requireCourse(db, v.id(data.id, '课程'));
        return { course: { ...publicCourse(course), createdAt: course.createdAt } };
      }
    },

    'course.create': {
      auth: 'admin',
      async run(data, { db, openid, now }) {
        const fields = parseCourse(data);
        const doc = { ...fields, createdBy: openid, createdAt: now(), updatedAt: now() };
        const res = await db.collection(COURSES).add({ data: doc });
        return { course: publicCourse({ ...doc, _id: res._id }) };
      }
    },

    'course.update': {
      auth: 'admin',
      async run(data, { db, now }) {
        const id = v.id(data.id, '课程');
        await requireCourse(db, id);
        const fields = parseCourse(data);
        await db.collection(COURSES).doc(id).update({ data: { ...fields, updatedAt: now() } });
        return { course: publicCourse({ ...fields, _id: id }) };
      }
    },

    /** 删除课程，同时删除这门课的全部签到记录 */
    'course.remove': {
      auth: 'admin',
      async run(data, { db }) {
        const id = v.id(data.id, '课程');
        await requireCourse(db, id);
        const removed = await db.collection(CHECKINS).where({ courseId: id }).remove();
        await db.collection(COURSES).doc(id).remove();
        return { removedCheckins: (removed && removed.stats && removed.stats.removed) || 0 };
      }
    }
  }
};
