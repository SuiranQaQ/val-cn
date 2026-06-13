# Portable Windows package -> release/VAL-CN/ (bundled Node, GBK docs, VBS launcher)
# Run: powershell -ExecutionPolicy Bypass -File scripts/package-local.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$NodeVersion = "20.19.2"
$Gbk = [System.Text.Encoding]::GetEncoding(936)

function Write-GbkFile {
  param([string]$Path, [string]$Content)
  [System.IO.File]::WriteAllText($Path, $Content, $Gbk)
}

function Write-AsciiFile {
  param([string]$Path, [string]$Content)
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.Encoding]::ASCII)
}

function Ensure-PortableNode {
  param([string]$RuntimeDir)

  New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
  $NodeExe = Join-Path $RuntimeDir "node.exe"
  if (Test-Path $NodeExe) { return $NodeExe }

  $CacheDir = Join-Path $Root "scripts\.cache"
  New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null

  $ZipName = "node-v$NodeVersion-win-x64.zip"
  $ZipPath = Join-Path $CacheDir $ZipName
  $ExtractDir = Join-Path $CacheDir "node-v$NodeVersion-win-x64"

  if (-not (Test-Path $ZipPath)) {
    $Url = "https://nodejs.org/dist/v$NodeVersion/$ZipName"
    Write-Host "==> Download Node.js $NodeVersion ..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing
  }

  if (-not (Test-Path $ExtractDir)) {
    Expand-Archive -Path $ZipPath -DestinationPath $CacheDir -Force
  }

  Copy-Item (Join-Path $ExtractDir "node.exe") $NodeExe -Force
  return $NodeExe
}

Write-Host "==> Build Next.js standalone (client mode)..." -ForegroundColor Cyan
$env:NEXT_PUBLIC_APP_MODE = "client"
$env:NEXT_PUBLIC_ELECTRON_SHELL = "1"
$env:NEXT_PUBLIC_SITE_URL = "https://valcn.suiran.xyz"
$PrevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npm.cmd run build
$buildCode = $LASTEXITCODE
$ErrorActionPreference = $PrevEap
Remove-Item Env:NEXT_PUBLIC_APP_MODE -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_ELECTRON_SHELL -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_SITE_URL -ErrorAction SilentlyContinue
if ($buildCode -ne 0) { throw "build failed" }

$OutDir = Join-Path $Root "release\VAL-CN"
if (Test-Path $OutDir) {
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Remove-Item -Recurse -Force $OutDir -ErrorAction SilentlyContinue
}
if (Test-Path $OutDir) {
  $Backup = Join-Path $Root ("release\VAL-CN-old-" + (Get-Date -Format "HHmmss"))
  Move-Item $OutDir $Backup -Force
}
New-Item -ItemType Directory -Path $OutDir | Out-Null

$Standalone = Join-Path $Root ".next\standalone"
if (-not (Test-Path $Standalone)) { throw "missing .next/standalone" }

Write-Host "==> Copy app files..." -ForegroundColor Cyan
Copy-Item -Path (Join-Path $Standalone "*") -Destination $OutDir -Recurse -Force
Copy-Item -Path (Join-Path $Root ".next\static") -Destination (Join-Path $OutDir ".next\static") -Recurse -Force

Write-Host "==> Prune dev artifacts from package..." -ForegroundColor Cyan
@(
  "src", "docs", "release", "scripts", "AGENTS.md", "CLAUDE.md",
  "eslint.config.mjs", "next.config.ts", "postcss.config.mjs",
  "ecosystem.config.cjs", "README.md", "session.example.json",
  "package-lock.json", "start-debug.bat", "start.bat", "companion"
) | ForEach-Object {
  $p = Join-Path $OutDir $_
  if (Test-Path $p) { Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue }
}
if (Test-Path (Join-Path $Root "public")) {
  Copy-Item -Path (Join-Path $Root "public") -Destination (Join-Path $OutDir "public") -Recurse -Force
  Remove-Item (Join-Path $OutDir "public\downloads") -Recurse -Force -ErrorAction SilentlyContinue
  $ClientVideo = Join-Path $OutDir "public\videos\home-bg.mp4"
  if (Test-Path $ClientVideo) {
    Remove-Item $ClientVideo -Force
    Write-Host "    (skipped website background video in client package)" -ForegroundColor DarkGray
  }
}

$RuntimeDir = Join-Path $OutDir "runtime"
Ensure-PortableNode -RuntimeDir $RuntimeDir | Out-Null

