/**
 * 学生签到。
 *
 * 业务约束（全部在服务端判定，前端只做展示）：
 * 1. 学号 + 姓名必须与导入名单匹配。
 * 2. 当前位置与课程点位的距离 ≤ 阈值，否则禁止签到。
 * 3. 同一课程、同一设备 ID 只能签到 1 次，无例外：
 *    签到记录的 _id = `${courseId}_${deviceId}`，数据库主键天然保证并发下也只能写入一条；
 *    记录被管理员删除时只做软删除，_id 仍然占位，所以这台设备也不能再签。
 * 4. 签到成功后不可再次提交：同一课程同一学号已有记录（含被删除的）即拒绝。
 * 5. 额外用调用者的微信 OPENID 作为设备指纹的补充：清掉小程序缓存会让本地设备 ID 重新生成，
 *    但同一部手机上的同一个微信号仍会被识别出来。OPENID 只记录在签到记录里，不用于学生登录。
 */
const { AppError, CODES } = require('../lib/errors');
const { getById, isDuplicate } = require('../lib/db-helpers');
const { distanceMeters } = require('../lib/geo');
const { matchStudent } = require('./student');
const { requireCourse } = require('./course');
const v = require('../lib/validate');

const CHECKINS = 'checkins';

const recordId = (courseId, deviceId) => `${courseId}_${deviceId}`;

/** 学生端看到的签到结果 */
function publicRecord(r) {
  return {
    id: r._id,
    courseId: r.courseId,
    checkedAt: r.checkedAt,
    distance: r.distance,
    removed: !!r.deleted
  };
}

module.exports = {
  CHECKINS,
  recordId,
  routes: {
    /**
     * 学生端首页数据：每门课程对「我」和「这台手机」的状态
     *   open        可以签到
     *   done        我已签到
     *   removed     我的记录被管理员删除（不可再签，请联系老师）
     *   deviceUsed  这台手机已经给别人签过这门课
     */
    'checkin.status': {
      async run(data, { db, openid }) {
        const student = await matchStudent(db, data.studentNo, data.name);
        const deviceId = v.deviceId(data.deviceId);
        const coll = db.collection(CHECKINS);
        const [mine, byDevice, byWechat] = await Promise.all([
          coll.where({ studentNo: student._id }).limit(1000).get(),
          coll.where({ deviceId }).limit(1000).get(),
          openid ? coll.where({ openid }).limit(1000).get() : Promise.resolve({ data: [] })
        ]);

        const states = {};
        [...byDevice.data, ...byWechat.data].forEach((r) => {
          if (r.studentNo !== student._id) states[r.courseId] = { state: 'deviceUsed' };
        });
        mine.data.forEach((r) => {
          states[r.courseId] = r.deleted
            ? { state: 'removed' }
            : { state: 'done', record: publicRecord(r) };
        });
        return { states };
      }
    },

    /** 提交签到 */
    'checkin.submit': {
      async run(data, { db, openid, now }) {
        const student = await matchStudent(db, data.studentNo, data.name);
        const deviceId = v.deviceId(data.deviceId);
        const courseId = v.id(data.courseId, '课程');
        const latitude = v.num(data.latitude, '纬度', { min: -90, max: 90 });
        const longitude = v.num(data.longitude, '经度', { min: -180, max: 180 });
        const accuracy =
          data.accuracy === undefined || data.accuracy === null ? null : Math.round(v.num(data.accuracy, '定位精度', { min: 0, max: 100000 }));

        const course = await requireCourse(db, courseId);
        const coll = db.collection(CHECKINS);

        // —— 一次性约束：先判重，再判距离（已签过的人不该看到「超出范围」） ——
        const sameDevice = await getById(db, CHECKINS, recordId(courseId, deviceId));
        if (sameDevice) {
          if (sameDevice.studentNo === student._id) {
            if (sameDevice.deleted) throw new AppError(CODES.ALREADY_CHECKED_IN, '你这门课的签到记录已被老师处理，不能再次签到');
            throw new AppError(CODES.ALREADY_CHECKED_IN, '你已经签到过这门课了', { record: publicRecord(sameDevice) });
          }
          throw new AppError(CODES.DEVICE_USED, '这台手机已经签过这门课，每台手机每门课只能签到一次');
        }
        const sameStudent = await coll.where({ courseId, studentNo: student._id }).limit(1).get();
        if (sameStudent.data.length) {
          const r = sameStudent.data[0];
          if (r.deleted) throw new AppError(CODES.ALREADY_CHECKED_IN, '你这门课的签到记录已被老师处理，不能再次签到');
          throw new AppError(CODES.ALREADY_CHECKED_IN, '你已经签到过这门课了', { record: publicRecord(r) });
        }
        if (openid) {
          const sameWechat = await coll.where({ courseId, openid }).limit(1).get();
          if (sameWechat.data.length) {
            throw new AppError(CODES.DEVICE_USED, '这台手机已经签过这门课，每台手机每门课只能签到一次');
          }
        }

        // —— 距离判定 ——
        const distance = distanceMeters(latitude, longitude, course.latitude, course.longitude);
        if (distance > course.radius) {
          throw new AppError(
            CODES.OUT_OF_RANGE,
            `你距离签到点 ${Math.round(distance)} 米，超出了 ${course.radius} 米的范围`,
            { distance, radius: course.radius }
          );
        }

        // —— 写入：_id 由课程 + 设备决定，并发重复提交只有一条能成功 ——
        const doc = {
          _id: recordId(courseId, deviceId),
          courseId,
          studentNo: student._id,
          name: student.name,
          className: student.className,
          deviceId,
          openid: openid || null,
          latitude,
          longitude,
          accuracy,
          distance,
          radius: course.radius,
          checkedAt: now(),
          source: 'student',
          remark: '',
          deleted: false
        };
        try {
          await coll.add({ data: doc });
        } catch (e) {
          if (isDuplicate(e)) {
            throw new AppError(CODES.DEVICE_USED, '这台手机已经签过这门课，每台手机每门课只能签到一次');
          }
          throw e;
        }
        return { record: publicRecord(doc) };
      }
    }
  }
};
