# 服务器部署指南

## 部署前必读

| 功能 | 服务器上 | 本机 `npm run dev` |
|------|----------|-------------------|
| 查战绩 / 报告页 | ✅ 需配置 JWT 或 valcn 后备 | ✅ |
| 名字解析（中文） | ✅ valcn 队列或 Riot account | ✅ 可开游戏用好友接口 |
| **对局认人 `/live`** | ❌ **不可用**（读不到你电脑的 lockfile） | ✅ |

服务器是 **Linux**，无法读取 Windows 瓦罗兰特客户端。对局功能请继续在本机用浏览器打开 `/live`。

---

## 要不要装宝塔？

**不必须。** 二选一即可：

| 方式 | 适合 |
|------|------|
| **命令行 + PM2 + Nginx** | 会 SSH，按本文操作 |
| **宝塔面板** | 习惯图形界面，用「Node 项目」+「网站反向代理」 |

宝塔只是省得手写 Nginx 配置，不是硬性要求。

---

## 服务器要求

- 系统：Ubuntu 22.04 / Debian 12 / CentOS 7+ 等
- 内存：≥ 1GB（建议 2GB）
- Node.js：**20.x 或 22.x**（不要用 18）
- 域名 + HTTPS（可选但推荐）

---

## 一、命令行部署（推荐）

### 1. 安装 Node.js 20

```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

node -v   # 应 >= v20
npm -v
```

### 2. 上传代码

```bash
sudo mkdir -p /www/val-cn
sudo chown $USER:$USER /www/val-cn
cd /www/val-cn

# 方式 A：git 克隆（若你有仓库）
# git clone <你的仓库地址> .

# 方式 B：本机打包上传
# 在 Windows 项目目录打包 val-cn 文件夹（不要带 node_modules、.next）
# 用 scp / SFTP 传到 /www/val-cn
```

```bash
cd /www/val-cn
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env.production
nano .env.production
```

**公网部署建议至少填写：**

```env
RIOT_PD_BASE=https://alpha1-pd-redge.val.qq.com
RIOT_SHARED_BASE=https://alpha1-shared-redge.val.qq.com

# 抓包得到的 Token（约 1 小时过期，需定期更新）
RIOT_ACCESS_TOKEN=eyJ...
RIOT_ENTITLEMENTS_JWT=eyJ...
RIOT_CLIENT_VERSION=release-china-12.11-shipping-12-4815700

# 没自填 Token 时可借用 valcn（不如自己的 Token 稳）
VALCN_FALLBACK=true

# 生产端口（默认 3000）
PORT=3000
```

构建时 Next 会读取 `.env.production`。

### 4. 构建并启动

```bash
cd /www/val-cn
npm run build
```

安装 PM2（进程守护）：

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # 按提示执行一行 sudo 命令，开机自启
```

检查：

```bash
pm2 status
curl -s http://127.0.0.1:3000/api/diagnostics | head
```

### 5. Nginx 反向代理

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/val-cn
```

```nginx
server {
    listen 80;
    server_name 你的域名.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/val-cn /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

HTTPS（Let's Encrypt）：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名.com
```

---

## 二、宝塔面板部署

1. 安装宝塔 → 安装 **Nginx**、**PM2 管理器**（或 Node 版本管理器装 Node 20）
2. 网站 → 添加站点 → 填域名
3. 文件 → 上传 `val-cn` 代码到例如 `/www/wwwroot/val-cn`
4. 终端：

   ```bash
   cd /www/wwwroot/val-cn
   npm install
   cp .env.example .env.production
   # 编辑 .env.production 填入 Token
   npm run build
   pm2 start ecosystem.config.cjs
   pm2 save
   ```

5. 网站 → 设置 → 反向代理 → 目标 `http://127.0.0.1:3000`
6. SSL → Let's Encrypt 申请证书

---

## 三、更新版本

```bash
cd /www/val-cn
# git pull 或重新上传代码
npm install
npm run build
pm2 restart val-cn
```

---

## 四、常见问题

**`session_ok: false`**  
→ `.env.production` 里 Token 过期或没填，重新抓包更新后 `pm2 restart val-cn`。

**名字解析失败**  
→ 开 `VALCN_FALLBACK=true`，或确保 Token 有效。

**对局认人显示需要客户端**  
→ 正常，服务器上本来就没有游戏，请在本机访问 `/live`。

**构建内存不足**  
→ 加 swap 或本地构建好 `.next` 再上传（不推荐长期这样做）。

---

## 五、安全提醒

- 不要把 `.env.production` 提交到 Git
- JWT 相当于账号会话，不要泄露
- 公网站点建议加访问限制或仅自用域名
