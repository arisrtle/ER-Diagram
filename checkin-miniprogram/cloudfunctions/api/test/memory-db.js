/**
 * 测试用内存数据库：模拟本项目用到的云数据库 API 子集
 * （collection/doc/where/orderBy/skip/limit/field/get/count/add/set/update/remove、command.in、RegExp）。
 * 行为对齐云开发：doc().get() 文档不存在时抛错；add 重复 _id 抛 duplicate 错误。
 */
let autoId = 0;

class InCond { constructor(values) { this.values = values; } }
class RegCond { constructor(regexp, options) { this.re = new RegExp(regexp, options || ''); } }

function matches(doc, where) {
  return Object.entries(where).every(([k, cond]) => {
    const val = doc[k];
    if (cond instanceof InCond) return cond.values.includes(val);
    if (cond instanceof RegCond) return typeof val === 'string' && cond.re.test(val);
    return val === cond;
  });
}

const clone = (o) => (o === undefined ? o : JSON.parse(JSON.stringify(o), (k, v) =>
  typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) ? new Date(v) : v));

class Query {
  constructor(store, name, where = {}, order = [], skipN = 0, limitN = 100) {
    Object.assign(this, { store, name, _where: where, _order: order, _skip: skipN, _limit: limitN });
  }
  _rows() { return this.store[this.name] || (this.store[this.name] = new Map()); }
  _next(patch) { return new Query(this.store, this.name, patch.where ?? this._where, patch.order ?? this._order, patch.skip ?? this._skip, patch.limit ?? this._limit); }
  where(w) { return this._next({ where: w }); }
  orderBy(f, dir) { return this._next({ order: [...this._order, [f, dir]] }); }
  skip(n) { return this._next({ skip: n }); }
  limit(n) { return this._next({ limit: n }); }
  field() { return this; }
  _filtered() {
    const list = [...this._rows().values()].filter((d) => matches(d, this._where));
    list.sort((a, b) => {
      for (const [f, dir] of this._order) {
        const av = a[f] instanceof Date ? a[f].getTime() : a[f];
        const bv = b[f] instanceof Date ? b[f].getTime() : b[f];
        if (av < bv) return dir === 'desc' ? 1 : -1;
        if (av > bv) return dir === 'desc' ? -1 : 1;
      }
      return 0;
    });
    return list;
  }
  async get() { return { data: this._filtered().slice(this._skip, this._skip + this._limit).map(clone) }; }
  async count() { return { total: this._filtered().length }; }
  async remove() {
    const list = this._filtered();
    list.forEach((d) => this._rows().delete(d._id));
    return { stats: { removed: list.length } };
  }
  doc(id) { return new DocRef(this, id); }
  async add({ data }) {
    const id = data._id || `auto${++autoId}`;
    if (this._rows().has(id)) {
      const e = new Error('E11000 duplicate key error'); e.errCode = -502001; throw e;
    }
    this._rows().set(id, clone({ ...data, _id: id }));
    return { _id: id };
  }
}

class DocRef {
  constructor(q, id) { this.q = q; this.id = id; }
  async get() {
    const d = this.q._rows().get(this.id);
    if (!d) { const e = new Error(`document.get:fail document with _id ${this.id} does not exist`); throw e; }
    return { data: clone(d) };
  }
  async set({ data }) { this.q._rows().set(this.id, clone({ ...data, _id: this.id })); return {}; }
  async update({ data }) {
    const d = this.q._rows().get(this.id);
    if (!d) return { stats: { updated: 0 } };
    this.q._rows().set(this.id, clone({ ...d, ...data }));
    return { stats: { updated: 1 } };
  }
  async remove() { this.q._rows().delete(this.id); return { stats: { removed: 1 } }; }
}

function createMemoryDb() {
  const store = {};
  return {
    store,
    command: { in: (values) => new InCond(values) },
    RegExp: ({ regexp, options }) => new RegCond(regexp, options),
    collection: (name) => new Query(store, name)
  };
}

/** 模拟 cloud 对象里本项目用到的文件 API */
function createMemoryCloud() {
  const files = new Map();
  return {
    files,
    async uploadFile({ cloudPath, fileContent }) {
      const fileID = `cloud://test/${cloudPath}`;
      files.set(fileID, fileContent);
      return { fileID };
    },
    async downloadFile({ fileID }) {
      if (!files.has(fileID)) throw new Error('file not found');
      return { fileContent: files.get(fileID) };
    },
    async deleteFile({ fileList }) { fileList.forEach((f) => files.delete(f)); return {}; }
  };
}

module.exports = { createMemoryDb, createMemoryCloud };
