# 在线体验（临时公网地址）

> 这是本地开发服务通过 Cloudflare Quick Tunnel 暴露出来的临时地址，**不是正式部署**。  
> 关闭电脑、关闭服务或重启隧道后，地址会变化。

## 学生端 H5

```text
https://grip-alerts-dsl-php.trycloudflare.com/
```

二维码：

![扫码签到](../user-app/docs/qr-checkin.png)

## 管理端

```text
https://clone-weights-fellowship-lending.trycloudflare.com/
```

## 演示账号

学生：

| 学号 | 姓名 |
|---|---|
| 2023010001 | 张三 |
| 2023010002 | 李四 |
| 2023010003 | 王五 |
| 2023010004 | 赵六 |
| 2023010005 | 陈七 |

教师：`13800000001` / `teacher123`  
管理员：`13800000000` / `admin123`

## 当前服务

| 服务 | 本地地址 |
|---|---|
| MySQL | `127.0.0.1:3307` |
| FastAPI | `http://127.0.0.1:8000` |
| 学生端 H5 | `http://localhost:5173` |
| 管理端 | `http://localhost:5174` |

## 下次启动

先关掉上次留下的窗口，然后双击**项目根目录**的 `start-all.bat`。

> 下面的命令都在**项目根目录**执行，不是在 `docs` 目录里执行。

它会打开：

- MySQL 3307
- FastAPI 8000
- H5 5173
- 管理端 5174
- 两个 Cloudflare 隧道窗口

然后：

1. 在 `checkin-tunnel-h5` 窗口复制新的 `https://....trycloudflare.com` 地址；
2. 在 `checkin-tunnel-admin` 窗口复制新的管理端地址；
3. 双击根目录的 `update-qr.bat`，粘贴新地址并回车。

也可以手动执行：

```powershell
server\.venv\Scripts\python.exe tools\generate_qr.py "https://新的H5地址/" "user-app\docs\qr-checkin.png"
```

如果只在电脑上测试，不需要隧道，直接打开：

```text
http://localhost:5173
http://localhost:5174
```

## 说明

- 学生端和管理端都通过 Vite 的 `/api` 代理访问 FastAPI，所以隧道地址变化时**不需要改前端代码**；
- 只需要重新生成学生端二维码；
- 手机 H5 定位依赖 HTTPS，Cloudflare 隧道已提供 HTTPS；
- 如果在微信内置浏览器里定位失败，点右上角“在浏览器打开”；
- 公网地址是临时演示用，正式部署需要自己的域名、HTTPS 证书和反向代理；
- 当前后端 CORS 放开、JWT 密钥为开发值，正式环境必须收紧。
