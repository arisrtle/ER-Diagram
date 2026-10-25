# 数据库设计 · 课程签到（v2）

> 数据库：uniCloud 云数据库（阿里云版，MongoDB 兼容文档型）
> 集合数：**3 个** —— `users`、`courses`、`sign_records`
> 访问方式：客户端**不直连**数据库，全部通过云函数 `api`；三个集合的权限均为「所有用户不可读写」

---

## 1. 集合总览

| 集合 | 中文名 | 作用 | 关键约束 |
|---|---|---|---|
| `users` | 用户表 | 学生 / 教师 / 管理员统一身份 | `account` 唯一索引 |
| `courses` | 课程表 | 课程、上课时间、签到点位、距离阈值 | `teacherId` 逻辑外键 |
| `sign_records` | 签到记录表 | 谁、在哪节课、什么时候、离点位多远 | **复合唯一索引** `userId + courseId + sessionDate` |

---

## 2. `users` · 用户表

| 字段 | 类型 | 必填 | 默认 | 说明 | 示例 |
|---|---|---|---|---|---|
| `_id` | string | 自动 | — | 主键，系统生成 | `"65f1a..."` |
| `account` | string | ✅ | — | 学号 / 工号，4~20 位字母数字，**唯一** | `"20230101001"` |
| `password` | string | ✅ | — | PBKDF2-SHA256 哈希，格式 `salt:hash`，不存明文 | `"a1b2c3d4:9f8e..."` |
| `name` | string | ✅ | — | 姓名，1~20 字 | `"李小明"` |
| `role` | string | ✅ | — | `student` / `teacher` / `admin` | `"student"` |
| `className` | string | | `""` | 学生存班级，教师存院系 | `"电气工程及其自动化 2301 班"` |
| `title` | string | | `""` | 职称，仅教师使用 | `"教授"` |
| `phone` | string | | `""` | 预留：短信验证码增强 | `""` |
| `email` | string | | `""` | 预留：邮箱验证码增强 | `""` |
| `status` | int | | `1` | `1` 正常 / `0` 停用 | `1` |
| `createTime` | timestamp | | — | 创建时间 | `2026-10-24 10:00:00` |

**为什么没有 `openid`、没有 `password` 以外的凭证字段**

- 不绑定微信：学生用学号 + 密码登录，换手机也能用。
- 不存明文密码：`hashPassword()` 生成 8 字节随机盐 + 10 万次 PBKDF2 迭代。
- 角色即身份：教师和管理员都是这一张表里的行，不另建表。

**示例**

```json
{
  "_id": "u_1001",
  "account": "20230101001",
  "password": "3f2a9c1b:7d4e8a0f5c2b9e16...",
  "name": "李小明",
  "role": "student",
  "className": "电气工程及其自动化 2301 班",
  "title": "",
  "status": 1,
  "createTime": "2026-10-24T02:00:00.000Z"
}
```

---

## 3. `courses` · 课程表

| 字段 | 类型 | 必填 | 默认 | 说明 | 示例 |
|---|---|---|---|---|---|
| `_id` | string | 自动 | — | 主键 | `"c_2001"` |
| `name` | string | ✅ | — | 课程名称，1~30 字 | `"自动控制原理"` |
| `teacherId` | string | ✅ | — | 授课教师 `_id`，逻辑外键 → `users._id` | `"u_1001"` |
| `teacherName` | string | | `""` | 教师姓名冗余，避免列表回查 | `"张伟"` |
| `weekday` | int | ✅ | — | 上课星期，`1`=周一 … `7`=周日 | `3` |
| `startTime` | string | ✅ | — | 上课时间 `HH:mm` | `"08:00"` |
| `endTime` | string | ✅ | — | 下课时间 `HH:mm`，必须晚于 `startTime` | `"09:40"` |
| `locationName` | string | | `""` | 签到点位名称 | `"教二楼 301"` |
| `latitude` | double | ✅ | — | 点位纬度，**标量** | `34.24695` |
| `longitude` | double | ✅ | — | 点位经度，**标量** | `108.98362` |
| `radius` | int | | `50` | 距离阈值（米），10~1000 | `50` |
| `status` | int | | `1` | `1` 启用 / `0` 停用 | `1` |
| `createTime` | timestamp | | — | 创建时间 | — |
| `updateTime` | timestamp | | — | 最后修改时间 | — |

