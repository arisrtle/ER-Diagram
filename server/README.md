# 后端（FastAPI + MySQL）

学生端 + 管理端后端，提供：

- 学生：学号 + 姓名登录、查询当天当前一次课、定位签到；
- 教师/管理员：手机号 + 密码登录；
- 管理端：课程列表、设置签到点、开启 / 关闭签到、查看签到记录。

## 技术栈

- FastAPI 0.162
- SQLAlchemy 2.1 + PyMySQL
- MySQL 8.0
- JWT（PyJWT）

## 目录

```text
server/
├── app/
│   ├── config.py        # 环境变量
│   ├── db.py            # SQLAlchemy engine / session
│   ├── models.py        # 6 张表 ORM
│   ├── schemas.py       # Pydantic 请求/响应
│   ├── security.py      # JWT / 密码哈希
│   ├── geo.py           # haversine 距离
│   ├── deps.py          # 当前登录用户
│   ├── main.py          # FastAPI 入口
│   └── routers/
│       ├── auth.py      # 学生 / 教师登录
│       ├── student.py   # 当前课 / 签到
│       └── admin.py     # 课程列表 / 开关签到 / 点位 / 记录
├── init_db.py           # 删表、建表、种子数据
├── seed.py              # 种子数据
├── .env                 # 本地配置（已 gitignore）
├── requirements.txt
├── run-backend.bat
├── init-db.bat
├── start-mysql.bat
└── stop-mysql.bat
```

## MySQL

电脑上原来的 MySQL 80 服务在 3306，root 有密码；为了不打扰它，项目单独起了一个开发实例：

- 端口：`3307`
- 数据目录：`%LOCALAPPDATA%\wechat-checkin-mysql`
- 用户：`checkin` / `checkin123`
- 数据库：`wechat_checkin`

启动 / 停止：

```text
start-mysql.bat
stop-mysql.bat
```

如果你想改用原来的 3306，把 `.env` 里的 `DATABASE_URL` 改成你自己的连接串即可。

## 初始化

第一次运行：

```text
init-db.bat
```

等价于：

```bash
.venv\Scripts\python.exe init_db.py
```

它会：

1. 删除 6 张旧表；
2. 按 `docs/database.sql` 重新建表；
3. 插入演示数据。

## 启动

```text
run-backend.bat
```

等价于：

```bash
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

接口文档：

```text
http://127.0.0.1:8000/docs
```

健康检查：

```text
GET http://127.0.0.1:8000/api/health
```

## 演示账号

学生（10 位学号）：

| 学号 | 姓名 |
|---|---|
| 2023010001 | 张三 |
| 2023010002 | 李四 |
| 2023010003 | 王五 |
| 2023010004 | 赵六 |
| 2023010005 | 陈七 |

教师 / 管理员：

| 角色 | 手机号 | 密码 |
|---|---|---|
| 教师 | 13800000001 | teacher123 |
| 管理员 | 13800000000 | admin123 |

## 接口

### 登录

```http
POST /api/auth/student-login
Content-Type: application/json

{
  "student_no": "2023010001",
  "name": "张三"
}
```

返回：

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "user": {
    "id": 3,
    "role": "student",
    "student_no": "2023010001",
    "name": "张三",
    "class_name": "自动化2301"
  }
}
```

### 当前一次课

```http
GET /api/student/current-session
Authorization: Bearer <token>
```

有课时返回：

```json
{
  "session_id": 1,
  "course_name": "自动控制原理",
  "section_name": "1班",
  "classroom": "A101",
  "class_date": "2026-10-25",
  "start_time": "10:22",
  "end_time": "12:02",
  "checkin_status": "open",
  "distance_limit": 20000000.0,
  "latitude": 39.9042,
  "longitude": 116.4074,
  "already_checked_in": false,
  "checked_in_at": null
}
```

没有课时返回 `null`。

### 签到

```http
POST /api/student/checkin
Authorization: Bearer <token>
Content-Type: application/json

{
  "session_id": 1,
  "latitude": 39.9042,
  "longitude": 116.4074,
  "accuracy": 10
}
```

返回：

