#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> 生成 Token 池密钥并写入 .env.local / data/pool-secrets.env" -ForegroundColor Cyan
node scripts/generate-pool-secrets.mjs --write @args
