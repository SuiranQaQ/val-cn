# 官网 Linux 部署包 -> release/VAL-CN-website/
# Run: powershell -ExecutionPolicy Bypass -File scripts/package-website.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$LogoPath = Join-Path $Root "public\brand\valorant-cn-logo.png"
if (Test-Path $LogoPath) {
  Write-Host "==> Ensure logo transparency..." -ForegroundColor Cyan
  python (Join-Path $Root "scripts\process-logo.py") $LogoPath $LogoPath 2>$null
}

$VideoPath = Join-Path $Root "public\videos\home-bg.mp4"
if (-not (Test-Path $VideoPath)) {
  Write-Host "==> Copy background video from game..." -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\copy-home-video.ps1")
  if (-not (Test-Path $VideoPath)) {
    Write-Warning "未找到 home-bg.mp4，官网背景视频将缺失。可稍后运行 scripts/copy-home-video.ps1"
  }
}

Write-Host "==> Build Next.js standalone (website mode)..." -ForegroundColor Cyan
$env:NEXT_PUBLIC_APP_MODE = "website"
$env:NEXT_PUBLIC_SITE_URL = "https://valcn.suiran.xyz"
$PrevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npm.cmd run build
$buildCode = $LASTEXITCODE
$ErrorActionPreference = $PrevEap
Remove-Item Env:NEXT_PUBLIC_APP_MODE -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_SITE_URL -ErrorAction SilentlyContinue
if ($buildCode -ne 0) { throw "build failed" }

$OutDir = Join-Path $Root "release\VAL-CN-website"
if (Test-Path $OutDir) {
  Remove-Item -Recurse -Force $OutDir -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $OutDir | Out-Null

$Standalone = Join-Path $Root ".next\standalone"
if (-not (Test-Path $Standalone)) { throw "missing .next/standalone" }

Write-Host "==> Copy standalone app..." -ForegroundColor Cyan
Copy-Item -Path (Join-Path $Standalone "*") -Destination $OutDir -Recurse -Force
Copy-Item -Path (Join-Path $Root ".next\static") -Destination (Join-Path $OutDir ".next\static") -Recurse -Force

@(
  "src", "docs", "release", "scripts", "companion", "AGENTS.md", "CLAUDE.md",
  "eslint.config.mjs", "next.config.ts", "postcss.config.mjs",
  "ecosystem.config.cjs", "README.md", "session.example.json",
  "package-lock.json", "start-debug.bat", "start.bat", "tsconfig.tsbuildinfo"
) | ForEach-Object {
  $p = Join-Path $OutDir $_
  if (Test-Path $p) { Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue }
}

if (Test-Path (Join-Path $Root "public")) {
  $PubOut = Join-Path $OutDir "public"
  New-Item -ItemType Directory -Path $PubOut -Force | Out-Null
  Get-ChildItem (Join-Path $Root "public") -Force | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $PubOut -Recurse -Force
  }
}

$ClientZip = Join-Path $Root "release\VAL-CN-portable.zip"
if (Test-Path $ClientZip) {
  $DlDir = Join-Path $OutDir "public\downloads"
  New-Item -ItemType Directory -Path $DlDir -Force | Out-Null
  Copy-Item $ClientZip (Join-Path $DlDir "VAL-CN-portable.zip") -Force
  Write-Host "    (bundled client download zip)" -ForegroundColor DarkGray
}

# 清理误生成的 public/public（旧包兼容）
$NestedPublic = Join-Path $OutDir "public\public"
if (Test-Path $NestedPublic) {
  Get-ChildItem $NestedPublic -Force | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination (Join-Path $OutDir "public") -Recurse -Force
  }
  Remove-Item $NestedPublic -Recurse -Force
}

New-Item -ItemType Directory -Path (Join-Path $OutDir "data") -Force | Out-Null
if (-not (Test-Path (Join-Path $OutDir "data\.gitkeep"))) {
  New-Item -ItemType File -Path (Join-Path $OutDir "data\.gitkeep") | Out-Null
}

$EnvExample = Join-Path $Root ".env.website.example"
$EnvOut = Join-Path $OutDir ".env.production.example"
if (Test-Path $EnvExample) {
  Copy-Item $EnvExample $EnvOut
} else {
  Copy-Item (Join-Path $Root ".env.example") $EnvOut
}

$EcosystemSrc = Join-Path $Root "scripts\pm2-ecosystem-website.cjs"
if (Test-Path $EcosystemSrc) {
  Copy-Item $EcosystemSrc (Join-Path $OutDir "ecosystem.config.cjs")
  Copy-Item $EcosystemSrc (Join-Path $OutDir "scripts\pm2-ecosystem-website.cjs")
  Copy-Item (Join-Path $Root "scripts\fix-server-pool-env.sh") (Join-Path $OutDir "scripts\fix-server-pool-env.sh") -ErrorAction SilentlyContinue
} else {
$Ecosystem = @'
/** PM2: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "val-cn-website",
      cwd: __dirname,
      script: "server.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
'@
[System.IO.File]::WriteAllText((Join-Path $OutDir "ecosystem.config.cjs"), $Ecosystem)
}

$StartMd = @'
# VAL CN website — server start

1. cp .env.production.example .env.production and fill secrets
2. pm2 start ecosystem.config.cjs
3. Nginx reverse proxy to port 3000

Persist data/session-pool.json (token pool).
'@
[System.IO.File]::WriteAllText((Join-Path $OutDir "START.md"), $StartMd, [System.Text.UTF8Encoding]::new($false))

Copy-Item (Join-Path $Root "scripts\deploy-website-standalone.sh") (Join-Path $OutDir "deploy.sh") -Force

Write-Host "==> Create deploy archive..." -ForegroundColor Cyan
$TarZip = Join-Path $Root "release\VAL-CN-website.zip"
if (Test-Path $TarZip) { Remove-Item $TarZip -Force }
Compress-Archive -Path $OutDir -DestinationPath $TarZip -Force
$Mb = [math]::Round((Get-Item $TarZip).Length / 1MB, 1)

Write-Host ""
Write-Host "Done: $OutDir" -ForegroundColor Green
Write-Host "Upload: $TarZip ($Mb MB)" -ForegroundColor Green
Write-Host "Server: unzip, cp .env.production.example .env.production, pm2 start ecosystem.config.cjs" -ForegroundColor Green
