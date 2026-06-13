# 双端发布清单

## 一、官网（Linux 服务器）

```powershell
cd val-cn
npm run package:website
```

产物：
- `release/VAL-CN-website.zip` — **上传服务器解压部署**
- `release/VAL-CN-website/` — 本地检查目录

包内包含：standalone 构建、`public/videos/home-bg.mp4`、可选 `public/downloads/VAL-CN-portable.zip`。

服务器步骤：

```bash
unzip VAL-CN-website.zip
cd VAL-CN-website
cp .env.production.example .env.production
# 编辑 .env.production，填入 SESSION_POOL_* 密钥（node scripts/generate-pool-secrets.mjs）
mkdir -p data
pm2 start ecosystem.config.cjs
```

详见 `docs/DEPLOY.md`。

---

## 二、Windows 客户端（本机）

```powershell
npm run package:local
```

产物：`release/VAL-CN-portable.zip`（约 200MB，含内置 Node）

**安全：** Companion 使用 PAC 仅代理 Riot API，反作弊直连；见 [ANTICHEAT-SAFETY.md](ANTICHEAT-SAFETY.md)。

打包后复制到官网包或服务器 `public/downloads/` 供下载页使用。

---

## 三、Windows 桌面壳（Electron）

```powershell
cd val-cn
npm run desktop:install   # 首次
npm run desktop           # 开发模式：内嵌窗口 + 托盘 + Companion
```

详见 `docs/DESKTOP.md`。

---

## 四、构建模式区别

| | 官网 | 客户端 |
|--|------|--------|
| 命令 | `npm run package:website` | `npm run package:local` |
| 模式 | `NEXT_PUBLIC_APP_MODE=website` | `client` |
| 背景视频 | ✅ | ❌ |
| Companion | ❌ | ✅ |
| 内置 Node | ❌（服务器自有 Node） | ✅ |
