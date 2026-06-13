# 国服会话方案（无 lockfile、无手抓包）

国服 WeGame 安装**通常没有** Riot Client / lockfile，JWT 也不会落在磁盘上。  
官方 API 又**必须**带 `Authorization` + `X-Riot-Entitlements-JWT`，所以没有「完全不要 Token」这回事。

## 现实结论

| 方案 | 用户要做什么 | 适合场景 |
|------|----------------|----------|
| **公开后备（默认）** | 无 | 网站查战绩、解析 Name#Tag |
| **本地 session 文件** | 装一次伴生小工具 | 想用自己的 Token、更稳定 |
| **自建 Token 池** | 服务器挂一台常开游戏的机器 | 不想依赖 valcn.top |
| lockfile | 国际服 / 极少数国服 | 本项目仅作兜底 |
| 手抓 Fiddler | 已取消推荐 | 维护成本太高 |

和 valcn.top 付费服务的区别：**他们卖的是 Token 池 + 后台**；技术上是同一类官方 API。  
本项目默认直接借用公开 Token 池（`VALCN_FALLBACK=true`），**零配置就能用**。

## 默认路径（推荐）

`.env` 里**不用填任何 Token**，保持：

```env
VALCN_FALLBACK=true
```

程序会：

1. 从 `https://valcn.top/api/session/latest`（或 `RIOT_SESSION_URL`）取会话
2. 调 `alpha1-pd-redge.val.qq.com` / `alpha1-shared-redge.val.qq.com`
3. Name#Tag 走 Riot 账号接口 + 公开名字队列

访问 `/api/diagnostics` 应看到 `session_source: "fallback"`。

## 伴生程序 Companion（国服推荐，已实现）

国服 ACLOS **没有 lockfile**，自动拿 Token 的可行方案是 **HTTPS 代理 MITM**（与 5E-BOX 同类，不注入游戏）。

项目内已提供 `companion/`：

```powershell
cd companion && npm install
npm start                    # 首次：生成证书后 Ctrl+C
npm run install-ca           # 管理员：安装根证书
npm start -- --set-proxy     # 开代理 → 再开游戏
```

捕获后写入：

**路径（默认）：** `%LOCALAPPDATA%\VAL-CN\session.json`

**格式：**

```json
{
  "access_token": "eyJ...",
  "entitlements_jwt": "eyJ...",
  "client_version": "release-china-12.11-shipping-12-4815700",
  "updated_at": "2026-06-12T12:00:00.000Z"
}
```

或通过环境变量指定：

```env
RIOT_SESSION_FILE=D:\path\to\session.json
```

VAL-CN 会优先读该文件，无需改 `.env`、无需手抓包。

## 自建 Token 池（进阶）

一台 Windows 常开游戏 + 伴生工具写 `session.json`，再：

- 用简单 HTTP 服务暴露 `GET /api/session/latest`（格式同 valcn）
- 服务器 `.env.production` 设置 `RIOT_SESSION_URL=https://你的内网地址/api/session/latest`

这样完全不依赖第三方公开池。

## `/live` 对局认人

仍需要本机游戏进程 + 本地 API（lockfile 或伴生工具连本机端口）。  
国服多数环境**做不了**，除非单独做 Windows 伴生程序。

## 其他方案（不推荐 / 不可用）

| 方案 | 国服 ACLOS |
|------|------------|
| lockfile 本地 API | ❌ 无 lockfile |
| ACLOS GameProxy `GetSession` IPC | ❌ 腾讯内部接口，日志打码，未公开 |
| 内存注入 | ❌ 禁止 |
| 手抓 Fiddler | ❌ 已取消推荐 |
| 公开 Token 池 | ✅ 查别人战绩，非自己的 Token |
