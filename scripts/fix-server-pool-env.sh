#!/usr/bin/env bash
# 在服务器 /www/val-cn 执行：bash scripts/fix-server-pool-env.sh
# 作用：确保 .env.production 存在且 PM2 能读到 SESSION_POOL_*

set -euo pipefail

APP_DIR="${1:-/www/val-cn}"
cd "$APP_DIR"

if [ ! -f server.js ]; then
  echo "错误：未找到 $APP_DIR/server.js"
  exit 1
fi

if [ ! -f .env.production ]; then
  if [ -f data/pool-secrets.env ]; then
    cp data/pool-secrets.env .env.production
    echo "已从 data/pool-secrets.env 创建 .env.production"
  else
    echo "缺少 .env.production — 请先从本机 scp data/pool-secrets.env 到此目录"
    exit 1
  fi
fi

if ! grep -q '^SESSION_POOL_ENCRYPTION_KEY=.\+' .env.production 2>/dev/null; then
  echo "错误：.env.production 里没有 SESSION_POOL_ENCRYPTION_KEY"
  echo "请 scp 本机 data/pool-secrets.env 为 $APP_DIR/.env.production"
  exit 1
fi

# 安装会加载 .env.production 的 PM2 配置
if [ -f scripts/pm2-ecosystem-website.cjs ]; then
  cp scripts/pm2-ecosystem-website.cjs ecosystem.config.cjs
elif [ -f scripts/fix-server-pool-env.sh ]; then
  cat > ecosystem.config.cjs <<'ECO'
const fs = require("fs");
const path = require("path");
function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}
const cwd = __dirname;
module.exports = {
  apps: [{
    name: "val-cn-website",
    cwd,
    script: "server.js",
    exec_mode: "fork",
    instances: 1,
    autorestart: true,
    env: { NODE_ENV: "production", PORT: 3000, HOSTNAME: "0.0.0.0", ...loadEnvFile(path.join(cwd, ".env.production")) },
  }],
};
ECO
fi

echo "==> 重启 PM2（加载 .env.production）"
pm2 delete val-cn-website 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

sleep 2
echo ""
echo "==> 检查加密池"
curl -s http://127.0.0.1:3000/api/diagnostics | head -c 500 || true
echo ""
