# 带日志一键启动（开发机）
# 用法: powershell -ExecutionPolicy Bypass -File scripts/start-debug.ps1

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host ""
Write-Host "=== 1/2 环境检查 ===" -ForegroundColor Cyan
& node scripts/check-session.mjs
$checkCode = $LASTEXITCODE

Write-Host ""
if ($checkCode -eq 2) {
  Write-Host "检查未通过。仍要启动请按任意键继续，Ctrl+C 取消..." -ForegroundColor Yellow
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} elseif ($checkCode -ne 0) {
  Write-Host "检查有警告，3 秒后启动..." -ForegroundColor Yellow
  Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "=== 2/2 启动开发服务（关闭本窗口即停止）===" -ForegroundColor Cyan
Write-Host "浏览器: http://127.0.0.1:3000" -ForegroundColor Green
Write-Host ""

Start-Process "http://127.0.0.1:3000"
npm run dev
