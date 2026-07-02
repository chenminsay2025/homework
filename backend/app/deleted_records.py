"""删除记录：快照保存、管理员恢复、过期清理。"""

from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session, joinedload

from . import models
from .settings_store import get_delete_retention_days

ENTITY_PLAN = "plan"
ENTITY_LOCATION = "location"
ENTITY_COURSE = "course"
ENTITY_SCHEDULE_SLOT = "schedule_slot"
ENTITY_SCHEDULE_EXCEPTION = "schedule_exception"
ENTITY_SLOT_DAILY_PLAN = "slot_daily_plan"
ENTITY_TASK = "task"
ENTITY_DAILY_ENTRY = "daily_entry"
ENTITY_SUBJECT = "subject"
ENTITY_DAY_MANUAL_ITEM = "day_manual_item"

ENTITY_LABELS: dict[str, str] = {
    ENTITY_PLAN: "计划",
    ENTITY_LOCATION: "地点",
    ENTITY_COURSE: "课程",
    ENTITY_SUBJECT: "作业安排",
    ENTITY_SCHEDULE_SLOT: "课表时段",
    ENTITY_SCHEDULE_EXCEPTION: "调课记录",
    ENTITY_SLOT_DAILY_PLAN: "时段计划",
    ENTITY_TASK: "任务",
    ENTITY_DAILY_ENTRY: "每日记录",
    ENTITY_DAY_MANUAL_ITEM: "补充安排",
}

_DATE_FIELDS = {
    "Plan": {"deadline"},
    "SlotDailyPlan": {"date"},
    "ScheduleException": {"date"},
    "DailyEntry": {"date"},
    "DayManualItem": {"date"},
}
_TIME_FIELDS = {
    "ScheduleSlot": {"start_time", "end_time"},
    "ScheduleException": {"start_time", "end_time"},
    "DayManualItem": {"start_time", "end_time"},
}
_DATETIME_FIELDS = {
    "Plan": {"created_at"},
    "SlotDailyPlan": {"created_at"},
    "ScheduleException": {"created_at"},
    "DailyEntry": {"created_at"},
    "DayManualItem": {"created_at"},
    "User": {"created_at"},
}


def _serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, time):
        return value.isoformat()
    return value


def model_to_dict(obj: Any) -> dict[str, Any]:
    mapper = sa_inspect(obj.__class__)
    return {attr.key: _serialize_value(getattr(obj, attr.key)) for attr in mapper.column_attrs}


def _parse_row(model_cls: type, data: dict[str, Any]) -> dict[str, Any]:
    name = model_cls.__name__
    parsed = dict(data)
    for key in _DATE_FIELDS.get(name, ()):
        if parsed.get(key):
            parsed[key] = date.fromisoformat(parsed[key])
        else:
            parsed[key] = None
    for key in _TIME_FIELDS.get(name, ()):
        if parsed.get(key):
            parsed[key] = time.fromisoformat(parsed[key])
        else:
            parsed[key] = None
    for key in _DATETIME_FIELDS.get(name, ()):
        if parsed.get(key):
            parsed[key] = datetime.fromisoformat(parsed[key])
    return parsed


def _insert_row(db: Session, model_cls: type, data: dict[str, Any]) -> models.Base:
    if db.get(model_cls, data["id"]):
        raise ValueError(f"{ENTITY_LABELS.get(model_cls.__tablename__, model_cls.__name__)} ID {data['id']} 已存在，无法恢复")
    obj = model_cls(**_parse_row(model_cls, data))
    db.add(obj)
    db.flush()
    return obj


def _title_from_entity(entity_type: str, snapshot: dict[str, Any]) -> str:
    if entity_type == ENTITY_PLAN:
        return str(snapshot.get("plan", {}).get("name") or "计划")
    entity = snapshot.get("entity", {})
    for key in ("title", "name", "activity", "reason", "description"):
        val = entity.get(key)
        if val:
            return str(val)[:200]
    return f"#{entity.get('id', '?')}"


