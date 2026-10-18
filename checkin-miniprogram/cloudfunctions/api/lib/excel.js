/**
 * Excel 读写：学生名单导入、签到记录导出。
 */
const ExcelJS = require('exceljs');

/** 表头别名：只要表头里出现其中之一即可识别，列的顺序随意 */
const HEADER_ALIASES = {
  className: ['班级', '行政班', '班级名称', 'class', 'classname'],
  name: ['姓名', '名字', '学生姓名', 'name'],
  studentNo: ['学号', '学生编号', '学籍号', 'studentno', 'student no', 'id']
};

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '').toLowerCase();

/** 单元格取纯文本（兼容富文本、公式、超链接、数字学号） */
function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join('');
    if (value.text != null) return String(value.text);
    if (value.result != null) return cellText(value.result);
  }
  return String(value);
}

/** 在前 10 行里找表头行，返回 { rowIndex, map: {field: colIndex} } */
function locateHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const map = {};
    (rows[r] || []).forEach((cell, c) => {
      const t = norm(cellText(cell));
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        if (map[field] === undefined && aliases.some((a) => norm(a) === t)) map[field] = c;
      }
    });
    if (map.className !== undefined && map.name !== undefined && map.studentNo !== undefined) {
      return { rowIndex: r, map };
    }
  }
  return null;
}

/** 读取 xlsx 第一张工作表为二维数组（下标从 0 开始） */
async function readXlsxRows(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    rows[rowNumber - 1] = values;
  });
  return rows.map((r) => r || []);
}

/** 极简 CSV 解析（支持引号与引号内逗号），供不会存 xlsx 的老师使用 */
function readCsvRows(buffer) {
  let text = buffer.toString('utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * 解析学生名单。
 * @returns {{ students: Array<{className,name,studentNo,row}>, problems: Array<{row, reason}> }}
 */
async function parseStudentSheet(buffer, ext) {
  const rows = ext === 'csv' ? readCsvRows(buffer) : await readXlsxRows(buffer);
  const header = locateHeader(rows);
  if (!header) {
    return { students: [], problems: [], headerMissing: true };
  }
  const { rowIndex, map } = header;
  const students = [];
  const problems = [];
  const seen = new Map();

  for (let r = rowIndex + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const className = cellText(row[map.className]).trim();
    const name = cellText(row[map.name]).trim();
    const studentNo = cellText(row[map.studentNo]).trim();
    const excelRow = r + 1; // 给用户看的行号从 1 开始
    if (!className && !name && !studentNo) continue; // 空行
    if (!studentNo || !name || !className) {
      problems.push({ row: excelRow, reason: '班级、姓名、学号有空缺' });
      continue;
    }
    if (!/^[A-Za-z0-9-]{3,32}$/.test(studentNo)) {
      problems.push({ row: excelRow, reason: `学号「${studentNo}」格式不对` });
      continue;
    }
    if (name.length > 20 || className.length > 40) {
      problems.push({ row: excelRow, reason: '姓名或班级过长' });
      continue;
    }
    if (seen.has(studentNo)) {
      problems.push({ row: excelRow, reason: `学号与第 ${seen.get(studentNo)} 行重复` });
      continue;
    }
    seen.set(studentNo, excelRow);
    students.push({ className, name, studentNo, row: excelRow });
  }
  return { students, problems };
}

/** 北京时间格式化 yyyy-MM-dd HH:mm:ss（云函数运行在 UTC） */
function formatCST(date) {
  const d = new Date(new Date(date).getTime() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/**
 * 生成签到记录工作簿。
 * @param {Array} records 签到记录
 * @param {Map<string,string>} courseNames courseId -> 课程名
 * @returns {Promise<Buffer>}
 */
async function buildRecordsWorkbook(records, courseNames) {
  const wb = new ExcelJS.Workbook();
  wb.creator = '到 · 定位签到';
  wb.created = new Date();
  const ws = wb.addWorksheet('签到记录', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: '序号', key: 'idx', width: 7 },
    { header: '课程', key: 'course', width: 24 },
    { header: '班级', key: 'className', width: 18 },
    { header: '学号', key: 'studentNo', width: 16 },
    { header: '姓名', key: 'name', width: 12 },
    { header: '签到时间', key: 'time', width: 21 },
    { header: '距点位（米）', key: 'distance', width: 13 },
    { header: '来源', key: 'source', width: 10 },
    { header: '设备 ID', key: 'device', width: 14 },
    { header: '备注', key: 'remark', width: 24 }
  ];

  records.forEach((r, i) => {
    ws.addRow({
      idx: i + 1,
      course: courseNames.get(r.courseId) || '（课程已删除）',
      className: r.className,
      studentNo: r.studentNo,
      name: r.name,
      time: formatCST(r.checkedAt),
      distance: typeof r.distance === 'number' ? r.distance : '',
      source: r.source === 'admin' ? '管理员补录' : '学生签到',
      device: r.deviceId ? String(r.deviceId).slice(0, 8) : '',
      remark: r.remark || ''
    });
  });

  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F7D6D' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.getColumn('studentNo').numFmt = '@';
  ws.autoFilter = { from: 'A1', to: 'J1' };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** 生成学生名单模板（README 里引用，也可由管理端下载） */
async function buildStudentTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('学生名单');
  ws.columns = [
    { header: '班级', key: 'className', width: 18 },
    { header: '姓名', key: 'name', width: 12 },
    { header: '学号', key: 'studentNo', width: 16 }
  ];
  ws.getColumn('studentNo').numFmt = '@';
  ws.addRow({ className: '计科 2301', name: '林知夏', studentNo: '2023010101' });
  ws.addRow({ className: '计科 2301', name: '周以安', studentNo: '2023010102' });
  ws.getRow(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = {
  parseStudentSheet,
  buildRecordsWorkbook,
  buildStudentTemplate,
  formatCST,
  readCsvRows,
  locateHeader
};
