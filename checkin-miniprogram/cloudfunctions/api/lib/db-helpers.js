/**
 * 对云数据库 API 的薄封装，统一处理「文档不存在」「主键冲突」两类常见情况，
 * 也让业务代码可以在单元测试里换成内存数据库。
 */

/** 按 _id 取文档；不存在时返回 null（云开发原生 API 会直接抛错） */
async function getById(db, collection, id) {
  try {
    const res = await db.collection(collection).doc(id).get();
    return res.data || null;
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

function isNotFound(e) {
  const msg = String((e && (e.errMsg || e.message)) || '');
  return /does not exist|not exist|cannot find document|-502004/i.test(msg) || (e && e.errCode === -502004);
}

/** 是否为唯一键冲突（同 _id 或唯一索引重复） */
function isDuplicate(e) {
  const msg = String((e && (e.errMsg || e.message)) || '');
  return /duplicate|E11000|-502001/i.test(msg) || (e && e.errCode === -502001);
}

/**
 * 分批取出满足条件的全部文档（服务端单次最多 1000 条）。
 * @param {object} query 已经 where/orderBy 过的查询对象
 */
async function fetchAll(query, batch = 500, hardLimit = 20000) {
  const out = [];
  for (let skip = 0; skip < hardLimit; skip += batch) {
    const res = await query.skip(skip).limit(batch).get();
    out.push(...res.data);
    if (res.data.length < batch) break;
  }
  return out;
}

/** 以有限并发执行一组异步任务 */
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

module.exports = { getById, isNotFound, isDuplicate, fetchAll, pool };