def build_plan_snapshot(db: Session, plan_id: int) -> dict[str, Any]:
    plan = db.get(models.Plan, plan_id)
    if not plan:
        raise ValueError("计划不存在")

    tasks = (
        db.query(models.Task)
        .options(joinedload(models.Task.attachments))
        .filter_by(plan_id=plan_id)
        .all()
    )
    task_snapshots = []
    for task in tasks:
        entries = db.query(models.DailyEntry).filter_by(task_id=task.id).all()
        task_snapshots.append(
            {
                "entity": model_to_dict(task),
                "attachments": [model_to_dict(a) for a in task.attachments],
                "daily_entries": [model_to_dict(e) for e in entries],
            }
        )

    slot_ids = [s.id for s in db.query(models.ScheduleSlot.id).filter_by(plan_id=plan_id).all()]
    slot_daily_plans = (
        db.query(models.SlotDailyPlan).filter(models.SlotDailyPlan.slot_id.in_(slot_ids)).all()
        if slot_ids
        else []
    )

    return {
        "plan": model_to_dict(plan),
        "locations": [model_to_dict(x) for x in db.query(models.Location).filter_by(plan_id=plan_id).all()],
        "courses": [model_to_dict(x) for x in db.query(models.Course).filter_by(plan_id=plan_id).all()],
        "subjects": [model_to_dict(x) for x in db.query(models.Subject).filter_by(plan_id=plan_id).all()],
        "tasks": task_snapshots,
        "schedule_slots": [
            model_to_dict(x) for x in db.query(models.ScheduleSlot).filter_by(plan_id=plan_id).all()
        ],
        "slot_daily_plans": [model_to_dict(x) for x in slot_daily_plans],
        "schedule_exceptions": [
            model_to_dict(x) for x in db.query(models.ScheduleException).filter_by(plan_id=plan_id).all()
        ],
        "day_manual_items": [
            model_to_dict(x) for x in db.query(models.DayManualItem).filter_by(plan_id=plan_id).all()
        ],
        "plan_attachments": [
            model_to_dict(x)
            for x in db.query(models.PlanAttachment).filter_by(plan_id=plan_id).all()
        ],
    }


def build_subject_snapshot(db: Session, subject: models.Subject) -> dict[str, Any]:
    tasks = (
        db.query(models.Task)
        .options(joinedload(models.Task.attachments))
        .filter_by(subject_id=subject.id)
        .all()
    )
    task_snapshots = []
    for task in tasks:
        entries = db.query(models.DailyEntry).filter_by(task_id=task.id).all()
        task_snapshots.append(
            {
                "entity": model_to_dict(task),
                "attachments": [model_to_dict(a) for a in task.attachments],
                "daily_entries": [model_to_dict(e) for e in entries],
            }
        )
    return {"entity": model_to_dict(subject), "tasks": task_snapshots}


def build_task_snapshot(db: Session, task: models.Task) -> dict[str, Any]:
    task = (
        db.query(models.Task)
        .options(joinedload(models.Task.attachments))
        .filter(models.Task.id == task.id)
        .first()
    )
    entries = db.query(models.DailyEntry).filter_by(task_id=task.id).all()
    return {
        "entity": model_to_dict(task),
        "attachments": [model_to_dict(a) for a in task.attachments],
        "daily_entries": [model_to_dict(e) for e in entries],
    }


def build_schedule_slot_snapshot(db: Session, slot: models.ScheduleSlot) -> dict[str, Any]:
    daily_plans = db.query(models.SlotDailyPlan).filter_by(slot_id=slot.id).all()
    exceptions = db.query(models.ScheduleException).filter_by(slot_id=slot.id).all()
    return {
        "entity": model_to_dict(slot),
        "daily_plans": [model_to_dict(p) for p in daily_plans],
        "exceptions": [model_to_dict(e) for e in exceptions],
    }


