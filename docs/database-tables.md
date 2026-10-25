# 数据库表结构（6 表版）

## 说明

本版把表收敛为 6 张，既保留“多教学班、多老师、多时段、不同教室”的细致建模，又去掉重复的签到规则和不再需要的表：

| 角色 | 表 | 说明 |
|---|---|---|
| 主数据表 | `users` | 学生 / 教师 / 管理员统一身份 |
| 主数据表 | `courses` | 课程目录 |
| 业务实体表 | `course_sections` | 教学班，一个班暂定一个老师 |
| 业务事件表 | `class_sessions` | 一次具体上课，同时保存该次签到规则 |
| 中间表 | `student_section_assignments` | 学生与教学班的多对多关系 |
| 业务流水表 | `checkins` | 签到记录 |

数据库设计采用 **MySQL 8.0 SQL 类型**表示。实际使用微信云开发时，可将这些表映射为云数据库集合；使用 uni-app + 自建后端时，可直接使用 MySQL。

### 设计原则

1. **统一用户表**：学生、教师、管理员共用 `users`，用 `role` 区分；教师不单独建表。
2. **课程 → 教学班 → 一次课**：`courses` 只保存课程目录；`course_sections` 保存教学班和老师；`class_sessions` 保存某天某节的上课安排。
3. **一次课 = 上课安排 + 签到规则**：不再单独建 `attendance_sessions`，因为一次课只对应一次签到，两者是 1:1。
4. **签到点按次设置**：管理员/教师在每次课的 `class_sessions` 上设置经纬度和距离阈值，不在 `courses` 上存签到点。
5. **手动开关**：教师手动把 `checkin_status` 改成 `open` 或 `closed`，不做自动起止时间。
6. **一次课只能签一次**：`UNIQUE(session_id, student_id)`。
7. **不做多学期、不做备用班授权、不做设备唯一**。

### 键类型

- `PK`：主键（Primary Key）
- `FK`：外键（Foreign Key）
- `UK`：唯一键（Unique Key）
- `UK(C)`：联合唯一约束中的字段

## 1. `users`：用户表（学生/教师/管理员）

| 字段 | SQL 类型 | 长度/范围 | 键类型 | 必填 | 默认值 | 说明 |
|---|---|---|---:|---|---|
| `id` | BIGINT UNSIGNED | 最大约 20 位 | PK | 是 | 自增 | 用户 ID |
| `role` | VARCHAR(20) | 20 字符 | — | 是 | `student` | `student` / `teacher` / `admin` |
| `openid` | VARCHAR(64) | 64 字符 | UK | 否 | NULL | 微信 openid；微信端登录使用 |
| `student_no` | VARCHAR(10) | 10 位数字 | UK | 否 | NULL | 学号，10 位数字；`role=student` 时必填 |
| `name` | VARCHAR(50) | 50 字符 | — | 是 | — | 姓名 |
| `class_name` | VARCHAR(100) | 100 字符 | — | 否 | NULL | 行政班级；学生使用 |
| `phone` | VARCHAR(20) | 20 字符 | UK | 否 | NULL | 手机号；可选登录/校验 |
| `email` | VARCHAR(100) | 100 字符 | UK | 否 | NULL | 邮箱；可选登录/校验 |
| `password_hash` | VARCHAR(255) | 255 字符 | — | 否 | NULL | 密码哈希；教师/管理员 Web 登录使用 |
| `status` | VARCHAR(20) | 20 字符 | — | 是 | `active` | `active` 或 `disabled` |
| `created_at` | DATETIME | — | — | 是 | 当前时间 | 创建时间 |
| `updated_at` | DATETIME | — | — | 是 | 自动更新 | 修改时间 |

**说明**

- 学生可以用“学号 + 姓名”登录，不需要密码；`password_hash` 主要给教师/管理员 Web 端使用。
- `openid`、`student_no`、`phone`、`email` 都是可空唯一键。MySQL 唯一索引允许多个 NULL，因此教师/管理员可以没有学号，学生也可以暂时没有手机号或邮箱。
- `role=student` 时数据库 CHECK 会强制 `student_no` 非空。

## 2. `courses`：课程表

