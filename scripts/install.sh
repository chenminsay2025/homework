#!/usr/bin/env bash
# 服务器首次安装 / 重新安装依赖与前端构建
# 用法：cd 项目根目录 && bash scripts/install.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[install]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err() { echo -e "${RED}[error]${NC} $*" >&2; }

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "缺少命令: $1"
    exit 1
  fi
}

info "项目目录: $ROOT"

need_cmd python3
need_cmd node
need_cmd npm

PY_VER="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
PY_MAJOR="${PY_VER%%.*}"
PY_MINOR="${PY_VER#*.}"
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
  err "需要 Python 3.10+，当前: $PY_VER"
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  warn "建议 Node.js 18+，当前: $(node -v)"
fi

if [ ! -f "$ROOT/.env" ]; then
  if [ -f "$ROOT/.env.example" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    warn "已从 .env.example 创建 .env，请编辑后再启动生产服务"
  else
    err "未找到 .env，请先创建并配置 DATABASE_URL、JWT_SECRET 等"
    exit 1
  fi
fi

if grep -qE '请改为|change-in-production|admin123' "$ROOT/.env" 2>/dev/null; then
  warn ".env 中仍含默认占位或弱密码，生产环境请务必修改 JWT_SECRET、ADMIN_PASSWORD"
fi

if command -v openssl >/dev/null 2>&1; then
  if grep -q 'JWT_SECRET=请改为' "$ROOT/.env" 2>/dev/null; then
    SECRET="$(openssl rand -hex 32)"
    sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$SECRET|" "$ROOT/.env"
    rm -f "$ROOT/.env.bak"
    info "已自动生成 JWT_SECRET"
  fi
fi

info "安装 Python 依赖..."
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -U pip -q
pip install -r requirements.txt -q

info "创建 uploads 目录..."
mkdir -p "$ROOT/backend/uploads"
chmod 755 "$ROOT/backend/uploads" 2>/dev/null || true

info "构建前端..."
cd "$ROOT/frontend"
if [ -f package-lock.json ]; then
  npm ci --registry=https://registry.npmmirror.com
else
  npm install --registry=https://registry.npmmirror.com
fi
npm run build

if [ ! -f "$ROOT/frontend/dist/index.html" ]; then
  err "前端构建失败：未找到 frontend/dist/index.html"
  exit 1
fi

info "验证后端..."
cd "$ROOT/backend"
# shellcheck disable=SC1091
source .venv/bin/activate
python3 -c "from app.main import app; print('app ok')" >/dev/null

echo ""
info "安装完成。"
echo ""
echo "  下一步："
echo "  1. 编辑 .env（DEV_MODE=false，域名写入 CORS_ORIGINS）"
echo "  2. 启动后端: bash scripts/start-prod.sh"
echo "     或 PM2:    pm2 start deploy/pm2.ecosystem.config.cjs && pm2 save"
echo "  3. Nginx 根目录指向: $ROOT/frontend/dist"
echo "     参考配置: deploy/nginx.example.conf"
echo "  4. 自检: curl -s http://127.0.0.1:8002/api/health"
echo ""
