#!/usr/bin/env bash
# 在服务器 /www 目录执行：bash upgrade-website-on-server.sh
# 前提：已上传 VAL-CN-website.zip 到 /www/

set -euo pipefail

ZIP="/www/VAL-CN-website.zip"
TARGET="/www/val-cn"
STAGING="/www/VAL-CN-website"
BACKUP_ENV="/root/.env.production.bak"
BACKUP_DATA="/root/val-cn-data.bak"

if [ ! -f "$ZIP" ]; then
  echo "缺少 $ZIP，请先从本机 scp 上传"
  exit 1
fi

echo "==> 备份 .env 与 data"
[ -f "$TARGET/.env.production" ] && cp "$TARGET/.env.production" "$BACKUP_ENV"
[ -d "$TARGET/data" ] && cp -a "$TARGET/data" "$BACKUP_DATA"

echo "==> 解压"
cd /www
unzip -o "$ZIP"

if [ ! -f "$STAGING/server.js" ]; then
  echo "解压失败，未找到 $STAGING/server.js"
  exit 1
fi

echo "==> 替换部署目录"
rm -rf "${TARGET}.old"
[ -d "$TARGET" ] && mv "$TARGET" "${TARGET}.old"
mv "$STAGING" "$TARGET"

[ -f "$BACKUP_ENV" ] && cp "$BACKUP_ENV" "$TARGET/.env.production"
[ -d "$BACKUP_DATA" ] && mkdir -p "$TARGET/data" && cp -a "$BACKUP_DATA/." "$TARGET/data/"

cd "$TARGET"
mkdir -p data

# 修复旧包 public/public 嵌套
if [ -d "$TARGET/public/public" ]; then
  cp -a "$TARGET/public/public/." "$TARGET/public/"
  rm -rf "$TARGET/public/public"
  echo "已合并 public/public"
fi

echo "==> PM2 重启"
if pm2 describe val-cn-website >/dev/null 2>&1; then
  pm2 restart val-cn-website --update-env
else
  pm2 delete val-cn 2>/dev/null || true
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo ""
echo "==> 检查"
curl -s http://127.0.0.1:3000/api/diagnostics | head -c 300
echo ""
echo "完成: $TARGET"
