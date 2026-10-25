# 数据库设计说明（6 表版）

## 1. 项目概述

本数据库用于“微信小程序 / uni-app 定位签到系统”，支持学生、教师、管理员三类角色。

系统支持以下业务：

- 学生、教师、管理员统一从 `users` 登录，登录后按 `role` 自动识别身份，不再先选身份；
- 管理员可以维护课程、教学班、教师分配和学生名单；
- 教师可以维护自己教学班的每次课，设置签到点、距离阈值，手动开启/关闭签到；
- 学生登录后自动识别“当前课程/当前一次课”，在教师开启签到后一键签到；
- 一门课程可以有多个教学班、多个老师、多个上课时段、不同教室；
- 每次课可以设置自己的签到点和距离阈值；
- 同一学生同一次课只能签到一次；
- 签到记录支持逻辑删除，避免删除后同一学生再次签到；
- 当前版本不做多学期、不做备用班授权、不做设备唯一。

## 2. 设计原则

### 2.1 六张表

- `users`：学生 / 教师 / 管理员统一身份；
- `courses`：课程目录；
- `course_sections`：教学班；
- `class_sessions`：一次具体上课，同时保存该次签到规则；
- `student_section_assignments`：学生与教学班的关系（中间表）；
- `checkins`：签到记录。

### 2.2 为什么把“上课安排”和“签到活动”合并

旧版有 `section_schedules`（上课安排）和 `attendance_sessions`（签到活动）两张表，`attendance_sessions.schedule_id` 是唯一的，所以两者本质上是 **1:1**：

- 一个上课安排最多对应一个签到活动；
- 一次课只允许一个学生签到一次。

既然是一对一，再拆两张表只会多一次 join，不会多出任何能力。因此合并为 `class_sessions`：

- 一行代表一次具体上课；
- 同时保存日期、节次、时刻、教室、签到点、距离阈值、签到开关状态；
- `checkins` 直接引用 `class_sessions.id`。

### 2.3 签到点放在哪里

签到点放在 `class_sessions`，不放在 `courses`：

- 不同教学班可以在不同教室；
- 同一次课的点位可能因为调课而变化；
- 管理员/教师在每次课上设置 `latitude`、`longitude`、`distance_limit`；
- `checkin_status='open'` 前必须已设置签到点，数据库用 CHECK 约束保证。

这样 `courses` 只回答“这是什么课”，不会和 `class_sessions` 重复存签到规则。

### 2.4 其他取舍

| 设计点 | 处理 |
|---|---|
| 学生、教师、管理员是否分表 | 合并为 `users`，用 `role` 区分 |
| 是否保留学期 | 不做多学期，删除 `semesters`，`class_sessions.class_date` 直接存日期 |
| 是否保留备用班授权 | 不做，删除 `assignment_type`、`is_default`、`valid_from/to` |
| 是否做设备唯一 | 不做，删除 `device_token` 和相关唯一索引 |
| 签到时间控制 | 只做手动开启/关闭；`start_time/end_time` 只用于倒计时和排序 |
| 学生-教学班关系 | 保留 `student_section_assignments` 中间表 |
| 签到记录是否存课程/教学班 | 不重复存，通过 `session_id` 关联查询 |

## 3. 数据库实现说明

本设计使用 MySQL 8.0 的 SQL 类型描述字段，包括：

- `BIGINT UNSIGNED`：主键和外键 ID；
- `VARCHAR(n)`：有长度限制的文本；
- `TINYINT UNSIGNED`：节次等小整数；
- `DECIMAL(10,7)`：经纬度；
- `DECIMAL(10,2)`：距离和定位精度；
- `DATE`：日期；
- `TIME`：上课时刻；
- `DATETIME`：日期和时间。

实际使用微信云开发时，可将这些表映射为云数据库集合；使用 uni-app + 自建后端时，可直接使用 MySQL。

## 4. 表的职责

### 4.1 `users`：用户

统一保存学生、教师、管理员身份。

- `role='student'`：使用 `student_no`、`name`、`class_name`，登录时可继续使用“学号 + 姓名”；
- `role='teacher'`：可以使用 `openid` 或 `password_hash` 登录 Web 管理端；
- `role='admin'`：使用 `openid` 或 `password_hash` 登录 Web 管理端。

学生不绑定微信 `openid` 也可以登录；如果小程序端需要微信授权，则把 `openid` 写入用户记录即可。

### 4.2 `courses`：课程

保存课程编号、课程名称和状态。它不保存老师、签到点、学期，避免和教学班/一次课重复。

### 4.3 `course_sections`：教学班

一门课程可能有多个教学班，例如 1 班、2 班、3 班。不同教学班可以有不同任课教师和学生名单。

