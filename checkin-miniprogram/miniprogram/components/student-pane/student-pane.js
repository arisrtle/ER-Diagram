/**
 * 管理端「学生」面板：按班级分组的名单、搜索、班级筛选、Excel 批量导入。
 *
 * 导入流程：选择聊天里的 Excel 文件 → 上传到云存储 → 云函数 student.import 解析
 * （识别「班级」「姓名」「学号」三列，列顺序不限）→ 显示新增 / 更新 / 跳过结果。
 */
const api = require('../../utils/api');
const { toast, openCloudFile } = require('../../utils/ui');

const PAGE_SIZE = 50;

Component({
  options: { addGlobalClass: true },
  data: {
    rows: [],
    total: 0,
    grandTotal: 0,
    classes: [],
    className: '',
    keyword: '',
    page: 1,
    hasMore: false,
    loading: true,
    loadingMore: false,
    error: '',
    refreshing: false,
    importing: false,
    result: null,
    resultSheet: false,
    templating: false
  },
  lifetimes: {
    attached() {
      this.load();
    },
    detached() {
      clearTimeout(this._kw);
    }
  },
  methods: {
    /** 列表数据：在班级变化处插入分组标题 */
    build(list, prev = []) {
      const rows = prev.slice();
      let last = prev.length ? prev[prev.length - 1].className : null;
      list.forEach((s) => {
        rows.push({ ...s, head: s.className !== last, initial: String(s.name).slice(0, 1) });
        last = s.className;
      });
      return rows;
    },

    async load(more = false) {
      const page = more ? this.data.page + 1 : 1;
      this.setData(more ? { loadingMore: true } : { error: '' });
      try {
        const res = await api.call('student.list', {
          page,
          pageSize: PAGE_SIZE,
          keyword: this.data.keyword.trim(),
          className: this.data.className
        });
        const counts = {};
        res.classes.forEach((c) => (counts[c.name] = c.count));
        const rows = this.build(
          res.list.map((s) => ({ ...s, classCount: counts[s.className] || 0 })),
          more ? this.data.rows : []
        );
        this.setData({
          rows,
          total: res.total,
          grandTotal: res.grandTotal,
          classes: res.classes,
          page,
          hasMore: page * PAGE_SIZE < res.total,
          loading: false,
          loadingMore: false
        });
        this.triggerEvent('count', { key: 'students', text: `${res.grandTotal} 人` });
      } catch (e) {
        this.setData({ loading: false, loadingMore: false, error: e.message });
      }
    },

    loadMore() {
      if (this.data.hasMore && !this.data.loadingMore) this.load(true);
    },
    onRefresh() {
      this.setData({ refreshing: true });
      this.load().finally(() => this.setData({ refreshing: false }));
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
    pickClass(e) {
      const name = e.currentTarget.dataset.name;
      if (name === this.data.className) return;
      this.setData({ className: name });
      this.load();
    },

    // ---------------------------------------------------------- 导入
    chooseFile() {
      if (this.data.importing) return;
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['xlsx', 'csv'],
        success: (res) => {
          const f = res.tempFiles[0];
          if (f) this.importFile(f);
        },
        fail: (e) => {
          if (!/cancel/i.test(e.errMsg || '')) toast('没能打开文件，请从微信聊天里选择 Excel', 'error');
        }
      });
    },

    async importFile(file) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!['xlsx', 'csv'].includes(ext)) {
        toast('只支持 .xlsx 或 .csv 文件', 'error');
        return;
      }
      this.setData({ importing: true, result: null, resultSheet: true });
      try {
        const up = await wx.cloud.uploadFile({
          cloudPath: `imports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
          filePath: file.path
        });
        const result = await api.call('student.import', { fileID: up.fileID });
        this.setData({ result: { ...result, fileName: file.name }, importing: false });
        this.load();
      } catch (e) {
        const problems = (e.extra && e.extra.problems) || [];
        this.setData({ importing: false, result: { error: e.message, problems, fileName: file.name } });
      }
    },

    closeResult() {
      if (!this.data.importing) this.setData({ resultSheet: false });
    },

    async downloadTemplate() {
      if (this.data.templating) return;
      this.setData({ templating: true });
      try {
        const { fileID } = await api.call('student.template');
        await openCloudFile(fileID, '学生名单模板.xlsx');
      } catch (e) {
        toast(e.message || '模板下载失败', 'error');
      } finally {
        this.setData({ templating: false });
      }
    }
  }
});
