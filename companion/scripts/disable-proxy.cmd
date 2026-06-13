@echo off
chcp 936 >nul
cd /d "%~dp0.."
echo 正在关闭 Windows 系统代理（Companion 127.0.0.1:17888）...
node -e "import('./lib/system-proxy.mjs').then(m=>{m.disableSystemProxy();console.log('已关闭系统代理');})"
echo.
echo 请刷新浏览器再试。若仍不行，重启浏览器或检查 设置 - 网络和 Internet - 代理。
pause