当前一个教学班只设置一个老师；如果以后要“多个老师共同授课”，再加 `section_teachers` 中间表。`teacher_id` 允许为空，表示尚未分配老师。

### 4.4 `class_sessions`：一次课

表示一次具体的上课，同时保存该次签到规则：

- `class_date`、`period_start/period_end`、`start_time/end_time`、`classroom`：这次课在哪天、第几节、几点、哪个教室；
- `latitude`、`longitude`、`distance_limit`：这次课的签到点和距离阈值；
- `class_status`：`scheduled` 正常上课 / `canceled` 停课；
- `checkin_status`：`draft` 未开放 / `open` 已开放 / `closed` 已结束；
- `opened_at`、`closed_at`：实际开启/关闭时间；
- `created_by`：创建人（管理员或教师）。

`start_time/end_time` 只用于页面倒计时和排序，不参与“是否允许签到”的判断。教师可以在上课前提前开放，也可以在上课后继续开放。

### 4.5 `student_section_assignments`：学生-教学班关系

这是学生与教学班的多对多中间表：

- `(student_id, section_id)` 唯一：同一学生不能重复加入同一教学班；
- `(student_id, course_id)` 唯一：同一学生在一门课程只能有一个教学班；
- 当前不做备用班授权，所以没有 `assignment_type`、`is_default`、`valid_from/to`。

`course_id` 是“有用途的冗余”，专门用来做第二条唯一约束；业务层仍需保证 `section_id` 属于对应的 `course_id`。

### 4.6 `checkins`：签到记录

保存学生实际签到的结果，包括学生、一次课、定位坐标、定位精度、距离和签到时间。

- `latitude`、`longitude` 是学生提交签到时的实测位置；
- `distance` 是学生实测位置与 `class_sessions` 签到点之间的距离；
- 保留学号/姓名快照，避免学生信息后续修改影响历史导出；
- `UNIQUE(session_id, student_id)` 保证同一学生同一次课只能签到一次；
- 不再重复保存 `course_id`、`section_id`，需要时通过 `session_id` 关联查询。

## 5. 表之间的关系

```text
courses 1 ─── N course_sections

users 1 ─── N course_sections            （teacher_id，教师授课）
users 1 ─── N student_section_assignments（student_id，学生加入教学班）
users 1 ─── N class_sessions             （created_by，创建一次课）
users 1 ─── N checkins                   （student_id，学生提交签到）

course_sections 1 ─── N class_sessions

users N ─── N course_sections
通过 student_section_assignments 关联

class_sessions 1 ─── N checkins
```

补充说明：

- `course_sections.created_by`、`class_sessions.created_by`、`student_section_assignments.created_by` 都引用 `users(id)`，用于记录管理员/教师操作人。
- `checkins` 只引用 `class_sessions` 和 `users`；课程、教学班信息通过 `class_sessions → course_sections → courses` 查询。

## 6. 用户端主流程

学生打开小程序/H5 后，系统执行：

1. 根据登录凭据（微信 openid、手机号或学号+姓名）查询 `users`，得到 `role`；
2. 如果 `role='student'`，进入学生端；如果 `role='teacher'` 或 `admin`，进入教师/管理端；
3. 学生端不再显示“选择教师/学生”的入口，直接按当前日期查询：
   - 今天的 `class_sessions`；
   - 该学生通过 `student_section_assignments` 所属的教学班；
   - `class_status='scheduled'` 的课；
4. 找到“当前课程/当前一次课”后，页面显示课程名称、教学班、上课时间、教室和倒计时；
5. 如果 `checkin_status='open'`，显示签到按钮；
6. 学生点击“签到”，前端获取定位，后端校验距离、所属教学班、签到状态和唯一性，写入 `checkins`，返回结果。

如果当前没有匹配的课程，页面显示“当前没有待签到课程”，而不是课程列表。

## 7. 签到规则

### 7.1 手动开启/关闭

- 教师打开签到：`checkin_status='open'`，`opened_at=NOW()`；
- 教师关闭签到：`checkin_status='closed'`，`closed_at=NOW()`；
- 学生只有在 `class_status='scheduled'` 且 `checkin_status='open'` 时才能签到；
- 不做自动起止时间，`start_time/end_time` 只用于页面倒计时提示。

### 7.2 签到点与距离

- 管理员/教师在每次 `class_sessions` 上设置 `latitude`、`longitude`、`distance_limit`（默认 50 米）；
- `checkin_status='open'` 前必须已设置签到点，数据库 CHECK 约束会阻止没有点位的开放；
- 学生定位与签到点统一使用 GCJ-02；
- `distance` 由服务端重新计算，只有 `distance <= distance_limit` 才允许写入。

### 7.3 唯一性与逻辑删除

