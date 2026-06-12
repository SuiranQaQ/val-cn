# 国服无畏契约战绩查询 — 官方 API 逻辑说明

## valcn.top 做了什么？

[valcn.top](https://valcn.top/) 本质是一个**付费封装层**，技术核心并不复杂：

```
用户输入 Name#Tag
    ↓
后台用「查询机器人」账号维持 Riot Token（约 1 小时过期）
    ↓
调用国服官方内部 API
    ↓
聚合数据 → 生成报告 / 快照 → 按权限收费展示
```

付费部分：账号系统、查询次数、报告分享、快照存储、权限分级。  
**API 本身是官方的，不需要付费。**

---

## 官方 API 基址

你从抓包看到的：

| 用途 | 方法 | 路径 |
|------|------|------|
| **UUID → Name#Tag** | `PUT` | `/name-service/v2/players`（body 是 PUUID 数组） |
| Name#Tag → UUID | — | **官方 pd 接口不提供**，需自建解析或借用 valcn 队列 |
| 比赛详情 | `GET` | `/match-details/v1/matches/{matchId}` |
| 比赛历史 | `GET` | `/match-history/v1/history/{subject}?startIndex=0&endIndex=20` |
| 段位变动 | `GET` | `/mmr/v1/players/{subject}/competitiveupdates?queue=competitive` |

**Base URL：** `https://alpha1-pd-redge.val.qq.com`

与国际服 `https://pd.ap.a.pvp.net` 是同一套接口，只是域名不同。  
文档参考：[Match Details](https://valapidocs.techchrism.me/endpoint/match-details) / [Match History](https://valapidocs.techchrism.me/endpoint/match-history)

---

## 必须的请求头

每个请求都要带：

```http
Authorization: Bearer <access_token>
X-Riot-Entitlements-JWT: <entitlements_jwt>
X-Riot-ClientVersion: release-china-12.11-shipping-12-4815700
X-Riot-ClientPlatform: <base64 编码的平台信息>
Content-Type: application/json
```

Token 来源：瓦罗兰特客户端登录后，客户端与 `alpha1-rso.val.qq.com` / `alpha1-entitlements.val.qq.com` 交互获得。  
参考：[valorant-api-docs - Riot Token](https://techchrism.github.io/valorant-api-docs/common-components.html)

---

## 完整查询流程

### 1. 解析玩家（Name#Tag → UUID）

⚠️ **不要**对 `name-service` 传 Name#Tag，它只接受 PUUID：

```http
PUT https://alpha1-pd-redge.val.qq.com/name-service/v2/players
Body: ["d281215c-4c7e-51fb-8bf5-fab6b62dfbe4"]   ← 只能是 UUID

Response: [{ "Subject": "...", "GameName": "风吹散", "TagLine": "58996" }]
```

独立做法（不依赖 valcn 付费后台）：

```http
# 本机客户端在运行时
POST https://127.0.0.1:{lockfile_port}/chat/v4/friendrequests
Body: { "game_name": "风吹散", "game_tag": "58996" }

GET https://127.0.0.1:{lockfile_port}/chat/v4/friendrequests
→ 从返回的 requests[].puuid 拿到 Subject
```

或尝试官方 account 接口（需自己的 Token）：

```http
GET https://alpha1-shared-redge.val.qq.com/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
```

### 2. 获取比赛历史

```http
GET https://alpha1-pd-redge.val.qq.com/match-history/v1/history/{subject}?startIndex=0&endIndex=20
```

返回 `History[].MatchID` 列表。

### 3. 获取段位信息

```http
GET https://alpha1-pd-redge.val.qq.com/mmr/v1/players/{subject}/competitiveupdates?startIndex=0&endIndex=20&queue=competitive
```

### 4. 逐场拉取比赛详情

```http
GET https://alpha1-pd-redge.val.qq.com/match-details/v1/matches/{matchId}
```

返回 players、teams、roundResults 等完整数据。

---

## 如何自己获取 Token？

### 方式 A：Fiddler / Charles 抓包（最快验证）

1. 安装 Fiddler，开启 HTTPS 解密
2. 启动瓦罗兰特客户端并登录
3. 在 Fiddler 里过滤 `alpha1-pd-redge.val.qq.com`
4. 复制任意请求的 Header：
   - `Authorization`
   - `X-Riot-Entitlements-JWT`
   - `X-Riot-ClientVersion`
   - `X-Riot-ClientPlatform`
5. 填入项目的 `.env.local`

### 方式 B：本机 lockfile（客户端运行时）

瓦罗兰特客户端运行时会在本地开启 API：

```
%LOCALAPPDATA%\Riot Games\Riot Client\Config\lockfile
格式: name:pid:port:password:protocol
```

程序读取 lockfile → 请求 `https://127.0.0.1:{port}/entitlements/v1/token` 自动拿 Token。

### 方式 C：服务器长期运行（最难）

valcn 的做法：后台常驻一个登录账号，定时刷新 Token。  
需要自己实现登录流程 + Token 刷新，复杂度高，且有账号风险。

---

## 本项目对应代码

| 文件 | 作用 |
|------|------|
| `src/lib/riot-session.ts` | Token 管理（env / lockfile） |
| `src/lib/riot.ts` | 官方 API 调用 |
| `src/lib/match-processor.ts` | 比赛数据解析 |
| `src/lib/stats.ts` | 队友统计、开黑记录计算 |
| `src/app/api/player/route.ts` | Name#Tag 查询接口 |
| `src/app/api/match/[id]/route.ts` | 单场比赛详情 |
| `src/app/api/session/route.ts` | 会话状态检测 |
