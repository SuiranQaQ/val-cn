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

Write-Host "==> Build Next.js standalone..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

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
if (Test-Path (Join-Path $Root "public")) {
  Copy-Item -Path (Join-Path $Root "public") -Destination (Join-Path $OutDir "public") -Recurse -Force
}

$RuntimeDir = Join-Path $OutDir "runtime"
Ensure-PortableNode -RuntimeDir $RuntimeDir | Out-Null

$EnvPath = Join-Path $OutDir ".env.local"
if (Test-Path (Join-Path $Root ".env.local")) {
  Copy-Item (Join-Path $Root ".env.local") $EnvPath
} else {
  @"
RIOT_PD_BASE=https://alpha1-pd-redge.val.qq.com
RIOT_SHARED_BASE=https://alpha1-shared-redge.val.qq.com
VALCN_FALLBACK=true
PORT=3000
"@ | Set-Content -Path $EnvPath -Encoding UTF8
}

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

Write-Host ""
Write-Host "Done: $OutDir" -ForegroundColor Green
Write-Host "Zip:  $ZipPath" -ForegroundColor Green
Write-Host "Main launcher: VAL-CN.vbs (opens browser UI)" -ForegroundColor Green