| 字段 | SQL 类型 | 长度/范围 | 键类型 | 必填 | 默认值 | 说明 |
|---|---|---|---:|---|---|
| `id` | BIGINT UNSIGNED | 最大约 20 位 | PK | 是 | 自增 | 课程 ID |
| `course_code` | VARCHAR(30) | 30 字符 | UK | 是 | — | 课程编号 |
| `course_name` | VARCHAR(100) | 100 字符 | — | 是 | — | 课程名称 |
| `status` | VARCHAR(20) | 20 字符 | — | 是 | `active` | `active` 或 `disabled` |
| `created_at` | DATETIME | — | — | 是 | 当前时间 | 创建时间 |
| `updated_at` | DATETIME | — | — | 是 | 自动更新 | 修改时间 |

**说明**

- 课程表只保存课程目录，不保存老师、签到点、学期。
- 一个课程可以有多个教学班，教学班在 `course_sections` 中维护。

## 3. `course_sections`：教学班表

| 字段 | SQL 类型 | 长度/范围 | 键类型 | 必填 | 默认值 | 说明 |
|---|---|---|---:|---|---|
| `id` | BIGINT UNSIGNED | 最大约 20 位 | PK | 是 | 自增 | 教学班 ID |
| `course_id` | BIGINT UNSIGNED | 最大约 20 位 | FK、UK(C) | 是 | — | 所属课程；与 `section_code` 联合唯一 |
| `section_code` | VARCHAR(30) | 30 字符 | UK(C) | 是 | — | 教学班编号 |
| `section_name` | VARCHAR(100) | 100 字符 | — | 是 | — | 教学班名称 |
| `teacher_id` | BIGINT UNSIGNED | 最大约 20 位 | FK | 否 | NULL | 任课教师；引用 `users(id)`，应为 `role=teacher` |
| `status` | VARCHAR(20) | 20 字符 | — | 是 | `active` | `active` 或 `disabled` |
| `created_by` | BIGINT UNSIGNED | 最大约 20 位 | FK | 是 | — | 创建人；引用 `users(id)` |
| `created_at` | DATETIME | — | — | 是 | 当前时间 | 创建时间 |
| `updated_at` | DATETIME | — | — | 是 | 自动更新 | 修改时间 |

**说明**

- 一门课程可以有多个教学班，例如 1 班、2 班、3 班。
- 当前一个教学班只设置一个老师；如果以后要“多个老师共同授课”，再加 `section_teachers` 中间表。
- `teacher_id` 允许为空，表示教学班尚未分配老师。

## 4. `class_sessions`：一次课表

| 字段 | SQL 类型 | 长度/范围 | 键类型 | 必填 | 默认值 | 说明 |
|---|---|---|---:|---|---|
| `id` | BIGINT UNSIGNED | 最大约 20 位 | PK | 是 | 自增 | 一次课 ID |
| `section_id` | BIGINT UNSIGNED | 最大约 20 位 | FK、UK(C) | 是 | — | 所属教学班；与日期、节次联合唯一 |
| `class_date` | DATE | YYYY-MM-DD | UK(C) | 是 | — | 上课日期 |
| `period_start` | TINYINT UNSIGNED | 大于 0 | UK(C) | 是 | — | 开始节次 |
| `period_end` | TINYINT UNSIGNED | 不小于开始节次 | UK(C) | 是 | — | 结束节次 |
| `start_time` | TIME | HH:MM:SS | — | 否 | NULL | 上课开始时刻；用于倒计时和排序 |
| `end_time` | TIME | HH:MM:SS | — | 否 | NULL | 下课时刻 |
| `classroom` | VARCHAR(50) | 50 字符 | — | 否 | NULL | 教室 |
| `latitude` | DECIMAL(10,7) | -90 至 90 | — | 否 | NULL | 本次签到点纬度，GCJ-02 |
| `longitude` | DECIMAL(10,7) | -180 至 180 | — | 否 | NULL | 本次签到点经度，GCJ-02 |
| `distance_limit` | DECIMAL(10,2) | 大于 0 | — | 是 | 50.00 | 本次距离阈值，单位米 |
| `class_status` | VARCHAR(20) | 20 字符 | — | 是 | `scheduled` | `scheduled` 或 `canceled` |
| `checkin_status` | VARCHAR(20) | 20 字符 | — | 是 | `draft` | `draft` / `open` / `closed` |
| `created_by` | BIGINT UNSIGNED | 最大约 20 位 | FK | 是 | — | 创建人；引用 `users(id)` |
| `created_at` | DATETIME | — | — | 是 | 当前时间 | 创建时间 |
| `opened_at` | DATETIME | — | — | 否 | NULL | 实际开启签到时间 |
| `closed_at` | DATETIME | — | — | 否 | NULL | 实际关闭签到时间 |
| `updated_at` | DATETIME | — | — | 是 | 自动更新 | 修改时间 |

