# VAL CN — 无畏契约国服战绩查询（官方 API 直连）

不依赖 [valcn.top](https://valcn.top/) 付费账号，直接调用国服官方内部 API。

**API 基址：** `https://alpha1-pd-redge.val.qq.com`

> **安全说明：** 本项目不是外挂，不注入、不读内存。Companion 使用 **PAC 选择性代理**，仅 Riot 国服 API 走本地 MITM 以捕获 JWT；反作弊（`tc-anticheat`）等流量**直连**。详见 [docs/ANTICHEAT-SAFETY.md](docs/ANTICHEAT-SAFETY.md)。仍无法 100% 保证不被误判，主号请谨慎。

## 国服怎么用

### 方式 A：内置 Companion（推荐，自己的 Token）

国服 ACLOS **没有 lockfile**。项目内置 `companion/`，通过 HTTPS 代理截 JWT 写入 `session.json`（不注入游戏）。

```bash
cd val-cn
npm install
cd companion && npm install && cd ..

# 首次（管理员）：companion\scripts\install-ca.cmd
npm run companion -- --set-proxy   # PAC 代理，仅 Riot API
npm run dev                        # 再开战绩站
```

首页 **「内置伴生 Companion」** 面板会显示捕获状态与 Token 更新时间。

**功能概览（2025.06）：**

- 对局认人 `/live`、LiveMatch 对阵 UI、段位与胜率展示
- 行为防护提示（基于官方 restrictions / 赛后行为数据，非实时反作弊）
- Companion 白名单流量日志（开发调试用，非全局录包）

### 方式 B：零配置公开池

```bash
npm run dev
```

不跑 Companion 也能查战绩，但用的是公开 Token 池。

详细说明见 [docs/CN-SESSION.md](docs/CN-SESSION.md)

### 便携版

```bash
npm run package:local
```

生成 `release/VAL-CN-portable.zip`，内含：
- `VAL-CN.vbs` — 战绩站
- `start-companion.bat` / `install-companion-ca.bat` — 内置伴生

## 环境变量（可选）

默认 `.env` **可以为空**。仅在你想自建 Token 池或关掉公开后备时才需要改：

```env
RIOT_PD_BASE=https://alpha1-pd-redge.val.qq.com
RIOT_SHARED_BASE=https://alpha1-shared-redge.val.qq.com
# VALCN_FALLBACK=false   # 关掉后必须自己提供 Token
```

检测会话：http://localhost:3000/api/diagnostics

## 部署到服务器

生产环境保持 `VALCN_FALLBACK=true`（默认），**不用填 JWT**。

- 战绩查询：Linux 服务器即可
- **对局认人 `/live`**：需本机游戏 + 本地 API，国服多数环境不可用

详见 [docs/DEPLOY.md](docs/DEPLOY.md)

## 官方 API 调用链

```
Name#Tag
  → Riot account / 公开名字队列     解析玩家 UUID
  → GET /match-history/v1/history/{uuid}
  → GET /mmr/v1/players/{uuid}/competitiveupdates
  → GET /match-details/v1/matches/{id}
```

更多细节见 [docs/API-FLOW.md](docs/API-FLOW.md)

## 与 valcn 的区别

| | valcn.top | 本项目 |
|--|-----------|--------|
| 比赛/段位 API | 官方 pd 接口 | 同样的官方接口 |
| Token | 他们维护的池子（付费） | 默认用公开池（免费） |
| Name#Tag | 他们后台队列 | Riot 账号接口 + 公开队列 |
| 费用 | 付费 | 免费 |

## 技术栈

Next.js 16 · TypeScript · Tailwind CSS · Recharts
