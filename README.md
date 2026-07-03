# 作业计划表

替代复杂 Excel 的作业安排与进度追踪系统。支持多计划、周课表、课程/地点管理、每日安排与完成记录。

**文档：**

- [使用说明.md](./使用说明.md) — 功能操作指南（家长/学生/管理员）
- [安装说明.md](./安装说明.md) — 本机、其它电脑、服务器安装与部署

## 技术栈

- 后端：Python FastAPI + SQLite（本地）/ PostgreSQL（生产）
- 前端：React + TypeScript + Tailwind CSS（移动端优先）

## 一键启动（Windows）

```bat
start.bat
```

- 后端：http://localhost:8002  
- 前端：http://localhost:5173  
- 登录：http://localhost:5173/login  
- 运营后台：http://localhost:5173/admin  

首次使用请复制 `.env.example` 为 `.env` 并修改管理员密码与 `JWT_SECRET`。

## 快速配置

```bat
copy .env.example .env
```

本地单机（无需 Docker）：

```env
DATABASE_URL=sqlite:///./backend/homework.db
DEV_MODE=false
ADMIN_PASSWORD=请修改
JWT_SECRET=请改为随机长字符串
```

使用 PostgreSQL 时：`docker compose up -d`，并将 `DATABASE_URL` 改为 PostgreSQL 连接串。详见 [安装说明.md](./安装说明.md)。

## 功能概览

- 多计划、周课表（列表/表格视图，左滑编辑）
- 课程管理、上课地点、作业安排（科目）
- 培训班 / 自安排时段、单日临时调整
- 长期任务、多附件上传与在线预览
- 运营后台：用户/计划管理、上传大小设置
- REST API，可供 iOS / Android 原生 App 接入

**Android APK：** 见 [deploy/Android-APK打包说明.md](./deploy/Android-APK打包说明.md)，运行 `scripts\build-apk.bat`。
