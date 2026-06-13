#Requires -Version 5.1
param(
  [string]$Server = "root@154.94.237.83",
  [string]$RemoteDir = "/www/val-cn"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$SecretsFile = Join-Path $Root "data\pool-secrets.env"
if (-not (Test-Path $SecretsFile)) {
  Write-Host "Missing data\pool-secrets.env. Run: npm run setup:pool-secrets" -ForegroundColor Yellow
  exit 1
}

Write-Host ("Upload pool-secrets.env -> " + $Server + ":" + $RemoteDir + "/.env.production") -ForegroundColor Cyan
& scp $SecretsFile ($Server + ":" + $RemoteDir + "/.env.production")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$EcoLocal = Join-Path $Root "scripts\pm2-ecosystem-website.cjs"
if (Test-Path $EcoLocal) {
  Write-Host "Upload ecosystem.config.cjs" -ForegroundColor Cyan
  & scp $EcoLocal ($Server + ":" + $RemoteDir + "/ecosystem.config.cjs")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Restart PM2 on server" -ForegroundColor Cyan
$remoteCmd = "cd $RemoteDir; pm2 delete val-cn-website 2>/dev/null; pm2 start ecosystem.config.cjs; pm2 save; sleep 2; curl -s http://127.0.0.1:3000/api/diagnostics | head -c 300"
& ssh $Server $remoteCmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Restart VALBOX and check Good Samaritan mode." -ForegroundColor Green