function Read-EnvValue {
  param([string]$FilePath, [string]$Key)
  if (-not (Test-Path $FilePath)) { return "" }
  foreach ($line in Get-Content $FilePath -Encoding UTF8) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith("#")) { continue }
    if ($t -match "^$([regex]::Escape($Key))=(.*)$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return ""
}

$EnvPath = Join-Path $OutDir ".env.local"
$ContribSecret = Read-EnvValue -FilePath (Join-Path $Root ".env.local") -Key "SESSION_POOL_CONTRIBUTE_SECRET"
if (-not $ContribSecret) {
  $ContribSecret = Read-EnvValue -FilePath (Join-Path $Root ".env.website.example") -Key "SESSION_POOL_CONTRIBUTE_SECRET"
}
$ClientEnv = @"
RIOT_PD_BASE=https://alpha1-pd-redge.val.qq.com
RIOT_SHARED_BASE=https://alpha1-shared-redge.val.qq.com
VALCN_FALLBACK=true
NEXT_PUBLIC_APP_MODE=client
NEXT_PUBLIC_SITE_URL=https://valcn.suiran.xyz
PORT=3000
HOSTNAME=127.0.0.1
"@
if ($ContribSecret) {
  $ClientEnv += "`nSESSION_POOL_CONTRIBUTE_SECRET=$ContribSecret"
}
Set-Content -Path $EnvPath -Value $ClientEnv.TrimEnd() -Encoding UTF8

$UsageText = Get-Content (Join-Path $Root "scripts\usage-zh.txt") -Raw -Encoding UTF8
# ASCII filename + GBK content: avoids zip/filename mojibake on Chinese Windows
Write-GbkFile -Path (Join-Path $OutDir "README.txt") -Content $UsageText

$MainVbs = @'
' VAL CN - open full web UI in browser (no console window)
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
node = dir & "\runtime\node.exe"
If Not fso.FileExists(node) Then
  MsgBox "Missing runtime\node.exe. Please extract the full zip.", vbCritical, "VAL CN"
  WScript.Quit 1
End If
sh.CurrentDirectory = dir
sh.Environment("PROCESS")("PORT") = "3000"
sh.Environment("PROCESS")("HOSTNAME") = "127.0.0.1"
sh.Environment("PROCESS")("NODE_ENV") = "production"
sh.Run """" & node & """ """ & dir & "\server.js""", 0, False
WScript.Sleep 2500
sh.Run "http://127.0.0.1:3000", 1, False
'@

$LiveVbs = @'
' VAL CN Live Match - open /live in browser
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
node = dir & "\runtime\node.exe"
If Not fso.FileExists(node) Then
  MsgBox "Missing runtime\node.exe", vbCritical, "VAL CN"
  WScript.Quit 1
End If
sh.CurrentDirectory = dir
sh.Environment("PROCESS")("PORT") = "3000"
sh.Environment("PROCESS")("HOSTNAME") = "127.0.0.1"
sh.Environment("PROCESS")("NODE_ENV") = "production"
sh.Run """" & node & """ """ & dir & "\server.js""", 0, False
WScript.Sleep 2500
sh.Run "http://127.0.0.1:3000/live", 1, False
'@

$StopBat = @'
@echo off
chcp 936 >nul
cd /d "%~dp0"
echo Stopping VAL CN on port 3000 ...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)
echo Done.
timeout /t 2 >nul
'@

$StartBat = @'
@echo off
chcp 936 >nul
cd /d "%~dp0"
wscript.exe //nologo "%~dp0VAL-CN.vbs"
'@

$StartLiveBat = @'
@echo off
chcp 936 >nul
cd /d "%~dp0"
wscript.exe //nologo "%~dp0VAL-CN-live.vbs"
'@

$CheckBat = @'
@echo off
chcp 936 >nul
cd /d "%~dp0"
echo.
echo ===== VAL CN 会话检查 =====
echo.
"%~dp0runtime\node.exe" "%~dp0check-session.mjs"
echo.
pause
'@

$DebugBat = @'
@echo off
chcp 936 >nul
cd /d "%~dp0"
echo.
echo ===== VAL CN 环境检查 =====
"%~dp0runtime\node.exe" "%~dp0check-session.mjs"
echo.
if errorlevel 2 (
  echo 检查未通过。仍要启动请按任意键，Ctrl+C 取消...
  pause >nul
)
echo ===== 启动服务（关闭本窗口即停止）=====
echo 浏览器: http://127.0.0.1:3000
echo.
start "" "http://127.0.0.1:3000"
set PORT=3000
set HOSTNAME=127.0.0.1
set NODE_ENV=production
"%~dp0runtime\node.exe" "%~dp0server.js"
pause
'@