def record_deletion(
    db: Session,
    *,
    entity_type: str,
    entity_id: int,
    plan_id: int | None,
    user_id: int,
    deleted_by_user_id: int | None,
    snapshot: dict[str, Any],
) -> models.DeletedRecord:
    retention = get_delete_retention_days(db)
    now = datetime.now()
    record = models.DeletedRecord(
        entity_type=entity_type,
        entity_id=entity_id,
        plan_id=plan_id,
        user_id=user_id,
        snapshot_json=json.dumps(snapshot, ensure_ascii=False),
        display_title=_title_from_entity(entity_type, snapshot),
        deleted_at=now,
        deleted_by_user_id=deleted_by_user_id,
        expires_at=now + timedelta(days=retention),
    )
    db.add(record)
    db.flush()
    return record


def purge_expired(db: Session) -> int:
    now = datetime.now()
    rows = (
        db.query(models.DeletedRecord)
        .filter(
            models.DeletedRecord.expires_at < now,
            models.DeletedRecord.restored_at.is_(None),
        )
        .all()
    )
    count = len(rows)
    for row in rows:
        db.delete(row)
    if count:
        db.commit()
    return count


def list_deleted_records(
    db: Session,
    *,
    entity_type: str | None = None,
    include_expired: bool = False,
) -> list[models.DeletedRecord]:
    purge_expired(db)
    query = (
        db.query(models.DeletedRecord)
        .options(
            joinedload(models.DeletedRecord.user),
            joinedload(models.DeletedRecord.deleted_by),
        )
        .filter(models.DeletedRecord.restored_at.is_(None))
    )
    if not include_expired:
        query = query.filter(models.DeletedRecord.expires_at >= datetime.now())
    if entity_type:
        query = query.filter(models.DeletedRecord.entity_type == entity_type)
    return query.order_by(models.DeletedRecord.deleted_at.desc()).all()


def _restore_plan(db: Session, snapshot: dict[str, Any]) -> None:
    plan_data = snapshot["plan"]
    if not db.get(models.User, plan_data["user_id"]):
        raise ValueError("所属用户不存在，无法恢复计划")
    _insert_row(db, models.Plan, plan_data)

    for row in snapshot.get("locations", []):
        if not db.get(models.Plan, row["plan_id"]):
            raise ValueError("计划数据不完整")
        _insert_row(db, models.Location, row)

    for row in snapshot.get("subjects", []):
        _insert_row(db, models.Subject, row)

    for row in snapshot.get("courses", []):
        _insert_row(db, models.Course, row)

    for item in snapshot.get("tasks", []):
        _insert_row(db, models.Task, item["entity"])
        for att in item.get("attachments", []):
            _insert_row(db, models.TaskAttachment, att)

    for row in snapshot.get("schedule_slots", []):
        _insert_row(db, models.ScheduleSlot, row)

    for row in snapshot.get("slot_daily_plans", []):
        _insert_row(db, models.SlotDailyPlan, row)

    for row in snapshot.get("schedule_exceptions", []):
        _insert_row(db, models.ScheduleException, row)

    for item in snapshot.get("tasks", []):
        for entry in item.get("daily_entries", []):
            _insert_row(db, models.DailyEntry, entry)

    for row in snapshot.get("day_manual_items", []):
        _insert_row(db, models.DayManualItem, row)

    for row in snapshot.get("plan_attachments", []):
        _insert_row(db, models.PlanAttachment, row)


def _restore_subject(db: Session, snapshot: dict[str, Any]) -> None:
    entity = snapshot["entity"]
    if not db.get(models.Plan, entity["plan_id"]):
        raise ValueError("所属计划不存在，无法恢复作业安排")
    _insert_row(db, models.Subject, entity)
    for item in snapshot.get("tasks", []):
        _insert_row(db, models.Task, item["entity"])
        for att in item.get("attachments", []):
            _insert_row(db, models.TaskAttachment, att)
        for entry in item.get("daily_entries", []):
            _insert_row(db, models.DailyEntry, entry)


