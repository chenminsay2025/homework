import re
import uuid
from pathlib import Path

from fastapi import UploadFile

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads"

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".mp3",
    ".m4a",
    ".wav",
    ".aac",
    ".ogg",
    ".flac",
    ".mp4",
    ".webm",
    ".mov",
    ".mkv",
    ".avi",
}

MAX_BYTES = 100 * 1024 * 1024  # fallback when DB unavailable

CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
}


def plan_upload_dir(plan_id: int) -> Path:
    directory = UPLOAD_ROOT / str(plan_id)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def safe_original_name(name: str) -> str:
    base = Path(name).name
    cleaned = re.sub(r"[^\w.\-()\u4e00-\u9fff]+", "_", base).strip("._")
    return (cleaned or "attachment")[:120]


def content_type_for(stored_name: str) -> str:
    ext = Path(stored_name).suffix.lower()
    return CONTENT_TYPES.get(ext, "application/octet-stream")


def resolve_plan_file(plan_id: int, stored_name: str) -> Path | None:
    if not stored_name or ".." in stored_name or "/" in stored_name or "\\" in stored_name:
        return None
    path = plan_upload_dir(plan_id) / stored_name
    if not path.is_file():
        return None
    return path


async def save_plan_upload(
    plan_id: int, file: UploadFile, max_bytes: int | None = None
) -> tuple[str, str, int]:
    limit = max_bytes if max_bytes is not None else MAX_BYTES
    limit_mb = max(1, limit // (1024 * 1024))
    original = safe_original_name(file.filename or "attachment")
    ext = Path(original).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"不支持的文件类型：{ext or '未知'}")

    content = await file.read()
    if not content:
        raise ValueError("文件为空")
    if len(content) > limit:
        raise ValueError(f"文件不能超过 {limit_mb}MB")

    stored = f"{uuid.uuid4().hex}{ext}"
    path = plan_upload_dir(plan_id) / stored
    path.write_bytes(content)
    return stored, original, len(content)
