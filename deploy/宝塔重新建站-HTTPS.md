# homework 宝塔重新建站指南（HTTPS Git）

本文是 **删站重建** 的完整步骤，使用：

- 域名：`homework.meituyin.cn`
- 仓库：`https://github.com/chenminsay2025/homework.git`
- 分支：`main`
- 项目目录：`/www/wwwroot/homework.meituyin.cn`

> 适用场景：原 SSH Git 绑定无法修改、Webhook 反复失败，需要从零按 HTTPS 方式重建。

---

## 流程概览

```
① 备份 .env / 数据库 / 附件
② 删除旧站点（保留或稍后恢复数据）
③ 新建站点 + SSL
④ HTTPS git clone + install.sh
⑤ 恢复 .env 与数据
⑥ PM2 启动后端
⑦ Nginx（frontend/dist + /api 反代）
⑧ 宝塔 Git HTTPS 绑定 + Webhook
⑨ 验证 + 本机 git push 自动部署
```

---

## 一、备份（必做）

SSH 登录服务器：

```bash
cd /www/wwwroot/homework.meituyin.cn

# 备份环境、数据库、附件
cp .env /root/homework.env.bak
cp backend/homework.db /root/homework.db.bak
tar czf /root/homework-uploads.bak.tar.gz -C backend uploads

# 确认备份存在
ls -lh /root/homework.*
```

---

## 二、删除旧站点

**宝塔 → 网站 → homework.meituyin.cn → 删除**

- 若提示是否删除目录：建议 **保留目录** 或先手动备份整个目录到 `/root/homework-old/`
- 若已备份，可删除目录后干净重建

可选：清理旧目录后重建

```bash
mv /www/wwwroot/homework.meituyin.cn /root/homework-old-$(date +%Y%m%d)
mkdir -p /www/wwwroot/homework.meituyin.cn
```

---

## 三、新建站点

**宝塔 → 网站 → 添加站点**

| 项 | 值 |
|----|-----|
| 域名 | `homework.meituyin.cn` |
| 根目录 | `/www/wwwroot/homework.meituyin.cn`（先占位，后面改到 frontend/dist） |
| PHP | **纯静态** 或关闭 PHP |
| FTP / 数据库 | 不需要 |

**SSL：** 网站设置 → SSL → Let's Encrypt 申请并开启 HTTPS。

---

## 四、拉取代码（HTTPS）

SSH：

```bash
cd /www/wwwroot

# 若目录空或已删除，直接 clone
git clone -b main https://github.com/chenminsay2025/homework.git homework.meituyin.cn

cd homework.meituyin.cn
git config --global --add safe.directory /www/wwwroot/homework.meituyin.cn
git config --system --add safe.directory /www/wwwroot/homework.meituyin.cn
git config --system --add safe.directory '*'
```

---

## 五、恢复配置与数据

```bash
cd /www/wwwroot/homework.meituyin.cn

# 恢复 .env（若没有备份则从模板创建）
cp /root/homework.env.bak .env
# 或：cp .env.example .env && nano .env

# 恢复数据库与附件
mkdir -p backend/uploads
cp /root/homework.db.bak backend/homework.db
tar xzf /root/homework-uploads.bak.tar.gz -C backend/

chmod 644 backend/homework.db
chmod -R 755 backend/uploads
```

### `.env` 生产配置参考

```env
DATABASE_URL=sqlite:///./backend/homework.db

DEV_MODE=false

JWT_SECRET=你的随机长字符串

ADMIN_USERNAME=admin
ADMIN_PASSWORD=你的强密码

CORS_ORIGINS=https://homework.meituyin.cn
```

> 登录密码以 **数据库里** 的用户为准（迁移后沿用本地账号密码）。

---

## 六、安装依赖并构建前端

```bash
cd /www/wwwroot/homework.meituyin.cn
bash scripts/install.sh
```

成功标志：存在 `frontend/dist/index.html`。

---

## 七、PM2 启动后端

```bash
cd /www/wwwroot/homework.meituyin.cn
pm2 start deploy/pm2.ecosystem.config.cjs
pm2 save

curl -s http://127.0.0.1:8002/api/health
# 应返回 "status":"ok"
```

> **不要** 在宝塔 PM2 里按 Node 项目添加；用命令行 + `deploy/pm2.ecosystem.config.cjs`。

---

## 八、Nginx 配置（三处）

### 8.1 网站根目录

**网站 → homework.meituyin.cn → 网站目录**

```
/www/wwwroot/homework.meituyin.cn/frontend/dist
```

### 8.2 反向代理（仅 `/api`）

**网站 → 反向代理 → 添加**

| 项 | 值 |
|----|-----|
| 代理目录 | `/api` |
| 目标 URL | `http://127.0.0.1:8002` |
| 发送域名 | `$host` |
| 开启缓存 | 关 |

**反向代理配置文件**（只写这段，不要写 `root`）：

```nginx
location ^~ /api
{
    proxy_pass http://127.0.0.1:8002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
}
```