**三条结构性约束**

1. **不支持多点位**：`latitude` / `longitude` 是标量字段，没有点位数组，也没有点位子表 —— 想存第二个点都无处可放。
2. **一门课一位教师**：`teacherId` 是单值。若将来要多教师，需要加中间表，那就不再是「三张表」。
3. **周课表模型**：`weekday + startTime + endTime` 表达「每周三 08:00 的课」，不建课次表。

**示例**

```json
{
  "_id": "c_2001",
  "name": "自动控制原理",
  "teacherId": "u_1001",
  "teacherName": "张伟",
  "weekday": 3,
  "startTime": "08:00",
  "endTime": "09:40",
  "locationName": "教二楼 301",
  "latitude": 34.24695,
  "longitude": 108.98362,
  "radius": 50,
  "status": 1
}
```

---

## 4. `sign_records` · 签到记录表

| 字段 | 类型 | 必填 | 默认 | 说明 | 示例 |
|---|---|---|---|---|---|
| `_id` | string | 自动 | — | 主键 | `"r_3001"` |
| `userId` | string | ✅ | — | 签到人，逻辑外键 → `users._id` | `"u_1001"` |
| `courseId` | string | ✅ | — | 课程，逻辑外键 → `courses._id` | `"c_2001"` |
| `userName` | string | | — | 冗余：姓名 | `"李小明"` |
| `account` | string | | — | 冗余：学号 | `"20230101001"` |
| `className` | string | | — | 冗余：班级 | `"电气工程及其自动化 2301 班"` |
| `courseName` | string | | — | 冗余：课程名（课程删除后仍可读） | `"自动控制原理"` |
| `teacherName` | string | | — | 冗余：教师名 | `"张伟"` |
| `sessionDate` | string | ✅ | — | **课次日期** `YYYY-MM-DD`（北京时间） | `"2026-10-21"` |
| `signTime` | timestamp | ✅ | — | 签到时间（服务端时间） | `2026-10-21T00:05:12.000Z` |
| `result` | string | ✅ | `success` | 签到结果，本轮固定 `success`，预留扩展 | `"success"` |
| `distance` | double | | — | 云端 Haversine 计算的距离（米） | `23.4` |
| `latitude` | double | ✅ | — | 上报纬度 | `34.24698` |
| `longitude` | double | ✅ | — | 上报经度 | `108.9837` |
| `accuracy` | double | | `0` | 定位精度（米），仅参考 | `15` |
| `deviceId` | string | | `""` | 设备标识，**仅审计**，不参与判定 | `"dev-m1x2..."` |
| `createTime` | timestamp | | — | 写入时间 | — |

**为什么记录里没有 `status`（正常/迟到/缺勤）**

本轮不区分迟到与缺勤，签到成功就是 `success`。字段保留是为了后续能扩展，而不是现在就引入状态机。

**示例**

```json
{
  "_id": "r_3001",
  "userId": "u_1001",
  "courseId": "c_2001",
  "userName": "李小明",
  "account": "20230101001",
  "className": "电气工程及其自动化 2301 班",
  "courseName": "自动控制原理",
  "teacherName": "张伟",
  "sessionDate": "2026-10-21",
  "signTime": "2026-10-21T00:05:12.000Z",
  "result": "success",
  "distance": 23.4,
  "latitude": 34.24698,
  "longitude": 108.9837,
  "accuracy": 15,
  "deviceId": "dev-m1x2y3"
}
```

---

## 5. 索引清单（**部署必做**）

uniCloud 服务端 SDK 不支持建索引，必须在 **uniCloud Web 控制台 → 云数据库 → 选中表 → 索引管理** 手工创建。

