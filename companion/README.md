# VAL-CN Companion

国服 ACLOS 环境下，瓦罗兰特 **没有 lockfile**，JWT 只出现在 HTTPS 流量里。  
Companion 用 **PAC 选择性代理 + 本地根证书 MITM** 截获 Token，写入 `session.json`，供 VAL-CN 自动读取。

**不注入游戏进程**，只处理网络层。反作弊（`tc-anticheat`）等域名在 PAC 中 **直连**，不经过 MITM。

完整说明见 [docs/ANTICHEAT-SAFETY.md](../docs/ANTICHEAT-SAFETY.md)。

## 原理

```
瓦罗兰特 → HTTPS
    ├─ Riot API (pd/glz/shared/entitlements) → 127.0.0.1:17888 (Companion MITM)
    │                    ↓ 读 Header
    │         Authorization + X-Riot-Entitlements-JWT
    │                    ↓
    │         %LOCALAPPDATA%\VAL-CN\session.json
    └─ 反作弊 / 遥测 / 其它域名 → DIRECT（不代理）
                         ↓
              VAL-CN (riot-session.ts 优先读文件)
```

## 首次使用

```powershell
cd companion
npm install

# 1. 生成根证书（运行几秒后 Ctrl+C 即可）
npm start

# 2. 管理员 PowerShell 安装证书
npm run install-ca

# 3. 正式运行（PAC 代理，仅 Riot API）
npm start -- --set-proxy
```

或在项目根目录：

```powershell
npm run companion -- --set-proxy
npm run companion:install-ca   # 需管理员
```

## 日常使用

1. **先** 启动 Companion（`--set-proxy`）
2. **再** 开 ACLOS / 瓦罗兰特，进大厅
3. 控制台出现 `[capture]` 表示已写入
4. 启动 VAL-CN：`npm run dev`（会自动读 `session.json`）

验证：

```powershell
npm run check:session
# 应显示 Token 来源: 本地 session 文件
```

## 选项

| 参数 | 说明 |
|------|------|
| `--set-proxy` | 启用 PAC（仅 Riot 国服 API 走 `127.0.0.1:17888`，退出时清除） |
| `--port 17888` | 自定义端口（勿与 5E-BOX 8090 同时占用） |

## 注意

- **不要与 5E-BOX 同时开代理**（都会改系统/PAC 代理，端口冲突）
- 首次必须 **安装根证书**，否则游戏 HTTPS 无法解密
- Token 约 1 小时过期，开着 Companion + 游戏会自动刷新
- `/live` 对局认人仍需本机 API，Companion 只解决 **JWT / 查战绩**
- 已取消全局 `*.val.qq.com` 录包；对局相关仅白名单 URL 调试日志

## 对局流量探针（开发用）

Companion 会**被动记录**可能与对局认人相关的 HTTPS 流量（不改包、不注入）：

1. 照常 `--set-proxy` 启动 Companion
2. 开游戏，**进入选人或对局**
3. 控制台出现 `[live-traffic]`；若 JSON 含 10 人列表会打印 `★ snapshot`
4. 查看文件：

| 路径 | 内容 |
|------|------|
| `%LOCALAPPDATA%\VAL-CN\live-traffic.log` | 请求/响应 URL 时间线 |
| `%LOCALAPPDATA%\VAL-CN\live-snapshots\` | 含 Players 的 JSON 快照（最多保留 30 个） |

VALBOX 客户端 `/api/diagnostics` 也会显示 `live_traffic.snapshot_count`。

确认 URL 后，再据此实现国服 `/live` 数据源（下一步）。

## 文件位置

| 路径 | 内容 |
|------|------|
| `%LOCALAPPDATA%\VAL-CN\session.json` | 捕获的 Token |
| `%LOCALAPPDATA%\VAL-CN\certs\val-cn-ca.pem` | 根证书（安装用） |
| `%LOCALAPPDATA%\VAL-CN\val-cn-proxy.pac` | PAC 规则（仅 Riot API 走代理） |