- `UNIQUE(session_id, student_id)`：同一学生同一次课只能签到一次；
- 当前不做设备唯一，所以同一台手机可以替不同学生签到，这是本版本的已知限制；
- 签到记录使用 `status='deleted'` 逻辑删除，不建议物理删除，避免唯一约束失效后学生再次签到。

## 8. 教师/管理员设置签到点

- 管理员/教师在教学班的每次课上设置签到点；
- 教师只能操作自己教学班的 `class_sessions`，管理员可以操作全部；
- 点位可以在 `draft` 状态修改；开启后建议锁定，避免历史签到判断依据变化；
- 同一教学班每次课都可以有不同点位，支持不同教室、调课等场景。

## 9. Excel 导入字段建议

教师导入学生、课程、教学班和上课安排时，Excel 可以包含以下字段：

| Excel 字段 | 写入位置 |
|---|---|
| 课程编号 | `courses.course_code` |
| 课程名称 | `courses.course_name` |
| 教学班编号 | `course_sections.section_code` |
| 教学班名称 | `course_sections.section_name` |
| 任课教师 | `course_sections.teacher_id`（按姓名/工号匹配 `users`） |
| 学号 | `users.student_no` |
| 姓名 | `users.name` |
| 班级 | `users.class_name` |
| 上课日期 | `class_sessions.class_date` |
| 开始节次 | `class_sessions.period_start` |
| 结束节次 | `class_sessions.period_end` |
| 开始时刻 | `class_sessions.start_time` |
| 结束时刻 | `class_sessions.end_time` |
| 教室 | `class_sessions.classroom` |
| 签到点纬度 | `class_sessions.latitude` |
| 签到点经度 | `class_sessions.longitude` |
| 距离阈值 | `class_sessions.distance_limit` |

导入程序需要对课程、学生、教学班、上课日期进行去重，然后建立学生与教学班的关系。教师如果还不存在，可以先创建 `role='teacher'` 的用户，再回填 `teacher_id`。

## 10. 主表与中间表

| 类别 | 表 | 说明 |
|---|---|---|
| 主数据表 | `users`、`courses` | 独立存在，最顶层 |
| 业务实体表 | `course_sections` | 依赖课程和教师，但本身是业务对象 |
| 业务事件表 | `class_sessions` | 一次具体上课，依赖教学班 |
| 业务流水表 | `checkins` | 签到结果，依赖一次课和学生 |
| 中间表 | `student_section_assignments` | 学生与教学班的多对多关系 |

如果只按“主表 / 中间表”二分：`users`、`courses`、`course_sections`、`class_sessions`、`checkins` 算主表/业务表，`student_section_assignments` 是唯一的纯中间表。

## 11. 尚需在实现阶段校验的业务规则

- `users.role='student'` 时必须有 `student_no`；数据库已用 CHECK 约束。
- `course_sections.teacher_id` 必须指向 `role='teacher'` 的用户。
- `student_section_assignments.student_id` 必须指向 `role='student'` 的用户；`section_id` 必须属于对应的 `course_id`。
- 同一教学班同一日期、同一节次不能有两条 `class_sessions`。
- 只有 `class_status='scheduled'` 且 `checkin_status='open'` 的 `class_sessions` 允许签到。
- `checkin_status='open'` 前必须已设置签到点。
- 学生只能签到所属教学班的 `class_sessions`。
- 学生定位与签到点统一使用 GCJ-02；`distance` 由服务端计算。
- 签到记录使用逻辑删除；当前不做设备唯一。
- 教师只能操作自己教学班的签到，管理员可以操作全部。

## 12. 与旧版及老师建议的合并说明

### 12.1 保留的旧设计

- 课程 → 教学班 → 一次课的分层结构；
- 多教学班、多老师、多时段、不同教室；
- 学生与教学班的关系；
- 每次课设置签到点和距离阈值；
- 学号/姓名快照；
- 逻辑删除；
- 经纬度、距离、状态等 CHECK 约束。

### 12.2 采纳的老师建议

- 学生、教师、管理员统一为 `users`，用 `role` 区分；
- 课程表保存课程名称、授课教师、签到点位、距离阈值；
- 签到记录关联用户与课程；
- 用户端一个核心按钮，自动识别身份和当前课程；
- Web 管理端按需扩展；
- 交付形态向 uni-app/H5 多端靠拢。

### 12.3 本版主动去掉的内容

- `semesters`：不做多学期，`class_sessions.class_date` 直接存日期；
- `section_schedules` + `attendance_sessions`：两者 1:1，合并为 `class_sessions`；
- `courses.teacher_id`、`courses.default_*`：老师放教学班，签到点放一次课；
- `student_section_assignments` 的备用班字段：只保留主关系；
- `checkins.device_token`：不做设备唯一；
- `checkins.course_id`、`section_id`：通过 `session_id` 关联查询；
- 可选 `verification_codes`：需要短信/邮箱验证时再加。