Copy-Item (Join-Path $Root "scripts\check-session.mjs") (Join-Path $OutDir "check-session.mjs") -Force

Write-Host "==> Bundle Companion..." -ForegroundColor Cyan
$CompanionOut = Join-Path $OutDir "companion"
Copy-Item -Path (Join-Path $Root "companion") -Destination $CompanionOut -Recurse -Force
Remove-Item (Join-Path $CompanionOut "node_modules") -Recurse -Force -ErrorAction SilentlyContinue
Push-Location $CompanionOut
$PrevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& npm.cmd install --omit=dev 2>&1 | Out-Null
$npmCode = $LASTEXITCODE
$ErrorActionPreference = $PrevEap
Pop-Location
if ($npmCode -ne 0) { throw "companion npm install failed" }

$StartCompanionBat = @'
@echo off
chcp 936 >nul
cd /d "%~dp0companion"
echo VAL-CN Companion - 捕获 JWT 写入 session.json
echo 请先确保已运行 install-companion-ca.bat（首次）
echo.
"%~dp0runtime\node.exe" index.mjs --set-proxy
pause
'@

$InstallCompanionCaBat = @'
@echo off
chcp 936 >nul
cd /d "%~dp0companion\scripts"
call install-ca.cmd
pause
'@

$CompanionVbs = @'
' VAL CN Companion - MITM proxy (minimized console)
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
node = dir & "\runtime\node.exe"
companion = dir & "\companion\index.mjs"
If Not fso.FileExists(node) Then
  MsgBox "Missing runtime\node.exe", vbCritical, "VAL CN Companion"
  WScript.Quit 1
End If
If Not fso.FileExists(companion) Then
  MsgBox "Missing companion\index.mjs", vbCritical, "VAL CN Companion"
  WScript.Quit 1
End If
sh.CurrentDirectory = dir & "\companion"
sh.Run """" & node & """ """ & companion & """ --set-proxy", 1, False
'@

Write-GbkFile -Path (Join-Path $OutDir "start-companion.bat") -Content $StartCompanionBat
Write-GbkFile -Path (Join-Path $OutDir "install-companion-ca.bat") -Content $InstallCompanionCaBat
Write-AsciiFile -Path (Join-Path $OutDir "VAL-CN-companion.vbs") -Content $CompanionVbs

Write-AsciiFile -Path (Join-Path $OutDir "VAL-CN.vbs") -Content $MainVbs
Write-AsciiFile -Path (Join-Path $OutDir "VAL-CN-live.vbs") -Content $LiveVbs
Write-GbkFile -Path (Join-Path $OutDir "stop.bat") -Content $StopBat
Write-GbkFile -Path (Join-Path $OutDir "start.bat") -Content $StartBat
Write-GbkFile -Path (Join-Path $OutDir "start-live.bat") -Content $StartLiveBat
Write-GbkFile -Path (Join-Path $OutDir "check.bat") -Content $CheckBat
Write-GbkFile -Path (Join-Path $OutDir "VAL-CN-debug.bat") -Content $DebugBat

$UrlShortcut = @"
[InternetShortcut]
URL=http://127.0.0.1:3000
IconIndex=0
"@
Write-AsciiFile -Path (Join-Path $OutDir "VAL-CN.url") -Content $UrlShortcut

Write-Host "==> Create zip..." -ForegroundColor Cyan
$ZipPath = Join-Path $Root "release\VAL-CN-portable.zip"
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path $OutDir -DestinationPath $ZipPath -Force

$DownloadDir = Join-Path $Root "public\downloads"
New-Item -ItemType Directory -Path $DownloadDir -Force | Out-Null
$DownloadZip = Join-Path $DownloadDir "VAL-CN-portable.zip"
Copy-Item $ZipPath $DownloadZip -Force
$ZipMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
Write-Host "    Website download: public/downloads/VAL-CN-portable.zip ($ZipMb MB)" -ForegroundColor DarkGray

Write-Host ""
Write-Host "Done: $OutDir" -ForegroundColor Green
Write-Host "Zip:  $ZipPath" -ForegroundColor Green
Write-Host "Main launcher: VAL-CN.vbs (opens browser UI)" -ForegroundColor Green
