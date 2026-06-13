# Companion 与反作弊 / 误判说明

VAL-CN / VALBOX **不是外挂、不作弊、不修改游戏内存或进程**。

## 我们做什么

| 行为 | 说明 |
|------|------|
| HTTPS 代理（Companion） | 仅为了读取**本机**客户端访问 Riot 国服 API 时的 JWT，写入 `%LOCALAPPDATA%\VAL-CN\session.json` |
| 官方 API 查询 | 用上述 Token 调用与游戏客户端相同的 REST 接口（战绩、对局认人等） |
| 不做什么 | 不注入 DLL、不读写游戏内存、不改包、不自动操作游戏、不提供透视/自瞄 |

## 降低误判的处理（v2025.06）

1. **PAC 选择性代理（默认）**  
   开启 `--set-proxy` 时不再把**整台电脑**流量都送进 MITM，而是使用 `val-cn-proxy.pac`：
   - **走代理**：`*pd-redge*`、`*glz-redge*`、`*shared-redge*`、`*entitlements*`（`.val.qq.com`）
   - **直连**：`tc-anticheat`、collector、latency、ap-public 及所有非上述 Riot API 域名

2. **已取消全局 API 录包**  
   不再记录全部 `*.val.qq.com` 流量，仅保留对局认人白名单 URL 的调试日志。

3. **退出即关闭**  
   关闭 Companion 窗口会清除 PAC 代理设置。

4. **根证书**  
   仍需安装一次自签 CA 才能解密上述 Riot API 的 HTTPS；仅用于本地 Companion，不上传服务器。

## 仍无法保证的内容

- 安装根证书 + 局部 MITM 在理论上仍可能被安全软件或反作弊标记，**无法 100% 保证不封号**。
- 是否处罚取决于腾讯 / Riot 策略；请自行评估风险，**主号请谨慎**。
- 若担心风险，可使用网站公开 Token 池查战绩（`/live` 对局认人仍需本机 Companion）。

## 与「作弊软件」的区别

| | 作弊 / 外挂 | VAL-CN Companion |
|--|-------------|------------------|
| 修改游戏 | 是 | **否** |
| 读取内存 | 常见 | **否** |
| 注入代码 | 常见 | **否** |
| 网络 | 改包 / 伪造 | 只读官方 HTTPS API 响应 |
| 目的 | 获得不公平优势 | 战绩查询、对局认人 |

如有误判投诉，本项目为开源，可自行审计 `companion/` 目录全部源码。