def _restore_task(db: Session, snapshot: dict[str, Any]) -> None:
    entity = snapshot["entity"]
    if not db.get(models.Plan, entity["plan_id"]):
        raise ValueError("所属计划不存在，无法恢复任务")
    if not db.get(models.Subject, entity["subject_id"]):
        raise ValueError("所属科目不存在，无法恢复任务")
    _insert_row(db, models.Task, entity)
    for att in snapshot.get("attachments", []):
        _insert_row(db, models.TaskAttachment, att)
    for entry in snapshot.get("daily_entries", []):
        _insert_row(db, models.DailyEntry, entry)


def _restore_schedule_slot(db: Session, snapshot: dict[str, Any]) -> None:
    entity = snapshot["entity"]
    if not db.get(models.Plan, entity["plan_id"]):
        raise ValueError("所属计划不存在，无法恢复课表时段")
    _insert_row(db, models.ScheduleSlot, entity)
    for row in snapshot.get("daily_plans", []):
        _insert_row(db, models.SlotDailyPlan, row)
    for row in snapshot.get("exceptions", []):
        _insert_row(db, models.ScheduleException, row)


def _restore_slot_daily_plan(db: Session, snapshot: dict[str, Any]) -> None:
    entity = snapshot["entity"]
    if not db.get(models.ScheduleSlot, entity["slot_id"]):
        raise ValueError("所属课表时段不存在，无法恢复时段计划")
    _insert_row(db, models.SlotDailyPlan, entity)


def _restore_daily_entry(db: Session, snapshot: dict[str, Any]) -> None:
    entity = snapshot["entity"]
    if not db.get(models.Task, entity["task_id"]):
        raise ValueError("所属任务不存在，无法恢复每日记录")
    _insert_row(db, models.DailyEntry, entity)


def _restore_schedule_exception(db: Session, snapshot: dict[str, Any]) -> None:
    entity = snapshot["entity"]
    if not db.get(models.ScheduleSlot, entity["slot_id"]):
        raise ValueError("所属课表时段不存在，无法恢复调课记录")
    _insert_row(db, models.ScheduleException, entity)


def _restore_simple(db: Session, model_cls: type, snapshot: dict[str, Any], plan_check: bool = True) -> None:
    entity = snapshot["entity"]
    if plan_check and entity.get("plan_id") and not db.get(models.Plan, entity["plan_id"]):
        raise ValueError("所属计划不存在，无法恢复")
    _insert_row(db, model_cls, entity)


def restore_deleted_record(db: Session, record_id: int) -> models.DeletedRecord:
    record = db.get(models.DeletedRecord, record_id)
    if not record:
        raise ValueError("删除记录不存在")
    if record.restored_at:
        raise ValueError("该记录已恢复")
    if record.expires_at < datetime.now():
        raise ValueError("该记录已过期，无法恢复")

    snapshot = json.loads(record.snapshot_json)
    restore_handlers = {
        ENTITY_PLAN: lambda: _restore_plan(db, snapshot),
        ENTITY_LOCATION: lambda: _restore_simple(db, models.Location, snapshot),
        ENTITY_COURSE: lambda: _restore_simple(db, models.Course, snapshot),
        ENTITY_SUBJECT: lambda: _restore_subject(db, snapshot),
        ENTITY_SCHEDULE_SLOT: lambda: _restore_schedule_slot(db, snapshot),
        ENTITY_SCHEDULE_EXCEPTION: lambda: _restore_schedule_exception(db, snapshot),
        ENTITY_SLOT_DAILY_PLAN: lambda: _restore_slot_daily_plan(db, snapshot),
        ENTITY_TASK: lambda: _restore_task(db, snapshot),
        ENTITY_DAILY_ENTRY: lambda: _restore_daily_entry(db, snapshot),
        ENTITY_DAY_MANUAL_ITEM: lambda: _restore_simple(db, models.DayManualItem, snapshot),
    }
    handler = restore_handlers.get(record.entity_type)
    if not handler:
        raise ValueError("不支持的实体类型")

    try:
        handler()
        record.restored_at = datetime.now()
        db.commit()
        db.refresh(record)
        return record
    except ValueError:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise ValueError(f"恢复失败：{exc}") from exc


def permanent_delete_record(db: Session, record_id: int) -> bool:
    record = db.get(models.DeletedRecord, record_id)
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True