| # | 集合 | 索引名 | 字段 | 类型 | 作用 | 是否必须 |
|---|---|---|---|---|---|---|
| 1 | `users` | `uk_account` | `account` ↑ | **唯一** | 学号/工号不重复，登录查询 | ✅ 必须 |
| 2 | `sign_records` | `uk_user_course_session` | `userId` ↑, `courseId` ↑, `sessionDate` ↑ | **唯一** | **「一人一课一节一次」的唯一实现载体** | ✅ **必须** |
| 3 | `sign_records` | `idx_course_time` | `courseId` ↑, `signTime` ↓ | 普通 | 记录列表按课程筛选 + 时间排序 | 建议 |
| 4 | `sign_records` | `idx_session_date` | `sessionDate` ↓ | 普通 | 按日期筛选与导出 | 建议 |
| 5 | `courses` | `idx_teacher` | `teacherId` ↑ | 普通 | 教师端只看自己的课 | 建议 |
| 6 | `courses` | `idx_weekday` | `weekday` ↑ | 普通 | 查「今天有哪些课」 | 建议 |

> ⚠️ **第 2 条是业务功能的一部分，不是性能优化。**
> 缺少它时，功能表面正常，但并发请求下会写入两条重复记录，「无例外」被破坏。
> 建索引时务必勾选「唯一」。

---

## 6. 权限配置

三个集合全部设为「所有用户不可读写」（自定义安全规则）：

```json
{ "read": false, "write": false }
```

在 `uniCloud-aliyun/database/*.schema.json` 中对应：

```json
"permission": { "read": false, "create": false, "update": false, "delete": false }
```

**为什么要关掉客户端直连**

云开发默认是「仅创建者可读写」，而本系统需要：

- 管理员读取**所有人**的记录 —— 默认规则做不到；
- 学生**不绑定微信 openid** —— 默认规则无从判断「这条记录是谁的」。

因此客户端一律不碰数据库，只调云函数。云函数内用 `uniCloud.database()` 拥有完整权限，
并在入口校验 HMAC 令牌与角色。这样即使有人反编译前端，也拿不到数据库句柄。

**验证方式**：在浏览器控制台执行

```js
uniCloud.database().collection('sign_records').get()
```

应返回权限错误；若能读到数据，说明权限没设对。

---

## 7. 字段 ↔ 需求对照

| 需求 / 约束 | 落点 | 强制层级 |
|---|---|---|
| 学生 / 教师 / 管理员三种身份 | `users.role` 枚举 | 数据结构 |
| 教师不单独建表 | 教师是 `users` 中 `role='teacher'` 的行 | 数据结构 |
| 登录 / 注册 | `users.account` + `password`，`account` 唯一索引 | 数据库索引 |
| 一人一课一节只能签一次 | `sign_records` 唯一索引 `userId+courseId+sessionDate` | **数据库索引（并发安全）** |
| 超出阈值禁止签到 | 云函数 Haversine 计算，客户端只上报坐标 | 云函数 |
| 签到有时间窗 | `courses.startTime/endTime` + 云函数时间窗判定 | 云函数 |
| 一门课只有一个点位 | `latitude` / `longitude` 为标量字段 | **数据结构** |
| 记录签到时间与结果 | `sign_records.signTime` / `result` | 数据结构 |
| 记录关联用户与课程 | `sign_records.userId` / `courseId` 双外键 | 数据结构 |
| 学生不绑定微信 | `users` 与 `sign_records` 均无 `openid` 字段 | 数据结构 |
| 设备仅作审计 | `sign_records.deviceId`，不参与任何查询条件 | 数据结构 |

---

## 8. 初始化数据

云函数 `api` 的 `init` action 会写入一套演示数据（仅在 `users` 为空时执行）：

| 角色 | 账号 | 密码 | 说明 |
|---|---|---|---|
| 管理员 | `admin` | `123456` | 王敏 · 教务 |
| 教师 | `T1001` | `123456` | 张伟 · 教授 |
| 教师 | `T1002` / `T1003` / `T1004` | `123456` | 李静 / 王建国 / 刘芳 |
| 学生 | `20230101001` ~ `20230101008` | `123456` | 电气工程及其自动化 2301 班 |
| 学生 | `20230102001` ~ `20230102004` | `123456` | 自动化 2302 班 |

课程 7 门。其中「自动控制原理」的上下课时间**按初始化时刻动态生成**，
保证第一次打开就能看到一节「距开课 10 分钟」或「正在上课」的课，签到按钮是亮的。
