#!/usr/bin/env bash
# 前台启动生产后端（调试用）；常驻请用 PM2
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

if [ ! -d .venv ]; then
  echo "请先运行: bash scripts/install.sh"
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "API: http://127.0.0.1:8002/api/health"
exec uvicorn app.main:app --host 127.0.0.1 --port 8002