**说明**

- 这一张表同时承担“上课安排”和“该次签到”的职责：日期、节次、时间、教室、签到点、阈值、开关状态都在同一行。
- `class_status='scheduled'` 表示这次课正常进行；`canceled` 表示停课。
- `checkin_status` 由教师手动控制：
  - `draft`：尚未开放；
  - `open`：允许学生签到；
  - `closed`：已结束。
- `checkin_status='open'` 时，数据库 CHECK 要求 `latitude`、`longitude` 必须已设置。
- `start_time`/`end_time` 只用于页面倒计时和排序，不参与“是否允许签到”的判断；手动模式下即使没到上课时间，教师也可以提前开放。
- 一次课只对应一次签到，所以不再单独建 `attendance_sessions`。

## 5. `student_section_assignments`：学生-教学班关系表（中间表）

| 字段 | SQL 类型 | 长度/范围 | 键类型 | 必填 | 默认值 | 说明 |
|---|---|---|---:|---|---|
| `id` | BIGINT UNSIGNED | 最大约 20 位 | PK | 是 | 自增 | 关系记录 ID |
| `student_id` | BIGINT UNSIGNED | 最大约 20 位 | FK、UK(C) | 是 | — | 学生用户 ID；引用 `users(id)`，应为 `role=student` |
| `course_id` | BIGINT UNSIGNED | 最大约 20 位 | FK、UK(C) | 是 | — | 课程 ID；用于保证一门课只在一个教学班 |
| `section_id` | BIGINT UNSIGNED | 最大约 20 位 | FK、UK(C) | 是 | — | 教学班 ID |
| `status` | VARCHAR(20) | 20 字符 | — | 是 | `active` | `active` 或 `disabled` |
| `created_by` | BIGINT UNSIGNED | 最大约 20 位 | FK | 是 | — | 创建人；引用 `users(id)` |
| `created_at` | DATETIME | — | — | 是 | 当前时间 | 创建时间 |
| `updated_at` | DATETIME | — | — | 是 | 自动更新 | 修改时间 |

**说明**

- 这是学生与教学班的多对多中间表。一个学生可以参加多门课程，一门课程有多个学生。
- `(student_id, section_id)` 唯一：同一学生不能重复加入同一教学班。
- `(student_id, course_id)` 唯一：同一学生在一门课程只能有一个教学班。这里的 `course_id` 是“有用途的冗余”，专门用来做这条唯一约束。
- 当前不做备用班授权，所以没有 `assignment_type`、`is_default`、`valid_from/to`。
- 业务层需保证 `section_id` 属于对应的 `course_id`。

## 6. `checkins`：签到记录表

| 字段 | SQL 类型 | 长度/范围 | 键类型 | 必填 | 默认值 | 说明 |
|---|---|---|---:|---|---|
| `id` | BIGINT UNSIGNED | 最大约 20 位 | PK | 是 | 自增 | 签到记录 ID |
| `session_id` | BIGINT UNSIGNED | 最大约 20 位 | FK、UK(C) | 是 | — | 一次课 ID；与学生形成联合唯一 |
| `student_id` | BIGINT UNSIGNED | 最大约 20 位 | FK、UK(C) | 是 | — | 学生用户 ID；引用 `users(id)` |
| `student_no_snapshot` | VARCHAR(10) | 10 位数字 | — | 是 | — | 签到时的学号快照 |
| `student_name_snapshot` | VARCHAR(50) | 50 字符 | — | 是 | — | 签到时的姓名快照 |
| `latitude` | DECIMAL(10,7) | -90 至 90 | — | 是 | — | 学生实测纬度，GCJ-02 |
| `longitude` | DECIMAL(10,7) | -180 至 180 | — | 是 | — | 学生实测经度，GCJ-02 |
| `accuracy` | DECIMAL(10,2) | 大于等于 0 | — | 否 | NULL | 定位精度，单位米 |
| `distance` | DECIMAL(10,2) | 大于等于 0 | — | 是 | — | 与签到点距离，单位米 |
| `status` | VARCHAR(20) | 20 字符 | — | 是 | `valid` | `valid` 有效或 `deleted` 已删除 |
| `checked_in_at` | DATETIME | — | — | 是 | 当前时间 | 签到时间 |
| `updated_at` | DATETIME | — | — | 是 | 自动更新 | 修改时间 |

