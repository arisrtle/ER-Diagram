# 微信 / uni-app 定位签到系统

## 项目简介

本项目是一个面向课程教学场景的定位签到系统设计。系统采用“统一用户表 + 角色”的模型，学生、教师、管理员共用一套入口：登录后按角色自动进入对应界面，学生端以“当前一次课 + 一个签到按钮”为核心，教师/管理员通过 Web 管理端维护课程、教学班、上课安排和签到。

当前仓库包含数据库设计、ER 图、交互原型、uni-app 用户端工程（H5 可运行）、FastAPI + MySQL 后端和 Vue 3 Web 管理端。

## 在线体验（临时）

- 学生端 H5：<https://grip-alerts-dsl-php.trycloudflare.com/>
- 管理端：<https://clone-weights-fellowship-lending.trycloudflare.com/>
- 学生端二维码：

![扫码签到](user-app/docs/qr-checkin.png)

> 这是 Cloudflare 临时隧道，关闭服务或重启隧道后地址会变化，详见 `docs/DEMO.md`。

## 下次启动

1. 先关掉上次留下的命令行窗口，避免端口占用；
2. 双击根目录的 `start-all.bat`；
3. 它会依次打开 MySQL、FastAPI、H5、管理端和两个隧道窗口；
4. 看 `checkin-tunnel-h5` 窗口里新生成的 `https://....trycloudflare.com` 地址；
5. 双击根目录的 `update-qr.bat`，把新地址粘贴进去，回车；
6. 管理端地址用 `checkin-tunnel-admin` 窗口里新生成的地址。

也可以手动执行：

```powershell
server\.venv\Scripts\python.exe tools\generate_qr.py "https://新的H5地址/" "user-app\docs\qr-checkin.png"
```

如果只在电脑上测试，不需要隧道：

```text
学生端：http://localhost:5173
管理端：http://localhost:5174
API：http://127.0.0.1:8000/docs
```

## 当前设计内容

- **6 张表**：`users`、`courses`、`course_sections`、`class_sessions`、`student_section_assignments`、`checkins`
- MySQL 8.0 建表 SQL
- 数据库表字段说明文档
- 数据库设计与业务规则说明
- ER 图（SVG，附 PNG 预览）
- 交互界面原型
- uni-app 用户端工程（登录 + 一屏签到，已接后端）
- FastAPI + MySQL 后端（学生登录 / 当前课 / 签到；教师登录 / 开关签到 / 记录）
- Vue 3 + Element Plus Web 管理端
- 可扫码体验的临时 HTTPS 地址

## 设计要点

- **统一用户表**：学生、教师、管理员统一存于 `users`，用 `role` 区分；教师不单独建表。
- **自动识别身份**：登录后按 `role` 进入学生端或教师/管理端，不再先选身份。
- **课程 → 教学班 → 一次课**：`courses` 只存课程目录，`course_sections` 存教学班和老师，`class_sessions` 存某天某节的上课安排。
- **一次课 = 上课安排 + 签到规则**：`class_sessions` 同时保存日期、节次、教室、签到点、距离阈值和开关状态，不再单独建 `attendance_sessions`。
- **每次课设置签到点**：管理员/教师按次设置经纬度和距离阈值，支持不同教学班、不同教室。
- **手动开关**：教师手动开启/关闭签到；`start_time/end_time` 只用于倒计时和排序。
- **一次课只能签一次**：`UNIQUE(session_id, student_id)`。
- **逻辑删除**：签到记录使用 `status='deleted'`，避免删除后同一学生再次签到。
- **当前不做**：多学期、备用班授权、设备唯一。

## 主要业务流程

1. 管理员/教师登录 Web 管理端，维护课程、教学班和上课安排。
2. 管理员导入学生名单，把学生加入对应教学班。
3. 教师为每次课设置签到点和距离阈值。
4. 教师在上课时手动开启签到；结束时手动关闭。
5. 学生登录后系统自动识别身份和当前一次课，在签到范围内点击“签到”。
6. 服务端校验教学班归属、签到状态、距离和唯一性，写入签到记录并返回结果。
7. 教师查看签到记录并导出结果。

## 表结构概览

| 表 | 角色 | 说明 |
|---|---|---|
| `users` | 主数据表 | 学生 / 教师 / 管理员统一身份 |
| `courses` | 主数据表 | 课程目录 |
| `course_sections` | 业务实体表 | 教学班，一个班暂定一个老师 |
| `class_sessions` | 业务事件表 | 一次具体上课，同时保存该次签到规则 |
| `student_section_assignments` | 中间表 | 学生与教学班的多对多关系 |
| `checkins` | 业务流水表 | 签到记录 |

