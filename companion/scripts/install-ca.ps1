# Install VAL-CN Companion root CA into Trusted Root (admin required)

$ErrorActionPreference = "Stop"

$certPath = Join-Path $env:LOCALAPPDATA "VAL-CN\certs\val-cn-ca.pem"

if (-not (Test-Path $certPath)) {
    Write-Host "CA not found: $certPath" -ForegroundColor Red
    Write-Host "Run companion once first: cd companion; npm start" -ForegroundColor Yellow
    exit 1
}

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
    Write-Host "Run PowerShell as Administrator." -ForegroundColor Red
    exit 1
}

$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certPath)
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
$store.Open("ReadWrite")
$existing = $store.Certificates | Where-Object { $_.Thumbprint -eq $cert.Thumbprint }
if ($existing) {
    Write-Host "CA already installed. Thumbprint: $($cert.Thumbprint)" -ForegroundColor Green
} else {
    $store.Add($cert)
    Write-Host "CA installed. Thumbprint: $($cert.Thumbprint)" -ForegroundColor Green
}
$store.Close()

Write-Host ""
Write-Host "Next: npm start -- --set-proxy" -ForegroundColor Cyan
