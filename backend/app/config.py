import os
from pathlib import Path

from dotenv import load_dotenv

# 加载 backend/.env 或项目根目录 .env
_root = Path(__file__).resolve().parents[2]
load_dotenv(_root / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DEV_MODE = os.getenv("DEV_MODE", "true").lower() in ("1", "true", "yes")
DEV_USER_ID = 1

JWT_SECRET = os.getenv("JWT_SECRET", "homework-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "10080"))  # 7 天

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

# 云端 / 生产请使用 PostgreSQL，例如：
# postgresql://user:password@host:5432/dbname
_raw_db_url = os.getenv(
    "DATABASE_URL",
    "postgresql://homework:homework@localhost:5432/homework",
)


def _resolve_database_url(url: str) -> str:
    """SQLite 相对路径统一按项目根目录解析，避免从 backend/ 启动时路径错误。"""
    prefix = "sqlite:///./"
    if url.startswith(prefix):
        rel = url[len(prefix) :]
        abs_path = (_root / rel).resolve()
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{abs_path.as_posix()}"
    return url


DATABASE_URL = _resolve_database_url(_raw_db_url)
