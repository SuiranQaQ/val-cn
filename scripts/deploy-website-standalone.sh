#!/usr/bin/env bash
# 官网 standalone 包部署（服务器上执行）
# 用法: cd /www/val-cn && bash deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/server.js" ]; then
  APP_DIR="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/../server.js" ]; then
  APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  APP_DIR="$SCRIPT_DIR"
fi
cd "$APP_DIR"

echo "==> VAL CN 官网 standalone 部署: $APP_DIR"

if [ ! -f server.js ]; then
  echo "缺少 server.js，请上传 VAL-CN-website 解压包内容到此目录"
  exit 1
fi

if [ ! -f .env.production ]; then
  if [ -f .env.production.example ]; then
    cp .env.production.example .env.production
    echo "已创建 .env.production — 请先填写 SESSION_POOL_* 密钥后重跑"
    exit 1
  fi
  echo "缺少 .env.production"
  exit 1
fi

mkdir -p data

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> 安装 PM2"
  sudo npm install -g pm2
fi

export NODE_ENV=production
set -a
# shellcheck disable=SC1091
source .env.production
set +a

echo "==> PM2 启动 / 重启"
if pm2 describe val-cn-website >/dev/null 2>&1; then
  pm2 restart val-cn-website --update-env
else
  pm2 start ecosystem.config.cjs
fi

pm2 save

echo ""
echo "部署完成。检查: curl -s http://127.0.0.1:3000/api/diagnostics | head"
echo "Nginx 反代 valcn.suiran.xyz -> 127.0.0.1:3000"