**说明**

- `UNIQUE(session_id, student_id)` 保证同一学生同一次课只能签到一次。
- 当前不做设备唯一，所以没有 `device_token`。
- 不再重复保存 `course_id`、`section_id`，需要时通过 `session_id → class_sessions → course_sections → courses` 查询。
- 保留学号/姓名快照，避免学生信息后续修改影响历史导出。
- `status='deleted'` 逻辑删除；不要物理删除，否则唯一约束消失，学生可能再次签到。

## 联合约束说明

| 表 | 联合/单列约束 | 作用 |
|---|---|---|
| `users` | `UNIQUE (openid)`、`UNIQUE (student_no)`、`UNIQUE (phone)`、`UNIQUE (email)` | 每类登录标识唯一；NULL 不参与唯一冲突 |
| `courses` | `UNIQUE (course_code)` | 课程编号不重复 |
| `course_sections` | `UNIQUE (course_id, section_code)` | 同一课程下教学班编号不重复 |
| `class_sessions` | `UNIQUE (section_id, class_date, period_start, period_end)` | 同一教学班同一时间不能重复排课 |
| `student_section_assignments` | `UNIQUE (student_id, section_id)` | 同一学生不能重复加入同一教学班 |
| `student_section_assignments` | `UNIQUE (student_id, course_id)` | 同一学生一门课只能有一个教学班 |
| `checkins` | `UNIQUE (session_id, student_id)` | 同一学生一次课只能签到一次 |

## 业务层约束

- `users.role='student'` 时必须有 `student_no`；数据库已用 CHECK 约束。
- `course_sections.teacher_id` 必须指向 `role='teacher'` 的用户。
- `student_section_assignments.student_id` 必须指向 `role='student'` 的用户；`section_id` 必须属于对应的 `course_id`。
- 同一教学班同一日期、同一节次不能有两条 `class_sessions`。
- 只有 `class_status='scheduled'` 且 `checkin_status='open'` 的 `class_sessions` 允许签到。
- `checkin_status='open'` 前必须已设置 `latitude`、`longitude`、`distance_limit`。
- 签到点由管理员/教师设置；教师只能操作自己教学班的签到。
- 学生定位与签到点统一使用 GCJ-02；`distance` 由服务端按 `class_sessions` 的签到点重新计算，不得大于 `distance_limit`。
- 签到记录使用 `status='deleted'` 逻辑删除，不建议物理删除。
- 当前不做设备唯一、不做多学期、不做备用班授权。

## 与旧版及老师建议的对应关系

| 旧版/老师建议 | 合并后 | 处理方式 |
|---|---|---|
| `admins` 管理员表 | `users`（`role='admin'`） | 合并 |
| `students` 学生表 | `users`（`role='student'`） | 合并 |
| `semesters` 学期表 | 删除 | 不做多学期，`class_sessions.class_date` 直接存日期 |
| `courses.teacher_id`、`courses.default_*` | 删除 | 老师放教学班，签到点放一次课 |
| `course_sections.teacher_name` | `course_sections.teacher_id` | 改为用户外键 |
| `section_schedules` + `attendance_sessions` | `class_sessions` | 两者是 1:1，合并为一张“一次课”表 |
| `student_section_assignments` 的备用班字段 | 删除 | 只保留学生-教学班主关系 |
| `checkins.device_token` | 删除 | 当前不做设备唯一 |
| `checkins.course_id`、`section_id` | 删除 | 通过 `session_id` 关联查询 |
| 可选 `verification_codes` | 暂不建 | 需要短信/邮箱验证时再加 |
