#!/usr/bin/env bash
# OpenList 一键部署（Ubuntu / Debian）
# 用法: sudo bash deploy-openlist.sh
# 或:   curl -fsSL <你的脚本地址> | sudo bash

set -euo pipefail

INSTALL_DIR="${OPENLIST_DIR:-/opt/openlist}"
PORT="${OPENLIST_PORT:-5244}"
TZ="${TZ:-Asia/Shanghai}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
cyan() { printf '\033[36m%s\033[0m\n' "$*"; }

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  red "请用 root 运行: sudo bash $0"
  exit 1
fi

cyan "==> 1/5 检查 Docker ..."
if ! command -v docker >/dev/null 2>&1; then
  cyan "    未检测到 Docker，开始安装 ..."
  apt-get update -qq
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc 2>/dev/null \
    || curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc 2>/dev/null || true
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} \
    ${VERSION_CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update -qq
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  green "    Docker 安装完成"
else
  green "    Docker 已安装"
fi

if ! docker compose version >/dev/null 2>&1; then
  red "缺少 docker compose 插件，请安装 docker-compose-plugin"
  exit 1
fi

cyan "==> 2/5 创建目录 ${INSTALL_DIR} ..."
mkdir -p "${INSTALL_DIR}/data"
chown -R "$(logname 2>/dev/null || echo root)":"$(logname 2>/dev/null || echo root)" "${INSTALL_DIR}/data" 2>/dev/null || chown -R 1001:1001 "${INSTALL_DIR}/data"

cat >"${INSTALL_DIR}/docker-compose.yml" <<YAML
services:
  openlist:
    image: openlistteam/openlist:latest
    container_name: openlist
    restart: unless-stopped
    user: "0:0"
    ports:
      - "${PORT}:5244"
    volumes:
      - ./data:/opt/openlist/data
    environment:
      - UMASK=022
      - TZ=${TZ}
YAML

cyan "==> 3/5 拉取镜像并启动 ..."
cd "${INSTALL_DIR}"
docker compose pull
docker compose up -d

cyan "==> 4/5 等待服务就绪 ..."
sleep 5
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

cyan "==> 5/5 防火墙（如已启用 ufw）..."
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "${PORT}/tcp" || true
  green "    已放行 ${PORT}/tcp"
fi

PUBLIC_IP="$(curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"

echo ""
green "=========================================="
green "  OpenList 部署完成"
green "=========================================="
echo ""
echo "  访问地址: http://${PUBLIC_IP}:${PORT}"
echo "  默认账号: admin"
echo ""
echo "  查看/重置管理员密码:"
echo "    docker exec -it openlist ./openlist admin random"
echo "    docker exec -it openlist ./openlist admin set 你的新密码"
echo ""
echo "  常用命令:"
echo "    cd ${INSTALL_DIR}"
echo "    docker compose logs -f          # 看日志"
echo "    docker compose pull && docker compose up -d   # 升级"
echo ""
echo "  数据目录: ${INSTALL_DIR}/data"
echo ""
cyan "首次登录后建议在后台修改密码，并配置存储/网盘。"
echo ""

# 尝试从日志里找初始密码提示
docker compose logs --tail 30 openlist 2>/dev/null | grep -iE 'password|admin|密码' || true
