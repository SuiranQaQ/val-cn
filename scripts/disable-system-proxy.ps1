# 关闭 Companion 遗留的系统代理（ERR_PROXY_CONNECTION_FAILED）
$Companion = Join-Path $PSScriptRoot "..\companion"
Set-Location $Companion
node -e "import('./lib/system-proxy.mjs').then(m=>{const b=m.getSystemProxyState(); m.disableSystemProxy(); const a=m.getSystemProxyState(); console.log('was:', b.enabled, b.server); console.log('now:', a.enabled);})"
