# VAL CN 桌面客户端

Electron 壳：内嵌窗口 + 系统托盘 + 后台静默启动 Companion 与战绩站。

## 开发环境运行

> **PowerShell 报「禁止运行脚本」？** 用 `npm.cmd run desktop`，或双击项目根目录 **`desktop.cmd`**。

```powershell
cd val-cn

# PowerShell 推荐（绕过 npm.ps1 限制）
npm.cmd run desktop

# 或双击 desktop.cmd
```

# 1. 安装 Companion 依赖（首次）
cd companion
npm install
cd ..

# 2. 安装桌面壳依赖（首次）
cd desktop
npm install
cd ..

# 3. 以开发模式启动（自动 npm run dev + Companion）
npm run desktop
```

首次会提示安装 Companion 根证书 → 右键 `companion\scripts\install-ca.cmd` **以管理员身份运行**。

## 使用便携包 + 桌面壳

先打客户端包，再用生产模式启动 Electron：

```powershell
npm run package:local
$env:VALCN_APP_ROOT = "$PWD\release\VAL-CN"
cd desktop
npm start
```

## 功能（阶段 1）

| 功能 | 说明 |
|------|------|
| 内嵌窗口 | 不再手动开浏览器 |
| 系统托盘 | 关闭窗口最小化到托盘 |
| 静默 Companion | 自动 `--set-proxy`，无黑窗口 |
| 退出清理 | 自动关闭系统代理 |

托盘菜单：打开主页、对局认人、安装证书、退出。

## 与 5E-BOX 对比

同类 MITM 抓 Token，UI 复用现有 Next 客户端页面。后续阶段：首次向导、自动更新、安装包 exe。
