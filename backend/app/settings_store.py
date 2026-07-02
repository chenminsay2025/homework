from sqlalchemy.orm import Session

from . import models

SETTING_UPLOAD_MAX_MB = "upload_max_mb"
SETTING_DELETE_RETENTION_DAYS = "delete_retention_days"
DEFAULT_UPLOAD_MAX_MB = 100
DEFAULT_DELETE_RETENTION_DAYS = 15
HARD_MAX_UPLOAD_MB = 500
HARD_MAX_DELETE_RETENTION_DAYS = 365


def get_setting(db: Session, key: str, default: str) -> str:
    row = db.get(models.AppSetting, key)
    return row.value if row else default


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(models.AppSetting, key)
    if row:
        row.value = value
    else:
        db.add(models.AppSetting(key=key, value=value))


def get_upload_max_mb(db: Session) -> int:
    raw = get_setting(db, SETTING_UPLOAD_MAX_MB, str(DEFAULT_UPLOAD_MAX_MB))
    try:
        mb = int(raw)
    except ValueError:
        mb = DEFAULT_UPLOAD_MAX_MB
    return max(1, min(mb, HARD_MAX_UPLOAD_MB))


def get_upload_max_bytes(db: Session) -> int:
    return get_upload_max_mb(db) * 1024 * 1024


def get_delete_retention_days(db: Session) -> int:
    raw = get_setting(db, SETTING_DELETE_RETENTION_DAYS, str(DEFAULT_DELETE_RETENTION_DAYS))
    try:
        days = int(raw)
    except ValueError:
        days = DEFAULT_DELETE_RETENTION_DAYS
    return max(1, min(days, HARD_MAX_DELETE_RETENTION_DAYS))


def ensure_default_settings(db: Session) -> None:
    if not db.get(models.AppSetting, SETTING_UPLOAD_MAX_MB):
        set_setting(db, SETTING_UPLOAD_MAX_MB, str(DEFAULT_UPLOAD_MAX_MB))
    if not db.get(models.AppSetting, SETTING_DELETE_RETENTION_DAYS):
        set_setting(db, SETTING_DELETE_RETENTION_DAYS, str(DEFAULT_DELETE_RETENTION_DAYS))
    db.commit()


def get_admin_settings(db: Session) -> dict[str, int]:
    return {
        "upload_max_mb": get_upload_max_mb(db),
        "delete_retention_days": get_delete_retention_days(db),
    }


def update_admin_settings(
    db: Session,
    *,
    upload_max_mb: int | None = None,
    delete_retention_days: int | None = None,
) -> dict[str, int]:
    if upload_max_mb is not None:
        mb = max(1, min(upload_max_mb, HARD_MAX_UPLOAD_MB))
        set_setting(db, SETTING_UPLOAD_MAX_MB, str(mb))
    if delete_retention_days is not None:
        days = max(1, min(delete_retention_days, HARD_MAX_DELETE_RETENTION_DAYS))
        set_setting(db, SETTING_DELETE_RETENTION_DAYS, str(days))
    db.commit()
    return get_admin_settings(db)
