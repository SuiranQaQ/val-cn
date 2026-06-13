$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path "node_modules")) {
    npm install
}

npm start -- --set-proxy
