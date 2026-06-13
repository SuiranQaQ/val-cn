# 从国服客户端复制主菜单背景视频到 public/videos/home-bg.mp4
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path $Root "public\videos\home-bg.mp4"
$Candidates = @(
  "F:\Tencent Games\VALORANT\live\ShooterGame\Content\Movies\Menu\HomeScreen_CN_OB.mp4",
  "C:\Tencent Games\VALORANT\live\ShooterGame\Content\Movies\Menu\HomeScreen_CN_OB.mp4",
  "$env:PROGRAMFILES\Tencent\VALORANT\live\ShooterGame\Content\Movies\Menu\HomeScreen_CN_OB.mp4"
)

$Src = $Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Src) {
  Write-Host "未找到 HomeScreen_CN_OB.mp4，请手动指定游戏安装路径。" -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path (Split-Path $Out) | Out-Null
Copy-Item $Src $Out -Force
$Mb = [math]::Round((Get-Item $Out).Length / 1MB, 1)
Write-Host "已复制: $Out ($Mb MB)" -ForegroundColor Green
