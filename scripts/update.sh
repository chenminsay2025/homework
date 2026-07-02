#!/usr/bin/env bash
# 上传新代码后更新依赖并重建前端
# 用法：bash scripts/update.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[update] 更新 Python 依赖..."
cd "$ROOT/backend"
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -r requirements.txt -q

echo "[update] 重建前端..."
cd "$ROOT/frontend"
npm install --registry=https://registry.npmmirror.com
npm run build

if command -v pm2 >/dev/null 2>&1 && pm2 describe homework-api >/dev/null 2>&1; then
  echo "[update] 重启 PM2 homework-api..."
  pm2 restart homework-api
else
  echo "[update] 未检测到 PM2 homework-api，请手动重启后端"
fi

echo "[update] 完成。请确认: curl -s http://127.0.0.1:8002/api/health"
