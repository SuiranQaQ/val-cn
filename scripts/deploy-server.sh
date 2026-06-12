#!/usr/bin/env bash
# VAL CN 服务器一键部署（在服务器上执行，不要用 root 跑应用）
# 用法：
#   cd /www/val-cn && bash scripts/deploy-server.sh

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "==> 目录: $APP_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node 20:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi

NODE_MAJOR="$(node -v | sed 's/v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "需要 Node >= 20，当前: $(node -v)"
  exit 1
fi

if [ ! -f .env.production ]; then
  if [ -f .env.example ]; then
    cp .env.example .env.production
    echo "已创建 .env.production，请编辑后重新运行本脚本："
    echo "  nano .env.production"
    echo "至少填写 RIOT_ACCESS_TOKEN 和 RIOT_ENTITLEMENTS_JWT"
    exit 1
  fi
  echo "缺少 .env.production"
  exit 1
fi

if grep -q 'RIOT_ACCESS_TOKEN=eyJraWQiOiJzMSIs\.\.\.' .env.production 2>/dev/null; then
  echo "请先把 .env.production 里的示例 Token 换成真实抓包内容"
  exit 1
fi

echo "==> npm install"
npm install

echo "==> npm run build"
npm run build

if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> 安装 PM2"
  sudo npm install -g pm2
fi

echo "==> 启动 / 重启 PM2"
if pm2 describe val-cn >/dev/null 2>&1; then
  pm2 restart val-cn
else
  pm2 start ecosystem.config.cjs
fi

pm2 save

echo ""
echo "部署完成。本机检查："
echo "  curl -s http://127.0.0.1:3000/api/diagnostics"
echo ""
echo "若外网访问，请配置 Nginx 反代到 3000 端口，详见 docs/DEPLOY.md"
echo "对局认人 /live 仅能在 Windows 本机使用，服务器不提供此功能。"
