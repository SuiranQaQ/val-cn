# VAL CN — 无畏契约国服战绩查询（官方 API 直连）

不依赖 [valcn.top](https://valcn.top/) 付费服务，直接调用国服官方内部 API。

**API 基址：** `https://alpha1-pd-redge.val.qq.com`

## 快速开始（独立运行，不依赖 valcn）

```bash
cd val-cn
npm install
npm run dev
```

**推荐**：先启动瓦罗兰特客户端并登录，再打开 http://localhost:3000 查询。  
程序会自动读 lockfile 拿 Token，并通过本机好友接口解析 Name#Tag。

或：用 Fiddler 抓包，把 Token 填入 `.env.local`（见 `.env.example`）。

### 便携版（游戏电脑免安装，推荐）

在开发机执行一次：

```bash
npm run package:local
```

生成：

- `release/VAL-CN/` — 整个文件夹拷到游戏电脑
- `release/VAL-CN-portable.zip` — 解压即用

游戏电脑上双击 **`start.bat`**；对局认人先开瓦罗兰特，再双击 **`start-live.bat`**。  
**无需安装 Node.js**（已内置 `runtime/node.exe`）。

## 配置 Token

用 Fiddler 抓取瓦罗兰特客户端对 `alpha1-pd-redge.val.qq.com` 的请求，把 Header 填入 `.env.local`：

```env
RIOT_PD_BASE=https://alpha1-pd-redge.val.qq.com
RIOT_ACCESS_TOKEN=eyJraWQiOiJzMSIs...
RIOT_ENTITLEMENTS_JWT=eyJraWQiOiJrMSIs...
RIOT_CLIENT_VERSION=release-china-12.11-shipping-12-4815700
```

或者：**启动瓦罗兰特客户端**，程序会自动读取 lockfile 获取 Token。

检测会话：访问 http://localhost:3000/api/session

## 部署到服务器

- 战绩查询可部署到 Linux 服务器（需在 `.env.production` 配置 JWT 或开启 valcn 后备）
- **对局认人 `/live` 只能本机使用**（需 Windows 客户端 + lockfile）
- 详细步骤见 [docs/DEPLOY.md](docs/DEPLOY.md)（命令行或宝塔均可，**不必强装宝塔**）

## 官方 API 调用链

```
Name#Tag
  → 本机 POST /chat/v4/friendrequests      解析玩家 UUID（开着客户端）
  → GET /match-history/v1/history/{uuid}  比赛列表
  → PUT /name-service/v2/players            仅用于 UUID→名字，不能反查
  → GET /mmr/v1/players/{uuid}/competitiveupdates  段位
  → GET /match-details/v1/matches/{id}    每场详情
```

详细说明见 [docs/API-FLOW.md](docs/API-FLOW.md)

## 与 valcn 的区别

| | valcn.top | 本项目 |
|--|-----------|--------|
| 比赛/段位 API | 官方 pd 接口 | 同样的官方接口 |
| Name#Tag 解析 | 他们后台队列（付费） | **本机客户端好友接口** |
| Token | 他们的机器人 | **你自己的**（lockfile 或抓包） |
| 费用 | 付费 | 免费 |

## 技术栈

Next.js 16 · TypeScript · Tailwind CSS · Recharts
