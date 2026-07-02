from sqlalchemy import inspect, text

from . import crud
from .database import Base, engine
from .settings_store import ensure_default_settings


def _drop_table(conn, table: str) -> None:
    if engine.dialect.name == "postgresql":
        conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
    else:
        conn.execute(text(f"DROP TABLE IF EXISTS {table}"))


def _has_unique_constraint(inspector, table: str, name: str) -> bool:
    for uc in inspector.get_unique_constraints(table):
        if uc.get("name") == name:
            return True
    for idx in inspector.get_indexes(table):
        if idx.get("name") == name and idx.get("unique"):
            return True
    return False


def _ensure_unique_constraint(table: str, col_a: str, col_b: str, name: str) -> None:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return
    if _has_unique_constraint(inspector, table, name):
        return

    with engine.connect() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(
                text(
                    f"DELETE FROM {table} a USING {table} b "
                    f"WHERE a.{col_a} = b.{col_a} AND a.{col_b} = b.{col_b} AND a.id > b.id"
                )
            )
            conn.execute(
                text(f"ALTER TABLE {table} ADD CONSTRAINT {name} UNIQUE ({col_a}, {col_b})")
            )
        else:
            conn.execute(
                text(
                    f"DELETE FROM {table} WHERE id NOT IN "
                    f"(SELECT MIN(id) FROM {table} GROUP BY {col_a}, {col_b})"
                )
            )
            conn.execute(
                text(f"CREATE UNIQUE INDEX IF NOT EXISTS {name} ON {table} ({col_a}, {col_b})")
            )
        conn.commit()


def run_migrations() -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if not tables:
        Base.metadata.create_all(bind=engine)
        return

    if "plans" not in tables:
        if "subjects" in tables:
            cols = [c["name"] for c in inspector.get_columns("subjects")]
            if "plan_id" not in cols:
                Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        return

    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "courses" in tables:
        course_cols = [c["name"] for c in inspector.get_columns("courses")]
        if "plan_id" not in course_cols:
            with engine.connect() as conn:
                _drop_table(conn, "courses")
                conn.commit()
            Base.metadata.create_all(bind=engine)
            inspector = inspect(engine)
            tables = inspector.get_table_names()

    if "schedule_slots" in tables:
        cols = [c["name"] for c in inspector.get_columns("schedule_slots")]
        if "slot_type" not in cols:
            with engine.connect() as conn:
                conn.execute(
                    text("ALTER TABLE schedule_slots ADD COLUMN slot_type VARCHAR(20) DEFAULT 'class'")
                )
                conn.execute(
                    text("UPDATE schedule_slots SET slot_type='self_study' WHERE activity='自安排'")
                )
                conn.commit()
        if "course_id" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE schedule_slots ADD COLUMN course_id INTEGER"))
                conn.commit()
        if "default_task_id" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE schedule_slots ADD COLUMN default_task_id INTEGER"))
                conn.commit()

    if "courses" in inspector.get_table_names() and "schedule_slots" in tables:
        _backfill_courses_from_slots()

    _ensure_unique_constraint("slot_daily_plans", "slot_id", "date", "uq_slot_daily_plan")
    _ensure_unique_constraint("daily_entries", "task_id", "date", "uq_daily_entry_task_date")

    if "tasks" in inspector.get_table_names():
        task_cols = [c["name"] for c in inspector.get_columns("tasks")]
        if "file_name" not in task_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN file_name VARCHAR(255)"))
                conn.commit()

    if "task_attachments" in inspector.get_table_names():
        _migrate_task_files_to_attachments()

    if "day_manual_items" in inspector.get_table_names():
        manual_cols = [c["name"] for c in inspector.get_columns("day_manual_items")]
        if "task_id" not in manual_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE day_manual_items ADD COLUMN task_id INTEGER"))
                conn.commit()
        manual_cols = [c["name"] for c in inspector.get_columns("day_manual_items")]
        if "planned_units" not in manual_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE day_manual_items ADD COLUMN planned_units INTEGER"))
                conn.commit()

    if "slot_daily_plans" in inspector.get_table_names():
        slot_plan_cols = [c["name"] for c in inspector.get_columns("slot_daily_plans")]
        with engine.connect() as conn:
            if "task_id" not in slot_plan_cols:
                conn.execute(text("ALTER TABLE slot_daily_plans ADD COLUMN task_id INTEGER"))
            if "planned_units" not in slot_plan_cols:
                conn.execute(text("ALTER TABLE slot_daily_plans ADD COLUMN planned_units INTEGER DEFAULT 1"))
            conn.commit()

    _ensure_default_app_settings()

    from . import models

    inspector = inspect(engine)
    if "plan_attachments" not in inspector.get_table_names():
        Base.metadata.create_all(bind=engine, tables=[models.PlanAttachment.__table__])

    if "schedule_slots" in inspector.get_table_names():
        _dedupe_schedule_slots()

    if "users" in inspector.get_table_names():
        user_cols = [c["name"] for c in inspector.get_columns("users")]
        with engine.connect() as conn:
            if "password_hash" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))
            if "role" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'"))
            if "is_active" not in user_cols:
                if engine.dialect.name == "postgresql":
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE"))
                else:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            conn.commit()


def _backfill_courses_from_slots() -> None:
    from sqlalchemy.orm import Session

    from .database import SessionLocal
    from . import models

    db = SessionLocal()
    try:
        plans = db.query(models.Plan).all()
        for plan in plans:
            existing = {c.name: c for c in db.query(models.Course).filter_by(plan_id=plan.id).all()}
            order = len(existing)
            activities = {
                s.activity
                for s in db.query(models.ScheduleSlot).filter_by(plan_id=plan.id).all()
                if s.activity != "自安排" and s.slot_type == "class"
            }
            for name in activities:
                if name not in existing:
                    course = models.Course(
                        plan_id=plan.id,
                        name=name,
                        color=crud.ACTIVITY_COLORS.get(name, "#6366f1"),
                        sort_order=order,
                    )
                    db.add(course)
                    db.flush()
                    existing[name] = course
                    order += 1
            for slot in db.query(models.ScheduleSlot).filter_by(plan_id=plan.id).all():
                if slot.course_id is None and slot.activity in existing:
                    slot.course_id = existing[slot.activity].id
        db.commit()
    finally:
        db.close()


def _migrate_task_files_to_attachments() -> None:
    from .database import SessionLocal
    from . import models

    db = SessionLocal()
    try:
        for task in db.query(models.Task).filter(models.Task.file_url.isnot(None)).all():
            if db.query(models.TaskAttachment).filter_by(task_id=task.id).count() > 0:
                continue
            db.add(
                models.TaskAttachment(
                    task_id=task.id,
                    file_url=task.file_url,
                    file_name=task.file_name or "附件",
                    sort_order=0,
                )
            )
        db.commit()
    finally:
        db.close()


def _ensure_default_app_settings() -> None:
    from .database import SessionLocal

    db = SessionLocal()
    try:
        ensure_default_settings(db)
    finally:
        db.close()


def _dedupe_schedule_slots() -> None:
    from .database import SessionLocal
    from . import models

    db = SessionLocal()
    try:
        seen: set[tuple] = set()
        for slot in db.query(models.ScheduleSlot).order_by(models.ScheduleSlot.id).all():
            key = (
                slot.plan_id,
                slot.weekday,
                slot.start_time,
                slot.end_time,
                slot.activity,
                slot.location_id,
                slot.is_all_day,
                slot.slot_type,
                slot.course_id,
            )
            if key in seen:
                db.delete(slot)
            else:
                seen.add(key)
        db.commit()
    finally:
        db.close()