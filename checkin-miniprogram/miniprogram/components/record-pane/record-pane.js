/**
 * 管理端「签到记录」面板：按课程筛选、搜索；点记录修改或删除；补录；导出 Excel。
 *
 * 删除是软删除：记录从列表和导出中消失，但该学生和那台手机仍不能再自助签到这门课，
 * 需要恢复时用「补录」。
 */
const api = require('../../utils/api');
const fmt = require('../../utils/format');
const { toast, openCloudFile } = require('../../utils/ui');

const PAGE_SIZE = 30;

function decorate(r) {
  return {
    ...r,
    timeText: fmt.smart(r.checkedAt),
    distanceText: typeof r.distance === 'number' ? `${Math.round(r.distance * 10) / 10} 米` : ''
  };
}

Component({
  options: { addGlobalClass: true },
  data: {
    courses: [],
    courseId: '',
    keyword: '',
    list: [],
    total: 0,
    page: 1,
    hasMore: false,
    loading: true,
    loadingMore: false,
    refreshing: false,
    error: '',
    today: fmt.ymd(new Date()),
    // 修改
    editSheet: false,
    edit: null,
    confirmDel: false,
    busy: false,
    // 补录
    addSheet: false,
    addCourseIdx: 0,
    addNo: '',
    addRemark: '',
    // 导出
    exportSheet: false,
    exportScope: 'course',
    exportStage: 'choose',
    exportFile: null
  },
  lifetimes: {
    attached() {
      this.loadCourses();
      this.load();
    },
    detached() {
      clearTimeout(this._kw);
    }
  },
  methods: {
    // -------------------------------------------------------- 列表
    async loadCourses() {
      try {
        const { list } = await api.call('course.listPublic');
        this.setData({ courses: list });
      } catch (e) {
        /* 课程筛选加载失败不影响记录列表 */
      }
    },

    async load(more = false) {
      const page = more ? this.data.page + 1 : 1;
      this.setData(more ? { loadingMore: true } : { error: '' });
      try {
        const res = await api.call('record.list', {
          page,
          pageSize: PAGE_SIZE,
          courseId: this.data.courseId || undefined,
          keyword: this.data.keyword.trim()
        });
        const items = res.list.map(decorate);
        this.setData({
          list: more ? this.data.list.concat(items) : items,
          total: res.total,
          page,
          hasMore: page * PAGE_SIZE < res.total,
          loading: false,
          loadingMore: false
        });
        this.triggerEvent('count', { key: 'records', text: `${res.total} 条` });
      } catch (e) {
        this.setData({ loading: false, loadingMore: false, error: e.message });
      }
    },
    loadMore() {
      if (this.data.hasMore && !this.data.loadingMore) this.load(true);
    },
    onRefresh() {
      this.setData({ refreshing: true });
      Promise.all([this.load(), this.loadCourses()]).finally(() => this.setData({ refreshing: false }));
    },
    pickCourse(e) {
      const id = e.currentTarget.dataset.id;
      if (id === this.data.courseId) return;
      this.setData({ courseId: id });
      this.load();
    },
    onKeyword(e) {
      this.setData({ keyword: e.detail.value });
      clearTimeout(this._kw);
      this._kw = setTimeout(() => this.load(), 320);
    },
    clearKeyword() {
      this.setData({ keyword: '' });
      this.load();
    },

    // -------------------------------------------------------- 修改 / 删除
    openEdit(e) {
      const r = this.data.list[e.currentTarget.dataset.i];
      if (!r) return;
      const d = fmt.toDate(r.checkedAt) || new Date();
      this.setData({
        editSheet: true,
        confirmDel: false,
        edit: {
          id: r.id,
          courseName: r.courseName,
          source: r.source,
          distanceText: r.distanceText,
          radius: r.radius,
          deviceTail: r.deviceTail,
          studentNo: r.studentNo,
          name: r.name,
          className: r.className,
          date: fmt.ymd(d),
          time: fmt.hm(d),
          seconds: d.getSeconds(),
          remark: r.remark || ''
        }
      });
    },
    closeEdit() {
      if (!this.data.busy) this.setData({ editSheet: false, confirmDel: false });
    },
    onEditField(e) {
      this.setData({ [`edit.${e.currentTarget.dataset.key}`]: e.detail.value });
    },
    askDel() {
      this.setData({ confirmDel: true });
    },
    cancelDel() {
      this.setData({ confirmDel: false });
    },

    async saveEdit() {
      const ed = this.data.edit;
      if (!ed || this.data.busy) return;
      const [y, m, d] = ed.date.split('-').map(Number);
      const [hh, mm] = ed.time.split(':').map(Number);
      const checkedAt = new Date(y, m - 1, d, hh, mm, ed.seconds || 0).getTime();
      this.setData({ busy: true });
      try {
        await api.call('record.update', {
          id: ed.id,
          studentNo: ed.studentNo.trim(),
          checkedAt,
          remark: ed.remark.trim()
        });
        this.setData({ editSheet: false, busy: false });
        toast('修改已保存', 'success');
        this.load();
      } catch (e) {
        this.setData({ busy: false });
        toast(e.message, 'error');
      }
    },

    async removeRecord() {
      const ed = this.data.edit;
      if (!ed || this.data.busy) return;
      this.setData({ busy: true });
      try {
        await api.call('record.remove', { id: ed.id });
        this.setData({ editSheet: false, confirmDel: false, busy: false });
        toast('记录已删除', 'success');
        this.load();
      } catch (e) {
        this.setData({ busy: false });
        toast(e.message, 'error');
      }
    },

    // -------------------------------------------------------- 补录
    openAdd() {
      if (!this.data.courses.length) {
        toast('请先创建课程');
        return;
      }
      const idx = Math.max(0, this.data.courses.findIndex((c) => c.id === this.data.courseId));
      this.setData({ addSheet: true, addCourseIdx: idx, addNo: '', addRemark: '' });
    },
    closeAdd() {
      if (!this.data.busy) this.setData({ addSheet: false });
    },
    onAddCourse(e) {
      this.setData({ addCourseIdx: Number(e.detail.value) });
    },
    onAddField(e) {
      this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
    },
    async submitAdd() {
      const course = this.data.courses[this.data.addCourseIdx];
      const studentNo = this.data.addNo.trim();
      if (!studentNo) {
        toast('请填写学号');
        return;
      }
      if (!course || this.data.busy) return;
      this.setData({ busy: true });
      try {
        const { record } = await api.call('record.add', {
          courseId: course.id,
          studentNo,
          remark: this.data.addRemark.trim()
        });
        this.setData({ addSheet: false, busy: false });
        toast(`已为 ${record.name} 补录`, 'success');
        this.load();
      } catch (e) {
        this.setData({ busy: false });
        toast(e.message, 'error');
      }
    },

    // -------------------------------------------------------- 导出
    openExport() {
      this.setData({
        exportSheet: true,
        exportStage: 'choose',
        exportFile: null,
        exportScope: this.data.courseId ? 'course' : 'all'
      });
    },
    closeExport() {
      if (this.data.exportStage !== 'making') this.setData({ exportSheet: false });
    },
    pickScope(e) {
      const scope = e.currentTarget.dataset.scope;
      if (scope === 'course' && !this.data.courseId) {
        toast('先在上方选一门课程');
        return;
      }
      this.setData({ exportScope: scope });
    },
    async makeExport() {
      this.setData({ exportStage: 'making' });
      try {
        const res = await api.call('record.export', {
          courseId: this.data.exportScope === 'course' ? this.data.courseId : undefined
        });
        this.setData({ exportStage: 'done', exportFile: res });
      } catch (e) {
        this.setData({ exportStage: 'choose' });
        toast(e.message, 'error');
      }
    },
    async openExportFile() {
      const f = this.data.exportFile;
      if (!f) return;
      try {
        await openCloudFile(f.fileID, f.fileName);
      } catch (e) {
        toast('文件打开失败，请重试', 'error');
      }
    }
  }
});