## 用户端（user-app）

学生端按“一屏签到”搭建：

- 登录：学号 + 姓名，一次性登录；
- 签到页：当前课程、倒计时、大按钮、定位距离、结果反馈；
- 已接 FastAPI + MySQL 后端，也可切回 mock；
- 优先 H5，后续可编译微信小程序；
- 预览：[登录页](<user-app/docs/preview-login.png>)、[签到页](<user-app/docs/preview-checkin.png>)。

运行：

```bash
cd user-app
npm install
npm run dev:h5
```

也可以直接双击 `user-app/start-h5.bat`。

构建 H5：

```bash
cd user-app
npm run build:h5
```

也可以双击 `user-app/build-h5.bat`。详见 `user-app/README.md`。

## 后端（server）

FastAPI + MySQL，已实现：

- 学生登录（学号 + 姓名）
- 当前一次课
- 定位签到（服务端算距离、校验教学班、唯一签到）
- 教师 / 管理员登录（手机号 + 密码）
- 管理端：课程列表、设置签到点、开启 / 关闭签到、查看签到记录

启动：

```bash
cd server
.venv\Scripts\python.exe init_db.py
run-backend.bat
```

接口文档：`http://127.0.0.1:8000/docs`

演示学生：`2023010001 / 张三`、`2023010002 / 李四` 等 5 人；教师 `13800000001 / teacher123`；管理员 `13800000000 / admin123`。详见 `server/README.md`。

## 管理端（admin-web）

Vue 3 + Vite + Element Plus：

- 教师 / 管理员登录；
- 查看自己的课程 / 教学班 / 一次课；
- 新增一次课（日期 / 节次 / 时刻 / 教室）；
- 课程 / 教学班管理；
- 学生管理、分配教学班、Excel 批量导入；
- 设置签到点（支持浏览器当前位置）；
- 手动开启 / 关闭签到；
- 查看 / 编辑 / 逻辑删除签到记录；
- 导出签到记录 Excel。

启动：

```bash
cd admin-web
npm install
npm run dev
```

默认地址：`http://localhost:5174`

也可以直接双击 `admin-web/start-admin.bat`。

预览：[登录页](<admin-web/docs/preview-login.png>)、[管理端](<admin-web/docs/preview-admin.png>)。详见 `admin-web/README.md`。

## 文件说明

| 文件 | 说明 |
|---|---|
| `docs/database.sql` | 6 表版数据库建表 SQL |
| `docs/database-tables.md` | 数据库表及字段说明（含主表/中间表、旧版映射） |
| `docs/database-design.md` | 数据库设计、业务规则与合并说明 |
| `docs/er-diagram.svg` | 6 表版 ER 图 |
| `docs/er-diagram-preview.png` | ER 图 PNG 预览 |
| `docs/DEMO.md` | 临时公网地址、二维码、演示账号 |
| `docs/Task11.md` | 课程任务原文 |
| `docs/交互界面.pptx` | 交互界面原型（旧版，待按“一个核心按钮”改版） |
| `tools/generate_er.py` | ER 图生成脚本（SVG + PNG） |
| `tools/generate_qr.py` | 二维码生成脚本 |
| `start-all.bat` | 一键启动 MySQL / 后端 / H5 / 管理端 / 隧道 |
| `update-qr.bat` | 粘贴新 H5 地址，更新二维码 |
| `user-app/` | uni-app 用户端工程（Vue 3 + Vite，H5） |
| `user-app/README.md` | 用户端运行说明 |
| `server/` | FastAPI + MySQL 后端 |
| `server/README.md` | 后端启动、接口、演示账号说明 |
| `admin-web/` | Vue 3 + Element Plus 管理端 |
| `admin-web/README.md` | 管理端运行与功能说明 |
| `user-app/docs/qr-checkin.png` | 学生端签到二维码 |

## 说明

本仓库当前包含数据库设计、ER 图、交互原型、uni-app 用户端、FastAPI 后端和 Vue 3 管理端；学生端 + 管理端闭环已经打通，管理端支持课程/学生管理、Excel 导入和签到记录导出，并已通过临时隧道提供扫码体验。

数据库采用 MySQL 8.0 描述；实际使用微信云开发时可将表映射为云数据库集合，使用 `uni-app` + 自建后端时可直接使用 MySQL。下一阶段：微信小程序预览、正式域名和 HTTPS 部署，以及课程报告/PPT/GitHub 收尾。
