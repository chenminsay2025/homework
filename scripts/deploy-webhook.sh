#!/usr/bin/env bash
# 宝塔 Git Webhook 部署脚本：拉代码 → 重建 → 重启 PM2
# 在宝塔「Git 拉取 → 部署脚本」中填写：
#   cd /www/wwwroot/homework.meituyin.cn && bash scripts/deploy-webhook.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_BRANCH:-main}"

if [ -d .git ]; then
  echo "[deploy] git pull origin ${BRANCH} ..."
  git fetch origin "${BRANCH}"
  git reset --hard "origin/${BRANCH}"
else
  echo "[deploy] 警告: 当前目录不是 git 仓库，跳过 git pull"
fi

bash "$ROOT/scripts/update.sh"

echo "[deploy] Webhook 部署完成"