> **`proxy_pass` 末尾不要 `/`**，否则 `/api/health` 会变成 `/health` 返回 404。

### 8.3 主站点配置文件

**网站 → 配置文件**，在 `server { }` 内确认：

```nginx
index index.html;
root /www/wwwroot/homework.meituyin.cn/frontend/dist;

location / {
    try_files $uri $uri/ /index.html;
}

client_max_body_size 100m;
```

可注释：`# include enable-php-00.conf;`

### 8.4 验证 Nginx

```bash
curl -s https://homework.meituyin.cn/api/health
curl -sI https://homework.meituyin.cn/
```

浏览器应看到 **登录页**（不是 JSON）。

---

## 九、宝塔 Git 绑定（HTTPS + Webhook）

**网站 → homework.meituyin.cn → Git 管理 → 仓库**

首次绑定填写：

| 项 | 值 |
|----|-----|
| 仓库 | `https://github.com/chenminsay2025/homework.git` |
| 分支 | `main` |
| 目录 | `/www/wwwroot/homework.meituyin.cn` |

公开仓库 HTTPS **一般不需要 Token**。点 **拉取** 测试成功。

### 部署脚本

```bash
chown -R www:www /www/wwwroot/homework.meituyin.cn
cd /www/wwwroot/homework.meituyin.cn
bash scripts/deploy-webhook.sh
```

保存。

> 宝塔会在 `git pull` **之后** 执行此脚本。脚本会构建前端并 `pm2 restart homework-api`。

### 复制 Webhook 地址

Git 管理页复制 **完整 Webhook URL**（含 `access_key=`、`param=`）。

---

## 十、GitHub Webhook

打开：https://github.com/chenminsay2025/homework/settings/hooks

**Add webhook**（若已有旧的可先 Delete 再建）：

| 项 | 值 |
|----|-----|
| Payload URL | 宝塔复制的 **完整** Webhook 地址 |
| Content type | `application/json` |
| SSL verification | **Disable**（与 id 站点一致；宝塔面板证书可能不被 GitHub 信任） |
| Events | Just the push event |
| Active | 勾选 |

保存后点 **Redeliver** 测试，应显示绿色 ✓。

---

## 十一、浏览器与数据

1. 打开 `https://homework.meituyin.cn`
2. F12 → Application → Local Storage → 删除 `homework_token`、`homework_current_plan_id`（若之前登录异常）
3. 用 **本地账号密码** 登录
4. 检查计划、课表、附件

---

## 十二、本机日常发布

```powershell
cd c:\Users\chmin\Desktop\app\homework-deploy-20260702-1954
git add .
git commit -m "说明"
git push origin main
```

约 1～3 分钟后：

- GitHub Webhook Delivery ✓
- 宝塔部署记录 **成功**
- 网站更新生效

**不会被 git 覆盖：** `.env`、`backend/homework.db`、`backend/uploads/`

---

## 十三、完整检查清单

```
备份
  [ ] /root/homework.env.bak
  [ ] /root/homework.db.bak
  [ ] /root/homework-uploads.bak.tar.gz

建站
  [ ] 新站点 homework.meituyin.cn
  [ ] SSL 已开启
  [ ] git clone HTTPS 成功
  [ ] .env / db / uploads 已恢复
  [ ] bash scripts/install.sh 成功

后端
  [ ] pm2 homework-api online
  [ ] curl 127.0.0.1:8002/api/health ok

Nginx
  [ ] root → frontend/dist
  [ ] /api 反代 8002（proxy_pass 无尾斜杠）
  [ ] try_files + client_max_body_size 100m
  [ ] https 域名 health ok + 登录页正常

Git 自动部署
  [ ] 宝塔 Git HTTPS 绑定 + 拉取成功
  [ ] 部署脚本含 chown + deploy-webhook.sh
  [ ] GitHub Webhook 完整 URL，SSL 验证关闭
  [ ] push 后部署记录「自动部署」成功
```

---

## 十四、常见问题

| 现象 | 处理 |
|------|------|
| `dubious ownership` | `git config --system --add safe.directory '*'` |
| GitHub Webhook SSL 失败 | Webhook 关闭 SSL verification |
| 域名 `/api/health` Not Found | `proxy_pass` 去掉末尾 `/` |
| 401 账号不存在 | `pm2 restart` + 清浏览器 token 重登 |
| 部署脚本找不到 | 先 `git pull` 或手动 clone 完整仓库 |
| 数据丢了 | 从 `/root/homework.*.bak` 恢复 |

---

## 十五、相关文件

| 文件 | 作用 |
|------|------|
| `scripts/install.sh` | 首次安装 |
| `scripts/update.sh` | 仅更新构建（Webhook 内由 deploy-webhook 调用） |
| `scripts/deploy-webhook.sh` | 宝塔部署脚本 |
| `deploy/pm2.ecosystem.config.cjs` | PM2 配置 |
| `deploy/nginx.example.conf` | Nginx 参考 |

更完整的说明见 **[宝塔服务器部署.md](./宝塔服务器部署.md)**。
