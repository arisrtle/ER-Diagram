/**
 * 学生：名单导入、列表、学生端登录。
 *
 * 学号是学生的唯一标识，直接用作 students 集合的文档 _id：
 * 重复导入同一学号就是覆盖更新（班级、姓名以最新名单为准），天然不会出现两条同学号记录。
 */
const { AppError, CODES } = require('../lib/errors');
const { getById, fetchAll, pool } = require('../lib/db-helpers');
const { parseStudentSheet, buildStudentTemplate } = require('../lib/excel');
const v = require('../lib/validate');

const STUDENTS = 'students';
const MAX_IMPORT_ROWS = 3000;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function publicStudent(s) {
  return { studentNo: s._id, name: s.name, className: s.className };
}

/** 学号 + 姓名 与名单匹配；匹配不上统一提示，避免泄露「学号存在但姓名不对」 */
async function matchStudent(db, studentNoRaw, nameRaw) {
  const studentNo = v.studentNo(studentNoRaw);
  const name = v.str(nameRaw, '姓名', { max: 20 });
  const doc = await getById(db, STUDENTS, studentNo);
  if (!doc || doc.name !== name) {
    throw new AppError(CODES.STUDENT_NOT_FOUND, '名单里没有这个学号和姓名的组合，请核对后再试，或联系老师确认是否已导入');
  }
  return doc;
}

module.exports = {
  matchStudent,
  STUDENTS,
  routes: {
    /** 学生端登录：学号 + 姓名，无密码，不绑定 openid */
    'student.login': {
      async run(data, { db }) {
        const doc = await matchStudent(db, data.studentNo, data.name);
        return { student: publicStudent(doc) };
      }
    },

    /**
     * Excel 批量导入。前端先把文件上传到云存储，再把 fileID 交给这里解析。
     * 返回新增、更新、跳过的数量和跳过原因（带行号），方便老师修正名单。
     */
    'student.import': {
      auth: 'admin',
      async run(data, { db, cloud, now }) {
        const fileID = v.str(data.fileID, '文件', { max: 512 });
        const ext = (fileID.split('.').pop() || '').toLowerCase();
        if (!['xlsx', 'csv'].includes(ext)) {
          throw new AppError(CODES.IMPORT_INVALID, '只支持 .xlsx 或 .csv 文件。旧版 .xls 请在 Excel 里另存为 .xlsx');
        }

        let buffer;
        try {
          const res = await cloud.downloadFile({ fileID });
          buffer = res.fileContent;
        } finally {
          // 原始文件只用于本次解析，解析完就删掉，不在云存储里留学生名单副本
          cloud.deleteFile({ fileList: [fileID] }).catch(() => {});
        }

        const { students, problems, headerMissing } = await parseStudentSheet(buffer, ext);
        if (headerMissing) {
          throw new AppError(CODES.IMPORT_INVALID, '没找到表头。第一行需要有「班级」「姓名」「学号」三列');
        }
        if (students.length === 0) {
          throw new AppError(CODES.IMPORT_INVALID, '文件里没有可导入的学生', { problems: problems.slice(0, 50) });
        }
        if (students.length > MAX_IMPORT_ROWS) {
          throw new AppError(CODES.IMPORT_INVALID, `一次最多导入 ${MAX_IMPORT_ROWS} 名学生，请拆分文件`);
        }

        // 先查出已存在的学号，区分新增 / 更新
        const _ = db.command;
        const existing = new Set();
        for (let i = 0; i < students.length; i += 100) {
          const ids = students.slice(i, i + 100).map((s) => s.studentNo);
          const res = await db.collection(STUDENTS).where({ _id: _.in(ids) }).limit(100).get();
          res.data.forEach((d) => existing.add(d._id));
        }

        const stamp = now();
        await pool(students, 10, (s) =>
          db.collection(STUDENTS).doc(s.studentNo).set({
            data: { name: s.name, className: s.className, updatedAt: stamp }
          })
        );

        const updated = students.filter((s) => existing.has(s.studentNo)).length;
        return {
          added: students.length - updated,
          updated,
          skipped: problems.length,
          problems: problems.slice(0, 50)
        };
      }
    },

    /** 学生列表：按班级筛选、按学号或姓名搜索，分页 */
    'student.list': {
      auth: 'admin',
      async run(data, { db }) {
        const page = Math.max(1, Math.floor(Number(data.page) || 1));
        const pageSize = Math.min(100, Math.max(10, Math.floor(Number(data.pageSize) || 50)));
        const keyword = v.str(data.keyword, '关键词', { required: false, max: 32 });
        const className = v.str(data.className, '班级', { required: false, max: 40 });

        const where = {};
        if (className) where.className = className;
        if (keyword) {
          const re = db.RegExp({ regexp: escapeRegExp(keyword), options: 'i' });
          if (/^[A-Za-z0-9-]+$/.test(keyword)) where._id = re;
          else where.name = re;
        }

        const coll = db.collection(STUDENTS);
        const [{ total }, res, all] = await Promise.all([
          coll.where(where).count(),
          coll.where(where).orderBy('className', 'asc').orderBy('_id', 'asc')
            .skip((page - 1) * pageSize).limit(pageSize).get(),
          fetchAll(coll.where({}).field({ className: true }), 1000)
        ]);

        const classMap = new Map();
        all.forEach((s) => classMap.set(s.className, (classMap.get(s.className) || 0) + 1));
        const classes = [...classMap.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name, 'zh'));

        return { list: res.data.map(publicStudent), total, page, pageSize, classes, grandTotal: all.length };
      }
    },

    /** 生成并返回导入模板文件（存到云存储，前端下载后打开） */
    'student.template': {
      auth: 'admin',
      async run(data, { cloud }) {
        const fileContent = await buildStudentTemplate();
        const res = await cloud.uploadFile({ cloudPath: 'templates/学生名单模板.xlsx', fileContent });
        return { fileID: res.fileID };
      }
    }
  }
};