```json
{
  "success": true,
  "code": null,
  "message": "签到成功",
  "distance": 0.0,
  "checked_in_at": "2026-10-25T10:12:25"
}
```

校验顺序：

1. 学生必须属于该教学班；
2. `class_status='scheduled'`；
3. `checkin_status='open'`；
4. 未签到过；
5. 距离不超过 `distance_limit`；
6. 写入 `checkins`，`UNIQUE(session_id, student_id)` 兜底。

### 教师 / 管理员登录

```http
POST /api/auth/teacher-login
Content-Type: application/json

{
  "phone": "13800000001",
  "password": "teacher123"
}
```

返回结构和学生登录一致。

### 管理端课程列表

```http
GET /api/admin/class-sessions
Authorization: Bearer <token>
```

教师只返回自己教学班的课；管理员返回全部。

### 新增一次课

```http
POST /api/admin/class-sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "section_id": 1,
  "class_date": "2026-10-27",
  "period_start": 5,
  "period_end": 6,
  "start_time": "14:00:00",
  "end_time": "15:40:00",
  "classroom": "A103",
  "distance_limit": 50
}
```

`start_time` / `end_time` 可空；新活动默认 `checkin_status='draft'`。

### 开启 / 关闭签到

```http
POST /api/admin/class-sessions/{id}/open
POST /api/admin/class-sessions/{id}/close
Authorization: Bearer <token>
```

开启前必须已设置签到点；教师只能操作自己的教学班。

### 设置签到点

```http
PUT /api/admin/class-sessions/{id}/point
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 39.9042,
  "longitude": 116.4074,
  "distance_limit": 50
}
```

签到开启后禁止修改点位，需先关闭。

### 签到记录

```http
GET /api/admin/class-sessions/{id}/checkins
Authorization: Bearer <token>
```

返回学号、姓名、签到时间、距离、状态（包含逻辑删除记录）。

### 课程 / 教学班

```http
GET    /api/admin/courses
POST   /api/admin/courses
PUT    /api/admin/courses/{id}

GET    /api/admin/sections?course_id=
POST   /api/admin/sections
PUT    /api/admin/sections/{id}

GET    /api/admin/teachers
```

### 学生

```http
GET    /api/admin/students?keyword=
POST   /api/admin/students
PUT    /api/admin/students/{id}
POST   /api/admin/students/{id}/assignments
POST   /api/admin/students/import      # multipart，.xlsx
```

Excel 表头：

```text
学号 | 姓名 | 班级 | 课程编号 | 教学班编号
```

后两列可选，学号必须 10 位数字。

### 签到记录修改 / 导出

```http
PUT /api/admin/checkins/{id}
GET /api/admin/class-sessions/{id}/checkins/export
```

`PUT` 可修改学号/姓名快照和 `status`（`valid` / `deleted`）；导出返回 `.xlsx`。

## 演示距离阈值

种子数据把 `class_sessions.distance_limit` 设成了 `20,000,000` 米，签到点在北京，方便在任何地点跑通“签到成功”。

正式使用时应改成 50 米：

```sql
UPDATE class_sessions SET distance_limit = 50;
```

前端在范围内只显示“当前位置在签到范围内”，不显示具体距离，所以演示时不会看到很大的数字。

## 前端对接

用户端 `user-app/src/common/api.js`：

```js
export const USE_MOCK = false
export const MOCK_FALLBACK_LOCATION = false
const BASE_URL = import.meta.env.VITE_API_BASE || ''
```

H5 开发服务器会把 `/api` 代理到 `http://127.0.0.1:8000`；小程序构建时用 `VITE_API_BASE` 指定完整后端地址。

启动用户端：

```bash
cd user-app
npm run dev:h5
```

登录 `2023010001 / 张三` 即可。

## 说明

- 当前实现了学生端 + 管理端最小闭环；课程/教学班/学生的增删改、Excel 导出是下一步。
- 密码哈希使用 PBKDF2；教师/管理员登录已开放。
- 开发环境 CORS 允许所有来源；正式部署需要收紧。
- JWT 密钥在 `.env`，正式部署要换掉。
