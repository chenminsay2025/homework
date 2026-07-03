from datetime import date, datetime, time
from typing import Literal

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from . import models, schemas
from .deleted_records import (
    ENTITY_COURSE,
    ENTITY_DAILY_ENTRY,
    ENTITY_DAY_MANUAL_ITEM,
    ENTITY_LOCATION,
    ENTITY_PLAN,
    ENTITY_SCHEDULE_EXCEPTION,
    ENTITY_SCHEDULE_SLOT,
    ENTITY_SLOT_DAILY_PLAN,
    ENTITY_SUBJECT,
    ENTITY_TASK,
    build_plan_snapshot,
    build_schedule_slot_snapshot,
    build_subject_snapshot,
    build_task_snapshot,
    list_deleted_records,
    model_to_dict,
    permanent_delete_record,
    record_deletion,
    restore_deleted_record,
)

ACTIVITY_COLORS = {
    "数学": "#3b82f6",
    "语文": "#ec4899",
    "英语": "#22c55e",
    "绘画": "#f59e0b",
    "自安排": "#94a3b8",
}


def infer_slot_type(activity: str, explicit: str | None = None) -> str:
    if explicit:
        return explicit
    return "self_study" if activity == "自安排" else "class"


def _parse_time(value: str | None) -> time | None:
    if not value:
        return None
    parts = value.split(":")
    if len(parts) < 2:
        raise ValueError(f"无效的时间格式: {value}，应为 HH:MM")
    try:
        hour, minute = int(parts[0]), int(parts[1])
        return time(hour, minute)
    except (ValueError, IndexError) as e:
        raise ValueError(f"无效的时间格式: {value}，应为 HH:MM") from e


def _format_time(value: time | None) -> str | None:
    return value.strftime("%H:%M") if value else None


def _task_progress(db: Session, task: models.Task) -> tuple[int, float]:
    completed = (
        db.query(func.coalesce(func.sum(models.DailyEntry.completed_units), 0))
        .filter(models.DailyEntry.task_id == task.id)
        .scalar()
    )
    ratio = min(completed / task.total_units, 1.0) if task.total_units > 0 else 0.0
    return int(completed), round(ratio, 3)


def _plan_attachment_to_out(att: models.PlanAttachment) -> schemas.TaskAttachmentOut:
    return schemas.TaskAttachmentOut(
        id=att.id,
        file_url=att.file_url,
        file_name=att.file_name,
        file_size=att.file_size,
        content_type=att.content_type,
        sort_order=att.sort_order,
    )


def list_plan_task_guide(db: Session, plan_id: int) -> list[schemas.TaskAttachmentOut]:
    rows = (
        db.query(models.PlanAttachment)
        .filter(models.PlanAttachment.plan_id == plan_id)
        .order_by(models.PlanAttachment.sort_order, models.PlanAttachment.id)
        .all()
    )
    return [_plan_attachment_to_out(r) for r in rows]


def replace_plan_task_guide(
    db: Session, plan_id: int, attachments: list[schemas.TaskAttachmentIn]
) -> list[schemas.TaskAttachmentOut]:
    db.query(models.PlanAttachment).filter(models.PlanAttachment.plan_id == plan_id).delete(
        synchronize_session=False
    )
    for i, att in enumerate(attachments):
        db.add(
            models.PlanAttachment(
                plan_id=plan_id,
                file_url=att.file_url,
                file_name=att.file_name,
                file_size=att.file_size,
                content_type=att.content_type,
                sort_order=att.sort_order if att.sort_order else i,
            )
        )
    db.commit()
    return list_plan_task_guide(db, plan_id)


def plan_to_out(db: Session, plan: models.Plan) -> schemas.PlanOut:
    slot_count = db.query(models.ScheduleSlot).filter_by(plan_id=plan.id).count()
    task_count = db.query(models.Task).filter_by(plan_id=plan.id, is_active=True).count()
    return schemas.PlanOut(
        id=plan.id,
        user_id=plan.user_id,
        name=plan.name,
        description=plan.description,
        deadline=plan.deadline,
        is_active=plan.is_active,
        created_at=plan.created_at,
        slot_count=slot_count,
        task_count=task_count,
    )


def list_plans(db: Session, user_id: int) -> list[schemas.PlanOut]:
    plans = (
        db.query(models.Plan)
        .filter(models.Plan.user_id == user_id)
        .order_by(models.Plan.created_at.desc())
        .all()
    )
    return [plan_to_out(db, p) for p in plans]


def get_plan(db: Session, plan_id: int, user_id: int) -> models.Plan | None:
    return (
        db.query(models.Plan)
        .filter(models.Plan.id == plan_id, models.Plan.user_id == user_id)
        .first()
    )


def create_plan(db: Session, user_id: int, data: schemas.PlanCreate) -> schemas.PlanOut:
    plan = models.Plan(user_id=user_id, **data.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan_to_out(db, plan)


def update_plan(
    db: Session, plan_id: int, user_id: int, data: schemas.PlanUpdate
) -> schemas.PlanOut | None:
    plan = get_plan(db, plan_id, user_id)
    if not plan:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return plan_to_out(db, plan)


def delete_plan(
    db: Session, plan_id: int, user_id: int, deleted_by_user_id: int | None = None
) -> bool:
    plan = get_plan(db, plan_id, user_id)
    if not plan:
        return False

    snapshot = build_plan_snapshot(db, plan_id)
    record_deletion(
        db,
        entity_type=ENTITY_PLAN,
        entity_id=plan_id,
        plan_id=plan_id,
        user_id=user_id,
        deleted_by_user_id=deleted_by_user_id or user_id,
        snapshot=snapshot,
    )

    # PostgreSQL 外键安全：先清理跨子树引用，再删 Plan
    db.query(models.ScheduleException).filter_by(plan_id=plan_id).delete(
        synchronize_session=False
    )
    for slot in db.query(models.ScheduleSlot).filter_by(plan_id=plan_id).all():
        slot.course_id = None
        slot.location_id = None
    db.query(models.Course).filter_by(plan_id=plan_id).update(
        {models.Course.default_location_id: None},
        synchronize_session=False,
    )
    db.flush()
    db.delete(plan)
    db.commit()
    return True


def duplicate_plan(db: Session, plan_id: int, user_id: int, new_name: str | None = None) -> schemas.PlanOut | None:
    source = get_plan(db, plan_id, user_id)
    if not source:
        return None
    new_plan = models.Plan(
        user_id=user_id,
        name=new_name or f"{source.name}（副本）",
        description=source.description,
        deadline=source.deadline,
    )
    db.add(new_plan)
    db.flush()

    loc_map: dict[int, int] = {}
    for loc in db.query(models.Location).filter_by(plan_id=plan_id).all():
        new_loc = models.Location(plan_id=new_plan.id, name=loc.name, address=loc.address)
        db.add(new_loc)
        db.flush()
        loc_map[loc.id] = new_loc.id

    course_map: dict[int, int] = {}
    for course in db.query(models.Course).filter_by(plan_id=plan_id).all():
        new_course = models.Course(
            plan_id=new_plan.id,
            name=course.name,
            teacher=course.teacher,
            phone=course.phone,
            description=course.description,
            color=course.color,
            default_location_id=loc_map.get(course.default_location_id) if course.default_location_id else None,
            notes=course.notes,
            sort_order=course.sort_order,
            is_active=course.is_active,
        )
        db.add(new_course)
        db.flush()
        course_map[course.id] = new_course.id

    for slot in db.query(models.ScheduleSlot).filter_by(plan_id=plan_id).all():
        db.add(
            models.ScheduleSlot(
                plan_id=new_plan.id,
                weekday=slot.weekday,
                start_time=slot.start_time,
                end_time=slot.end_time,
                activity=slot.activity,
                location_id=loc_map.get(slot.location_id) if slot.location_id else None,
                is_all_day=slot.is_all_day,
                sort_order=slot.sort_order,
                notes=slot.notes,
                slot_type=slot.slot_type,
                course_id=course_map.get(slot.course_id) if slot.course_id else None,
            )
        )

    sub_map: dict[int, int] = {}
    for sub in db.query(models.Subject).filter_by(plan_id=plan_id).all():
        new_sub = models.Subject(
            plan_id=new_plan.id, name=sub.name, color=sub.color, sort_order=sub.sort_order
        )
        db.add(new_sub)
        db.flush()
        sub_map[sub.id] = new_sub.id

    for task in (
        db.query(models.Task)
        .options(joinedload(models.Task.attachments))
        .filter_by(plan_id=plan_id)
        .all()
    ):
        new_task = models.Task(
            plan_id=new_plan.id,
            subject_id=sub_map[task.subject_id],
            title=task.title,
            description=task.description,
            total_units=task.total_units,
            unit_label=task.unit_label,
            file_url=task.file_url,
            file_name=task.file_name,
            sort_order=task.sort_order,
            is_active=task.is_active,
        )
        db.add(new_task)
        db.flush()
        source_attachments = sorted(
            task.attachments or [],
            key=lambda a: (a.sort_order, a.id),
        )
        if source_attachments:
            for att in source_attachments:
                db.add(
                    models.TaskAttachment(
                        task_id=new_task.id,
                        file_url=att.file_url,
                        file_name=att.file_name,
                        file_size=att.file_size,
                        content_type=att.content_type,
                        sort_order=att.sort_order,
                    )
                )
        elif task.file_url:
            db.add(
                models.TaskAttachment(
                    task_id=new_task.id,
                    file_url=task.file_url,
                    file_name=task.file_name or "附件",
                    sort_order=0,
                )
            )
        _sync_task_legacy_fields(db, new_task)

    db.commit()
    db.refresh(new_plan)
    return plan_to_out(db, new_plan)


def create_plan_from_template(
    db: Session, user_id: int, data: schemas.PlanFromTemplate
) -> schemas.PlanOut:
    plan = models.Plan(
        user_id=user_id,
        name=data.name,
        description=data.description,
        deadline=data.deadline,
    )
    db.add(plan)
    db.flush()

    loc_map: dict[str, int] = {}
    for name in data.locations:
        loc = models.Location(plan_id=plan.id, name=name)
        db.add(loc)
        db.flush()
        loc_map[name] = loc.id

    _ensure_subjects_for_activities(db, plan.id, {s.activity for s in data.slots})
    course_map = _ensure_courses_for_activities(db, plan.id, {s.activity for s in data.slots})

    for slot_data in data.slots:
        location_id = loc_map.get(slot_data.location_name) if slot_data.location_name else None
        course_id = course_map.get(slot_data.activity) if slot_data.activity != "自安排" else None
        if course_id and not location_id:
            course = db.get(models.Course, course_id)
            if course and course.default_location_id:
                location_id = course.default_location_id
        db.add(
            models.ScheduleSlot(
                plan_id=plan.id,
                weekday=slot_data.weekday,
                start_time=_parse_time(slot_data.start_time),
                end_time=_parse_time(slot_data.end_time),
                activity=slot_data.activity,
                location_id=location_id,
                is_all_day=slot_data.is_all_day,
                sort_order=slot_data.sort_order,
                slot_type=infer_slot_type(slot_data.activity, slot_data.slot_type),
                course_id=course_id,
            )
        )

    db.commit()
    db.refresh(plan)
    return plan_to_out(db, plan)


def _ensure_subjects_for_activities(db: Session, plan_id: int, activities: set[str]) -> None:
    existing = {s.name for s in db.query(models.Subject).filter_by(plan_id=plan_id).all()}
    order = len(existing)
    for activity in activities:
        if activity in ("自安排",) or activity in existing:
            continue
        db.add(
            models.Subject(
                plan_id=plan_id,
                name=activity,
                color=ACTIVITY_COLORS.get(activity, "#6366f1"),
                sort_order=order,
            )
        )
        order += 1
    db.flush()


def location_to_out(loc: models.Location) -> schemas.LocationOut:
    return schemas.LocationOut.model_validate(loc)


def list_locations(db: Session, plan_id: int) -> list[schemas.LocationOut]:
    locs = db.query(models.Location).filter_by(plan_id=plan_id).order_by(models.Location.id).all()
    return [location_to_out(l) for l in locs]


def create_location(db: Session, plan_id: int, data: schemas.LocationCreate) -> schemas.LocationOut:
    loc = models.Location(plan_id=plan_id, **data.model_dump())
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return location_to_out(loc)


def update_location(
    db: Session, location_id: int, plan_id: int, data: schemas.LocationUpdate
) -> schemas.LocationOut | None:
    loc = (
        db.query(models.Location)
        .filter(models.Location.id == location_id, models.Location.plan_id == plan_id)
        .first()
    )
    if not loc:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(loc, key, value)
    db.commit()
    db.refresh(loc)
    return location_to_out(loc)


def delete_location(
    db: Session, location_id: int, plan_id: int, deleted_by_user_id: int | None = None
) -> bool:
    loc = (
        db.query(models.Location)
        .filter(models.Location.id == location_id, models.Location.plan_id == plan_id)
        .first()
    )
    if not loc:
        return False
    plan = db.get(models.Plan, plan_id)
    if not plan:
        return False
    record_deletion(
        db,
        entity_type=ENTITY_LOCATION,
        entity_id=location_id,
        plan_id=plan_id,
        user_id=plan.user_id,
        deleted_by_user_id=deleted_by_user_id or plan.user_id,
        snapshot={"entity": model_to_dict(loc)},
    )
    for slot in db.query(models.ScheduleSlot).filter_by(location_id=location_id).all():
        slot.location_id = None
    for course in db.query(models.Course).filter_by(default_location_id=location_id).all():
        course.default_location_id = None
    for exc in db.query(models.ScheduleException).filter_by(location_id=location_id).all():
        exc.location_id = None
    db.delete(loc)
    db.commit()
    return True


def course_to_out(db: Session | None, course: models.Course, count_slots: bool = True) -> schemas.CourseOut:
    slot_count = 0
    if count_slots and db is not None:
        slot_count = db.query(models.ScheduleSlot).filter_by(course_id=course.id).count()
    return schemas.CourseOut(
        id=course.id,
        plan_id=course.plan_id,
        name=course.name,
        teacher=course.teacher,
        phone=course.phone,
        description=course.description,
        color=course.color,
        default_location_id=course.default_location_id,
        notes=course.notes,
        sort_order=course.sort_order,
        is_active=course.is_active,
        slot_count=slot_count,
        default_location=location_to_out(course.default_location) if course.default_location else None,
    )


def list_courses(db: Session, plan_id: int, active_only: bool = False) -> list[schemas.CourseOut]:
    query = (
        db.query(models.Course)
        .options(joinedload(models.Course.default_location))
        .filter(models.Course.plan_id == plan_id)
    )
    if active_only:
        query = query.filter(models.Course.is_active.is_(True))
    courses = query.order_by(models.Course.sort_order, models.Course.id).all()
    return [course_to_out(db, c) for c in courses]


def get_course(db: Session, course_id: int, plan_id: int) -> models.Course | None:
    return (
        db.query(models.Course)
        .options(joinedload(models.Course.default_location))
        .filter(models.Course.id == course_id, models.Course.plan_id == plan_id)
        .first()
    )


def create_course(db: Session, plan_id: int, data: schemas.CourseCreate) -> schemas.CourseOut:
    payload = data.model_dump()
    if payload.get("sort_order", 0) == 0:
        max_order = (
            db.query(func.coalesce(func.max(models.Course.sort_order), -1))
            .filter(models.Course.plan_id == plan_id)
            .scalar()
        )
        payload["sort_order"] = max_order + 1
    course = models.Course(plan_id=plan_id, **payload)
    db.add(course)
    db.commit()
    db.refresh(course)
    course = get_course(db, course.id, plan_id)
    return course_to_out(db, course)


def update_course(
    db: Session, course_id: int, plan_id: int, data: schemas.CourseUpdate
) -> schemas.CourseOut | None:
    course = get_course(db, course_id, plan_id)
    if not course:
        return None
    updates = data.model_dump(exclude_unset=True)
    if "name" in updates:
        new_name = updates["name"]
        for slot in db.query(models.ScheduleSlot).filter_by(course_id=course.id).all():
            slot.activity = new_name
    for key, value in updates.items():
        setattr(course, key, value)
    db.commit()
    course = get_course(db, course_id, plan_id)
    return course_to_out(db, course)


def delete_course(
    db: Session, course_id: int, plan_id: int, deleted_by_user_id: int | None = None
) -> bool:
    course = get_course(db, course_id, plan_id)
    if not course:
        return False
    plan = db.get(models.Plan, plan_id)
    if not plan:
        return False
    record_deletion(
        db,
        entity_type=ENTITY_COURSE,
        entity_id=course_id,
        plan_id=plan_id,
        user_id=plan.user_id,
        deleted_by_user_id=deleted_by_user_id or plan.user_id,
        snapshot={"entity": model_to_dict(course)},
    )
    for slot in db.query(models.ScheduleSlot).filter_by(course_id=course.id).all():
        slot.course_id = None
    db.delete(course)
    db.commit()
    return True


def reorder_courses(db: Session, plan_id: int, ids: list[int]) -> list[schemas.CourseOut]:
    courses = db.query(models.Course).filter(models.Course.plan_id == plan_id).all()
    course_ids = {c.id for c in courses}
    if set(ids) != course_ids:
        raise ValueError("排序列表与现有课程不一致")
    id_map = {c.id: c for c in courses}
    for index, course_id in enumerate(ids):
        id_map[course_id].sort_order = index
    db.commit()
    return list_courses(db, plan_id)


def _ensure_courses_for_activities(db: Session, plan_id: int, activities: set[str]) -> dict[str, int]:
    existing = {
        c.name: c.id
        for c in db.query(models.Course).filter_by(plan_id=plan_id).all()
    }
    order = len(existing)
    for activity in activities:
        if activity in ("自安排",) or activity in existing:
            continue
        course = models.Course(
            plan_id=plan_id,
            name=activity,
            color=ACTIVITY_COLORS.get(activity, "#6366f1"),
            sort_order=order,
        )
        db.add(course)
        db.flush()
        existing[activity] = course.id
        order += 1
    return existing

def slot_to_out(
    slot: models.ScheduleSlot,
    daily_plan: models.SlotDailyPlan | None = None,
    exception: models.ScheduleException | None = None,
    db: Session | None = None,
) -> schemas.ScheduleSlotOut:
    plan_out = None
    if daily_plan and db:
        plan_out = slot_daily_plan_to_out(db, daily_plan, include_slot=False)

    day_status: Literal["normal", "cancelled", "rescheduled"] = "normal"
    exc_out = None
    effective_start = _format_time(slot.start_time)
    effective_end = _format_time(slot.end_time)
    effective_loc = location_to_out(slot.location) if slot.location else None

    if exception:
        exc_out = exception_to_out(exception)
        if exception.exception_type == "cancelled":
            day_status = "cancelled"
        elif exception.exception_type == "rescheduled":
            day_status = "rescheduled"
            if exception.start_time is not None:
                effective_start = _format_time(exception.start_time)
            if exception.end_time is not None:
                effective_end = _format_time(exception.end_time)
            if exception.location:
                effective_loc = location_to_out(exception.location)

    return schemas.ScheduleSlotOut(
        id=slot.id,
        plan_id=slot.plan_id,
        weekday=slot.weekday,
        start_time=_format_time(slot.start_time),
        end_time=_format_time(slot.end_time),
        activity=slot.activity,
        location_id=slot.location_id,
        is_all_day=slot.is_all_day,
        sort_order=slot.sort_order,
        notes=slot.notes,
        slot_type=slot.slot_type,
        course_id=slot.course_id,
        default_task_id=slot.default_task_id,
        location=location_to_out(slot.location) if slot.location else None,
        course=course_to_out(db, slot.course, count_slots=False) if slot.course and db else None,
        default_task=task_to_out(db, slot.default_task) if slot.default_task and db else None,
        daily_plan=plan_out,
        day_status=day_status,
        exception=exc_out,
        effective_start_time=effective_start,
        effective_end_time=effective_end,
        effective_location=effective_loc,
    )


def list_schedule_slots(db: Session, plan_id: int) -> list[schemas.ScheduleSlotOut]:
    slots = (
        db.query(models.ScheduleSlot)
        .options(
            joinedload(models.ScheduleSlot.location),
            joinedload(models.ScheduleSlot.course).joinedload(models.Course.default_location),
            joinedload(models.ScheduleSlot.default_task).joinedload(models.Task.subject),
        )
        .filter_by(plan_id=plan_id)
        .order_by(models.ScheduleSlot.weekday, models.ScheduleSlot.sort_order, models.ScheduleSlot.start_time)
        .all()
    )
    return [slot_to_out(s, db=db) for s in slots]


def list_schedule_for_date(db: Session, plan_id: int, target_date: date) -> list[schemas.ScheduleSlotOut]:
    weekday = target_date.weekday()
    slots = (
        db.query(models.ScheduleSlot)
        .options(
            joinedload(models.ScheduleSlot.location),
            joinedload(models.ScheduleSlot.course).joinedload(models.Course.default_location),
            joinedload(models.ScheduleSlot.default_task).joinedload(models.Task.subject),
        )
        .filter(models.ScheduleSlot.plan_id == plan_id, models.ScheduleSlot.weekday == weekday)
        .order_by(models.ScheduleSlot.sort_order, models.ScheduleSlot.start_time)
        .all()
    )
    slot_ids = [s.id for s in slots]
    plans_by_slot: dict[int, models.SlotDailyPlan] = {}
    if slot_ids:
        self_study_ids = [s.id for s in slots if s.slot_type == "self_study"]
        if self_study_ids:
            daily_plans = (
                db.query(models.SlotDailyPlan)
                .options(
                    joinedload(models.SlotDailyPlan.task).joinedload(models.Task.subject),
                )
                .filter(
                    models.SlotDailyPlan.slot_id.in_(self_study_ids),
                    models.SlotDailyPlan.date == target_date,
                )
                .all()
            )
            plans_by_slot = {p.slot_id: p for p in daily_plans}

        exceptions = (
            db.query(models.ScheduleException)
            .options(joinedload(models.ScheduleException.location))
            .filter(
                models.ScheduleException.plan_id == plan_id,
                models.ScheduleException.slot_id.in_(slot_ids),
                models.ScheduleException.date == target_date,
            )
            .all()
        )
        exceptions_by_slot = {e.slot_id: e for e in exceptions}
    else:
        exceptions_by_slot = {}

    return [
        slot_to_out(s, plans_by_slot.get(s.id), exceptions_by_slot.get(s.id), db=db)
        for s in slots
    ]


def _schedule_slot_identity(
    weekday: int,
    start_time: time | None,
    end_time: time | None,
    activity: str,
    location_id: int | None,
    is_all_day: bool,
    slot_type: str,
    course_id: int | None,
) -> tuple:
    return (
        weekday,
        start_time,
        end_time,
        activity,
        location_id,
        is_all_day,
        slot_type,
        course_id,
    )


def _find_existing_schedule_slot(db: Session, plan_id: int, identity: tuple) -> models.ScheduleSlot | None:
    weekday, start_time, end_time, activity, location_id, is_all_day, slot_type, course_id = identity
    for slot in db.query(models.ScheduleSlot).filter_by(plan_id=plan_id, weekday=weekday).all():
        if _schedule_slot_identity(
            slot.weekday,
            slot.start_time,
            slot.end_time,
            slot.activity,
            slot.location_id,
            slot.is_all_day,
            slot.slot_type,
            slot.course_id,
        ) == identity:
            return slot
    return None


def _validate_default_task(
    db: Session, plan_id: int, default_task_id: int | None, slot_type: str
) -> None:
    if default_task_id is None:
        return
    if slot_type != "self_study":
        raise ValueError("仅自安排时段可绑定默认任务")
    task = get_task(db, default_task_id, plan_id)
    if not task:
        raise ValueError("任务不存在")


def create_schedule_slot(
    db: Session, plan_id: int, data: schemas.ScheduleSlotCreate
) -> schemas.ScheduleSlotOut:
    payload = data.model_dump()
    if payload.get("course_id"):
        course = get_course(db, payload["course_id"], plan_id)
        if not course:
            raise ValueError("课程不存在")
        payload["activity"] = course.name
        if not payload.get("location_id") and course.default_location_id:
            payload["location_id"] = course.default_location_id
        payload["slot_type"] = payload.get("slot_type") or "class"
    _ensure_subjects_for_activities(db, plan_id, {payload["activity"]})
    slot_type = infer_slot_type(payload["activity"], payload.get("slot_type"))
    if payload.get("course_id") is None and payload["activity"] != "自安排" and slot_type != "self_study":
        course_map = _ensure_courses_for_activities(db, plan_id, {payload["activity"]})
        payload["course_id"] = course_map.get(payload["activity"])
    start_time = _parse_time(payload.get("start_time"))
    end_time = _parse_time(payload.get("end_time"))
    identity = _schedule_slot_identity(
        payload["weekday"],
        start_time,
        end_time,
        payload["activity"],
        payload.get("location_id"),
        payload.get("is_all_day", False),
        slot_type,
        payload.get("course_id"),
    )
    existing = _find_existing_schedule_slot(db, plan_id, identity)
    if existing:
        raise ValueError("该时段已存在，请勿重复添加")
    default_task_id = payload.get("default_task_id")
    _validate_default_task(db, plan_id, default_task_id, slot_type)
    slot = models.ScheduleSlot(
        plan_id=plan_id,
        weekday=payload["weekday"],
        start_time=start_time,
        end_time=end_time,
        activity=payload["activity"],
        location_id=payload.get("location_id"),
        is_all_day=payload.get("is_all_day", False),
        sort_order=payload.get("sort_order", 0),
        notes=payload.get("notes"),
        slot_type=slot_type,
        course_id=payload.get("course_id"),
        default_task_id=default_task_id,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    slot = (
        db.query(models.ScheduleSlot)
        .options(
            joinedload(models.ScheduleSlot.location),
            joinedload(models.ScheduleSlot.course).joinedload(models.Course.default_location),
            joinedload(models.ScheduleSlot.default_task).joinedload(models.Task.subject),
        )
        .filter(models.ScheduleSlot.id == slot.id)
        .first()
    )
    return slot_to_out(slot, db=db)


def update_schedule_slot(
    db: Session, slot_id: int, plan_id: int, data: schemas.ScheduleSlotUpdate
) -> schemas.ScheduleSlotOut | None:
    slot = (
        db.query(models.ScheduleSlot)
        .options(
            joinedload(models.ScheduleSlot.location),
            joinedload(models.ScheduleSlot.course).joinedload(models.Course.default_location),
        )
        .filter(models.ScheduleSlot.id == slot_id, models.ScheduleSlot.plan_id == plan_id)
        .first()
    )
    if not slot:
        return None
    updates = data.model_dump(exclude_unset=True)
    if "start_time" in updates:
        slot.start_time = _parse_time(updates.pop("start_time"))
    if "end_time" in updates:
        slot.end_time = _parse_time(updates.pop("end_time"))
    if updates.get("course_id"):
        course = get_course(db, updates["course_id"], plan_id)
        if not course:
            raise ValueError("课程不存在")
        updates["activity"] = course.name
        if "location_id" not in updates and course.default_location_id:
            updates["location_id"] = course.default_location_id
        updates["slot_type"] = updates.get("slot_type") or "class"
    next_type = updates.get("slot_type", slot.slot_type)
    if next_type == "self_study":
        updates["course_id"] = None
    else:
        updates["default_task_id"] = None
    if "activity" in updates:
        _ensure_subjects_for_activities(db, plan_id, {updates["activity"]})
        if "slot_type" not in updates:
            updates["slot_type"] = infer_slot_type(updates["activity"])
        next_type = updates.get("slot_type", slot.slot_type)
        if updates["activity"] != "自安排" and not updates.get("course_id") and next_type != "self_study":
            course_map = _ensure_courses_for_activities(db, plan_id, {updates["activity"]})
            updates["course_id"] = course_map.get(updates["activity"])
    final_type = updates.get("slot_type", slot.slot_type)
    if "default_task_id" in updates or final_type == "self_study":
        default_task_id = updates.get("default_task_id", slot.default_task_id)
        _validate_default_task(db, plan_id, default_task_id, final_type)
    for key, value in updates.items():
        setattr(slot, key, value)
    db.commit()
    db.refresh(slot)
    slot = (
        db.query(models.ScheduleSlot)
        .options(
            joinedload(models.ScheduleSlot.location),
            joinedload(models.ScheduleSlot.course).joinedload(models.Course.default_location),
            joinedload(models.ScheduleSlot.default_task).joinedload(models.Task.subject),
        )
        .filter(models.ScheduleSlot.id == slot_id)
        .first()
    )
    return slot_to_out(slot, db=db)


def delete_schedule_slot(
    db: Session, slot_id: int, plan_id: int, deleted_by_user_id: int | None = None
) -> bool:
    slot = (
        db.query(models.ScheduleSlot)
        .filter(models.ScheduleSlot.id == slot_id, models.ScheduleSlot.plan_id == plan_id)
        .first()
    )
    if not slot:
        return False
    plan = db.get(models.Plan, plan_id)
    if not plan:
        return False
    record_deletion(
        db,
        entity_type=ENTITY_SCHEDULE_SLOT,
        entity_id=slot_id,
        plan_id=plan_id,
        user_id=plan.user_id,
        deleted_by_user_id=deleted_by_user_id or plan.user_id,
        snapshot=build_schedule_slot_snapshot(db, slot),
    )
    db.delete(slot)
    db.commit()
    return True


def exception_to_out(exc: models.ScheduleException) -> schemas.ScheduleExceptionOut:
    return schemas.ScheduleExceptionOut(
        id=exc.id,
        plan_id=exc.plan_id,
        slot_id=exc.slot_id,
        date=exc.date,
        exception_type=exc.exception_type,
        reason=exc.reason,
        start_time=_format_time(exc.start_time),
        end_time=_format_time(exc.end_time),
        location_id=exc.location_id,
        notes=exc.notes,
        created_at=exc.created_at,
        location=location_to_out(exc.location) if exc.location else None,
    )


def list_schedule_exceptions(
    db: Session, plan_id: int, target_date: date | None = None
) -> list[schemas.ScheduleExceptionOut]:
    query = (
        db.query(models.ScheduleException)
        .options(joinedload(models.ScheduleException.location))
        .filter(models.ScheduleException.plan_id == plan_id)
    )
    if target_date:
        query = query.filter(models.ScheduleException.date == target_date)
    items = query.order_by(models.ScheduleException.date.desc()).all()
    return [exception_to_out(e) for e in items]


def create_schedule_exception(
    db: Session, plan_id: int, data: schemas.ScheduleExceptionCreate
) -> schemas.ScheduleExceptionOut:
    slot = _get_slot_in_plan(db, data.slot_id, plan_id)
    if not slot:
        raise ValueError("时段不存在")
    if data.exception_type == "rescheduled" and not data.start_time and not data.end_time:
        raise ValueError("改期请填写新的开始或结束时间")
    existing = (
        db.query(models.ScheduleException)
        .filter(
            models.ScheduleException.slot_id == data.slot_id,
            models.ScheduleException.date == data.date,
        )
        .first()
    )
    if existing:
        raise ValueError("该时段当天已有调整，请先修改或删除原记录")
    exc = models.ScheduleException(
        plan_id=plan_id,
        slot_id=data.slot_id,
        date=data.date,
        exception_type=data.exception_type,
        reason=data.reason,
        start_time=_parse_time(data.start_time),
        end_time=_parse_time(data.end_time),
        location_id=data.location_id,
        notes=data.notes,
    )
    db.add(exc)
    db.commit()
    db.refresh(exc)
    exc = (
        db.query(models.ScheduleException)
        .options(joinedload(models.ScheduleException.location))
        .filter(models.ScheduleException.id == exc.id)
        .first()
    )
    return exception_to_out(exc)


def update_schedule_exception(
    db: Session, plan_id: int, exc_id: int, data: schemas.ScheduleExceptionUpdate
) -> schemas.ScheduleExceptionOut | None:
    exc = (
        db.query(models.ScheduleException)
        .options(joinedload(models.ScheduleException.location))
        .filter(
            models.ScheduleException.id == exc_id,
            models.ScheduleException.plan_id == plan_id,
        )
        .first()
    )
    if not exc:
        return None
    updates = data.model_dump(exclude_unset=True)
    if "start_time" in updates:
        exc.start_time = _parse_time(updates.pop("start_time"))
    if "end_time" in updates:
        exc.end_time = _parse_time(updates.pop("end_time"))
    for key, value in updates.items():
        setattr(exc, key, value)
    db.commit()
    db.refresh(exc)
    exc = (
        db.query(models.ScheduleException)
        .options(joinedload(models.ScheduleException.location))
        .filter(models.ScheduleException.id == exc.id)
        .first()
    )
    return exception_to_out(exc)


def delete_schedule_exception(
    db: Session, plan_id: int, exc_id: int, deleted_by_user_id: int | None = None
) -> bool:
    exc = (
        db.query(models.ScheduleException)
        .filter(
            models.ScheduleException.id == exc_id,
            models.ScheduleException.plan_id == plan_id,
        )
        .first()
    )
    if not exc:
        return False
    plan = db.get(models.Plan, plan_id)
    if not plan:
        return False
    record_deletion(
        db,
        entity_type=ENTITY_SCHEDULE_EXCEPTION,
        entity_id=exc_id,
        plan_id=plan_id,
        user_id=plan.user_id,
        deleted_by_user_id=deleted_by_user_id or plan.user_id,
        snapshot={"entity": model_to_dict(exc)},
    )
    db.delete(exc)
    db.commit()
    return True


def _default_slot_plan_description(task: models.Task, planned_units: int) -> str:
    base = (task.description or task.title).strip()
    return f"{base}（今日 {planned_units}{task.unit_label}）"


def _slot_plan_query_options():
    return (
        joinedload(models.SlotDailyPlan.slot).joinedload(models.ScheduleSlot.location),
        joinedload(models.SlotDailyPlan.task).joinedload(models.Task.subject),
    )


def slot_daily_plan_to_out(
    db: Session, plan: models.SlotDailyPlan, include_slot: bool = True
) -> schemas.SlotDailyPlanOut:
    slot_out = None
    if include_slot and plan.slot:
        slot_out = slot_to_out(plan.slot, daily_plan=None)
    task_out = task_to_out(db, plan.task) if plan.task else None
    return schemas.SlotDailyPlanOut(
        id=plan.id,
        slot_id=plan.slot_id,
        date=plan.date,
        task_id=plan.task_id,
        description=plan.description,
        planned_units=plan.planned_units,
        status=plan.status,
        score=plan.score,
        notes=plan.notes,
        created_at=plan.created_at,
        slot=slot_out,
        task=task_out,
    )


def _get_daily_entry_for_task_date(
    db: Session, task_id: int, entry_date: date
) -> models.DailyEntry | None:
    return (
        db.query(models.DailyEntry)
        .filter(models.DailyEntry.task_id == task_id, models.DailyEntry.date == entry_date)
        .first()
    )


def _sync_slot_plan_daily_entry(
    db: Session, plan_id: int, slot_plan: models.SlotDailyPlan, score: float | None = None
) -> None:
    if not slot_plan.task_id:
        return
    task = get_task(db, slot_plan.task_id, plan_id)
    if not task:
        return
    entry = _get_daily_entry_for_task_date(db, slot_plan.task_id, slot_plan.date)
    if not entry:
        entry = models.DailyEntry(
            task_id=slot_plan.task_id,
            date=slot_plan.date,
            planned_description=slot_plan.description,
            planned_units=slot_plan.planned_units,
            completed_units=slot_plan.planned_units,
            status="completed",
            score=score if score is not None else slot_plan.score,
        )
        db.add(entry)
        return
    entry.planned_description = slot_plan.description
    entry.planned_units = max(entry.planned_units, slot_plan.planned_units)
    entry.completed_units = max(entry.completed_units, slot_plan.planned_units)
    if entry.completed_units >= entry.planned_units:
        entry.status = "completed"
    elif entry.completed_units > 0:
        entry.status = "partial"
    if score is not None:
        entry.score = score


def _revert_slot_plan_daily_entry(db: Session, slot_plan: models.SlotDailyPlan) -> None:
    if not slot_plan.task_id:
        return
    entry = _get_daily_entry_for_task_date(db, slot_plan.task_id, slot_plan.date)
    if not entry:
        return
    entry.completed_units = max(0, entry.completed_units - slot_plan.planned_units)
    if entry.completed_units == 0:
        entry.status = "planned"
        entry.score = None
    elif entry.completed_units < entry.planned_units:
        entry.status = "partial"
    else:
        entry.status = "completed"


def list_slot_daily_plans(
    db: Session, plan_id: int, target_date: date | None = None
) -> list[schemas.SlotDailyPlanOut]:
    query = (
        db.query(models.SlotDailyPlan)
        .join(models.ScheduleSlot)
        .options(*_slot_plan_query_options())
        .filter(models.ScheduleSlot.plan_id == plan_id)
    )
    if target_date:
        query = query.filter(models.SlotDailyPlan.date == target_date)
    plans = query.order_by(models.SlotDailyPlan.date.desc(), models.SlotDailyPlan.id).all()
    return [slot_daily_plan_to_out(db, p) for p in plans]


def _get_slot_in_plan(db: Session, slot_id: int, plan_id: int) -> models.ScheduleSlot | None:
    return (
        db.query(models.ScheduleSlot)
        .filter(models.ScheduleSlot.id == slot_id, models.ScheduleSlot.plan_id == plan_id)
        .first()
    )


def create_slot_daily_plan(
    db: Session, plan_id: int, data: schemas.SlotDailyPlanCreate
) -> schemas.SlotDailyPlanOut:
    slot = _get_slot_in_plan(db, data.slot_id, plan_id)
    if not slot:
        raise ValueError("时段不存在")
    if slot.slot_type != "self_study":
        raise ValueError("仅自安排时段可绑定作业任务")
    task = get_task(db, data.task_id, plan_id)
    if not task:
        raise ValueError("任务不存在")
    existing = (
        db.query(models.SlotDailyPlan)
        .filter(models.SlotDailyPlan.slot_id == data.slot_id, models.SlotDailyPlan.date == data.date)
        .first()
    )
    if existing:
        raise ValueError("该时段当天已有计划，请直接编辑")
    description = (data.description or "").strip() or _default_slot_plan_description(task, data.planned_units)
    plan = models.SlotDailyPlan(
        slot_id=data.slot_id,
        date=data.date,
        task_id=data.task_id,
        description=description,
        planned_units=data.planned_units,
        notes=data.notes,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    plan = (
        db.query(models.SlotDailyPlan)
        .options(*_slot_plan_query_options())
        .filter(models.SlotDailyPlan.id == plan.id)
        .first()
    )
    return slot_daily_plan_to_out(db, plan)


def update_slot_daily_plan(
    db: Session, plan_id: int, plan_entry_id: int, data: schemas.SlotDailyPlanUpdate
) -> schemas.SlotDailyPlanOut | None:
    plan = (
        db.query(models.SlotDailyPlan)
        .join(models.ScheduleSlot)
        .options(*_slot_plan_query_options())
        .filter(
            models.SlotDailyPlan.id == plan_entry_id,
            models.ScheduleSlot.plan_id == plan_id,
        )
        .first()
    )
    if not plan:
        return None
    was_completed = plan.status == "completed"
    updates = data.model_dump(exclude_unset=True)
    if "task_id" in updates and updates["task_id"] is not None:
        task = get_task(db, updates["task_id"], plan_id)
        if not task:
            raise ValueError("任务不存在")
    for key, value in updates.items():
        setattr(plan, key, value)
    if plan.task_id and ("task_id" in updates or "planned_units" in updates) and "description" not in updates:
        task = plan.task or get_task(db, plan.task_id, plan_id)
        if task:
            plan.description = _default_slot_plan_description(task, plan.planned_units)
    if was_completed and plan.status == "planned":
        _revert_slot_plan_daily_entry(db, plan)
    db.commit()
    db.refresh(plan)
    plan = (
        db.query(models.SlotDailyPlan)
        .options(*_slot_plan_query_options())
        .filter(models.SlotDailyPlan.id == plan.id)
        .first()
    )
    return slot_daily_plan_to_out(db, plan)


def complete_slot_daily_plan(
    db: Session, plan_id: int, plan_entry_id: int, score: float | None = None
) -> schemas.SlotDailyPlanOut | None:
    plan = (
        db.query(models.SlotDailyPlan)
        .join(models.ScheduleSlot)
        .options(*_slot_plan_query_options())
        .filter(
            models.SlotDailyPlan.id == plan_entry_id,
            models.ScheduleSlot.plan_id == plan_id,
        )
        .first()
    )
    if not plan:
        return None
    plan.status = "completed"
    if score is not None:
        plan.score = score
    _sync_slot_plan_daily_entry(db, plan_id, plan, score)
    db.commit()
    db.refresh(plan)
    plan = (
        db.query(models.SlotDailyPlan)
        .options(*_slot_plan_query_options())
        .filter(models.SlotDailyPlan.id == plan.id)
        .first()
    )
    return slot_daily_plan_to_out(db, plan)


def delete_slot_daily_plan(
    db: Session, plan_id: int, plan_entry_id: int, deleted_by_user_id: int | None = None
) -> bool:
    plan = (
        db.query(models.SlotDailyPlan)
        .join(models.ScheduleSlot)
        .filter(
            models.SlotDailyPlan.id == plan_entry_id,
            models.ScheduleSlot.plan_id == plan_id,
        )
        .first()
    )
    if not plan:
        return False
    owner = db.get(models.Plan, plan_id)
    if not owner:
        return False
    record_deletion(
        db,
        entity_type=ENTITY_SLOT_DAILY_PLAN,
        entity_id=plan_entry_id,
        plan_id=plan_id,
        user_id=owner.user_id,
        deleted_by_user_id=deleted_by_user_id or owner.user_id,
        snapshot={"entity": model_to_dict(plan)},
    )
    db.delete(plan)
    db.commit()
    return True


def list_subjects(db: Session, plan_id: int) -> list[models.Subject]:
    return (
        db.query(models.Subject)
        .filter_by(plan_id=plan_id)
        .order_by(models.Subject.sort_order, models.Subject.id)
        .all()
    )


def create_subject(db: Session, plan_id: int, data: schemas.SubjectCreate) -> models.Subject:
    payload = data.model_dump()
    if payload.get("sort_order", 0) == 0:
        max_order = (
            db.query(func.coalesce(func.max(models.Subject.sort_order), -1))
            .filter(models.Subject.plan_id == plan_id)
            .scalar()
        )
        payload["sort_order"] = max_order + 1
    subject = models.Subject(plan_id=plan_id, **payload)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def reorder_subjects(db: Session, plan_id: int, ids: list[int]) -> list[models.Subject]:
    subjects = db.query(models.Subject).filter(models.Subject.plan_id == plan_id).all()
    subject_ids = {s.id for s in subjects}
    if set(ids) != subject_ids:
        raise ValueError("排序列表与现有作业安排不一致")
    id_map = {s.id: s for s in subjects}
    for index, subject_id in enumerate(ids):
        id_map[subject_id].sort_order = index
    db.commit()
    return list_subjects(db, plan_id)


def get_subject(db: Session, subject_id: int, plan_id: int) -> models.Subject | None:
    return (
        db.query(models.Subject)
        .filter(models.Subject.id == subject_id, models.Subject.plan_id == plan_id)
        .first()
    )


def update_subject(
    db: Session, subject_id: int, plan_id: int, data: schemas.SubjectUpdate
) -> models.Subject | None:
    subject = get_subject(db, subject_id, plan_id)
    if not subject:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(subject, key, value)
    db.commit()
    db.refresh(subject)
    return subject


def delete_subject(
    db: Session, subject_id: int, plan_id: int, deleted_by_user_id: int | None = None
) -> bool:
    subject = get_subject(db, subject_id, plan_id)
    if not subject:
        return False
    plan = db.get(models.Plan, plan_id)
    if not plan:
        return False
    record_deletion(
        db,
        entity_type=ENTITY_SUBJECT,
        entity_id=subject_id,
        plan_id=plan_id,
        user_id=plan.user_id,
        deleted_by_user_id=deleted_by_user_id or plan.user_id,
        snapshot=build_subject_snapshot(db, subject),
    )
    db.delete(subject)
    db.commit()
    return True


def _replace_task_attachments(
    db: Session, task: models.Task, attachments: list[schemas.TaskAttachmentIn]
) -> None:
    db.query(models.TaskAttachment).filter_by(task_id=task.id).delete()
    for i, att in enumerate(attachments):
        db.add(
            models.TaskAttachment(
                task_id=task.id,
                file_url=att.file_url,
                file_name=att.file_name,
                file_size=att.file_size,
                content_type=att.content_type,
                sort_order=att.sort_order if att.sort_order else i,
            )
        )


def _sync_task_legacy_fields(db: Session, task: models.Task) -> None:
    db.refresh(task, ["attachments"])
    atts = sorted(task.attachments, key=lambda a: (a.sort_order, a.id))
    if atts:
        task.file_url = atts[0].file_url
        task.file_name = atts[0].file_name
    else:
        task.file_url = None
        task.file_name = None


def _task_attachments_for_out(task: models.Task) -> list[schemas.TaskAttachmentOut]:
    atts = sorted(task.attachments or [], key=lambda a: (a.sort_order, a.id))
    if atts:
        return [schemas.TaskAttachmentOut.model_validate(a) for a in atts]
    if task.file_url:
        return [
            schemas.TaskAttachmentOut(
                id=0,
                file_url=task.file_url,
                file_name=task.file_name or "附件",
                file_size=None,
                content_type=None,
                sort_order=0,
            )
        ]
    return []


def task_to_out(db: Session, task: models.Task, include_subject: bool = True) -> schemas.TaskOut:
    completed, ratio = _task_progress(db, task)
    attachments = _task_attachments_for_out(task)
    return schemas.TaskOut(
        id=task.id,
        plan_id=task.plan_id,
        subject_id=task.subject_id,
        title=task.title,
        description=task.description,
        total_units=task.total_units,
        unit_label=task.unit_label,
        file_url=attachments[0].file_url if attachments else task.file_url,
        file_name=attachments[0].file_name if attachments else task.file_name,
        attachments=attachments,
        sort_order=task.sort_order,
        is_active=task.is_active,
        completed_units=completed,
        progress_ratio=ratio,
        subject=schemas.SubjectOut.model_validate(task.subject) if include_subject and task.subject else None,
    )


def list_tasks(db: Session, plan_id: int, active_only: bool = True) -> list[schemas.TaskOut]:
    query = (
        db.query(models.Task)
        .options(joinedload(models.Task.subject), joinedload(models.Task.attachments))
        .filter(models.Task.plan_id == plan_id)
    )
    if active_only:
        query = query.filter(models.Task.is_active.is_(True))
    tasks = query.order_by(models.Task.sort_order, models.Task.id).all()
    return [task_to_out(db, t) for t in tasks]


def get_task_last_activity(
    db: Session,
    plan_id: int,
    task_id: int,
    before_date: date | None = None,
    exclude_item_id: int | None = None,
) -> schemas.TaskLastActivityOut | None:
    task = get_task(db, task_id, plan_id)
    if not task:
        return None

    daily_q = db.query(models.DailyEntry).filter(models.DailyEntry.task_id == task_id)
    if before_date:
        daily_q = daily_q.filter(models.DailyEntry.date < before_date)
    last_daily = daily_q.order_by(models.DailyEntry.date.desc(), models.DailyEntry.id.desc()).first()

    manual_q = db.query(models.DayManualItem).filter(
        models.DayManualItem.plan_id == plan_id,
        models.DayManualItem.task_id == task_id,
    )
    if before_date:
        manual_q = manual_q.filter(models.DayManualItem.date < before_date)
    if exclude_item_id:
        manual_q = manual_q.filter(models.DayManualItem.id != exclude_item_id)
    last_manual = manual_q.order_by(
        models.DayManualItem.date.desc(),
        models.DayManualItem.id.desc(),
    ).first()

    candidates: list[tuple[date, int, str, models.DailyEntry | models.DayManualItem]] = []
    if last_daily:
        candidates.append((last_daily.date, last_daily.id, "daily", last_daily))
    if last_manual:
        candidates.append((last_manual.date, last_manual.id, "manual", last_manual))
    if not candidates:
        return None

    _, _, source, record = max(candidates, key=lambda x: (x[0], x[1]))
    if source == "daily":
        entry = record
        assert isinstance(entry, models.DailyEntry)
        return schemas.TaskLastActivityOut(
            date=entry.date,
            source="daily",
            content=entry.planned_description,
            planned_units=entry.planned_units,
            completed_units=entry.completed_units,
            unit_label=task.unit_label,
            status=entry.status,
        )
    item = record
    assert isinstance(item, models.DayManualItem)
    return schemas.TaskLastActivityOut(
        date=item.date,
        source="manual",
        content=item.description,
        planned_units=item.planned_units,
        completed_units=item.planned_units if item.status == "completed" else None,
        unit_label=task.unit_label,
        status=item.status,
    )


def get_task(db: Session, task_id: int, plan_id: int) -> models.Task | None:
    return (
        db.query(models.Task)
        .options(joinedload(models.Task.subject), joinedload(models.Task.attachments))
        .filter(models.Task.id == task_id, models.Task.plan_id == plan_id)
        .first()
    )


def create_task(db: Session, plan_id: int, data: schemas.TaskCreate) -> schemas.TaskOut:
    payload = data.model_dump(exclude={"attachments"})
    task = models.Task(plan_id=plan_id, **payload)
    db.add(task)
    db.flush()
    if data.attachments:
        _replace_task_attachments(db, task, data.attachments)
    elif payload.get("file_url"):
        _replace_task_attachments(
            db,
            task,
            [
                schemas.TaskAttachmentIn(
                    file_url=payload["file_url"],
                    file_name=payload.get("file_name") or "附件",
                )
            ],
        )
    _sync_task_legacy_fields(db, task)
    db.commit()
    db.refresh(task)
    task = get_task(db, task.id, plan_id)
    return task_to_out(db, task)


def update_task(
    db: Session, task_id: int, plan_id: int, data: schemas.TaskUpdate
) -> schemas.TaskOut | None:
    task = get_task(db, task_id, plan_id)
    if not task:
        return None
    attachments = data.attachments
    updates = data.model_dump(exclude={"attachments"}, exclude_unset=True)
    for key, value in updates.items():
        setattr(task, key, value)
    if attachments is not None:
        _replace_task_attachments(db, task, attachments)
        _sync_task_legacy_fields(db, task)
    db.commit()
    db.refresh(task)
    task = get_task(db, task_id, plan_id)
    return task_to_out(db, task)


def delete_task(
    db: Session, task_id: int, plan_id: int, deleted_by_user_id: int | None = None
) -> bool:
    task = get_task(db, task_id, plan_id)
    if not task:
        return False
    plan = db.get(models.Plan, plan_id)
    if not plan:
        return False
    record_deletion(
        db,
        entity_type=ENTITY_TASK,
        entity_id=task_id,
        plan_id=plan_id,
        user_id=plan.user_id,
        deleted_by_user_id=deleted_by_user_id or plan.user_id,
        snapshot=build_task_snapshot(db, task),
    )
    db.delete(task)
    db.commit()
    return True


def entry_to_out(db: Session, entry: models.DailyEntry) -> schemas.DailyEntryOut:
    task_out = task_to_out(db, entry.task) if entry.task else None
    return schemas.DailyEntryOut(
        id=entry.id,
        task_id=entry.task_id,
        date=entry.date,
        planned_description=entry.planned_description,
        planned_units=entry.planned_units,
        completed_units=entry.completed_units,
        score=entry.score,
        status=entry.status,
        notes=entry.notes,
        created_at=entry.created_at,
        task=task_out,
    )


def list_daily_entries(
    db: Session, plan_id: int, target_date: date | None = None
) -> list[schemas.DailyEntryOut]:
    query = (
        db.query(models.DailyEntry)
        .join(models.Task)
        .options(joinedload(models.DailyEntry.task).joinedload(models.Task.subject))
        .filter(models.Task.plan_id == plan_id)
    )
    if target_date:
        query = query.filter(models.DailyEntry.date == target_date)
    entries = query.order_by(models.DailyEntry.date.desc(), models.DailyEntry.id).all()
    return [entry_to_out(db, e) for e in entries]


def create_daily_entry(db: Session, plan_id: int, data: schemas.DailyEntryCreate) -> schemas.DailyEntryOut:
    task = get_task(db, data.task_id, plan_id)
    if not task:
        raise ValueError("任务不存在")
    existing = (
        db.query(models.DailyEntry)
        .filter(models.DailyEntry.task_id == data.task_id, models.DailyEntry.date == data.date)
        .first()
    )
    if existing:
        raise ValueError("该任务当天已有记录，请直接编辑")
    entry = models.DailyEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    entry = (
        db.query(models.DailyEntry)
        .options(joinedload(models.DailyEntry.task).joinedload(models.Task.subject))
        .filter(models.DailyEntry.id == entry.id)
        .first()
    )
    return entry_to_out(db, entry)


def update_daily_entry(
    db: Session, entry_id: int, plan_id: int, data: schemas.DailyEntryUpdate
) -> schemas.DailyEntryOut | None:
    entry = (
        db.query(models.DailyEntry)
        .join(models.Task)
        .options(joinedload(models.DailyEntry.task).joinedload(models.Task.subject))
        .filter(models.DailyEntry.id == entry_id, models.Task.plan_id == plan_id)
        .first()
    )
    if not entry:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    return entry_to_out(db, entry)


def delete_daily_entry(
    db: Session, entry_id: int, plan_id: int, deleted_by_user_id: int | None = None
) -> bool:
    entry = (
        db.query(models.DailyEntry)
        .join(models.Task)
        .filter(models.DailyEntry.id == entry_id, models.Task.plan_id == plan_id)
        .first()
    )
    if not entry:
        return False
    plan = db.get(models.Plan, plan_id)
    if not plan:
        return False
    record_deletion(
        db,
        entity_type=ENTITY_DAILY_ENTRY,
        entity_id=entry_id,
        plan_id=plan_id,
        user_id=plan.user_id,
        deleted_by_user_id=deleted_by_user_id or plan.user_id,
        snapshot={"entity": model_to_dict(entry)},
    )
    db.delete(entry)
    db.commit()
    return True


def complete_daily_entry(
    db: Session, entry_id: int, plan_id: int, completed_units: int, score: float | None = None
) -> schemas.DailyEntryOut | None:
    entry = (
        db.query(models.DailyEntry)
        .join(models.Task)
        .options(joinedload(models.DailyEntry.task).joinedload(models.Task.subject))
        .filter(models.DailyEntry.id == entry_id, models.Task.plan_id == plan_id)
        .first()
    )
    if not entry:
        return None
    entry.completed_units = completed_units
    if score is not None:
        entry.score = score
    if completed_units >= entry.planned_units:
        entry.status = "completed"
    elif completed_units > 0:
        entry.status = "partial"
    else:
        entry.status = "planned"
    db.commit()
    db.refresh(entry)
    return entry_to_out(db, entry)


def day_manual_item_to_out(db: Session, item: models.DayManualItem) -> schemas.DayManualItemOut:
    task_out = None
    if item.task:
        task_out = task_to_out(db, item.task)
    return schemas.DayManualItemOut(
        id=item.id,
        plan_id=item.plan_id,
        date=item.date,
        task_id=item.task_id,
        title=item.title,
        start_time=_format_time(item.start_time),
        end_time=_format_time(item.end_time),
        is_all_day=item.is_all_day,
        location_id=item.location_id,
        description=item.description,
        planned_units=item.planned_units,
        status=item.status,
        score=item.score,
        notes=item.notes,
        sort_order=item.sort_order,
        created_at=item.created_at,
        location=location_to_out(item.location) if item.location else None,
        task=task_out,
    )


def list_day_manual_items(
    db: Session, plan_id: int, target_date: date | None = None
) -> list[schemas.DayManualItemOut]:
    query = (
        db.query(models.DayManualItem)
        .options(
            joinedload(models.DayManualItem.location),
            joinedload(models.DayManualItem.task).joinedload(models.Task.subject),
        )
        .filter(models.DayManualItem.plan_id == plan_id)
    )
    if target_date:
        query = query.filter(models.DayManualItem.date == target_date)
    items = query.order_by(
        models.DayManualItem.date.desc(),
        models.DayManualItem.start_time.asc().nullslast(),
        models.DayManualItem.sort_order,
        models.DayManualItem.id,
    ).all()
    return [day_manual_item_to_out(db, i) for i in items]


def _get_task_in_plan(db: Session, task_id: int, plan_id: int) -> models.Task | None:
    return (
        db.query(models.Task)
        .filter(models.Task.id == task_id, models.Task.plan_id == plan_id, models.Task.is_active.is_(True))
        .first()
    )


def _get_day_manual_item(db: Session, item_id: int, plan_id: int) -> models.DayManualItem | None:
    return (
        db.query(models.DayManualItem)
        .options(
            joinedload(models.DayManualItem.location),
            joinedload(models.DayManualItem.task).joinedload(models.Task.subject),
        )
        .filter(models.DayManualItem.id == item_id, models.DayManualItem.plan_id == plan_id)
        .first()
    )


def create_day_manual_item(
    db: Session, plan_id: int, data: schemas.DayManualItemCreate
) -> schemas.DayManualItemOut:
    if not data.title.strip():
        raise ValueError("标题不能为空")
    if data.location_id:
        loc = (
            db.query(models.Location)
            .filter(models.Location.id == data.location_id, models.Location.plan_id == plan_id)
            .first()
        )
        if not loc:
            raise ValueError("地点不存在")
    if data.task_id:
        task = _get_task_in_plan(db, data.task_id, plan_id)
        if not task:
            raise ValueError("任务不存在")
        existing = (
            db.query(models.DayManualItem)
            .filter(
                models.DayManualItem.plan_id == plan_id,
                models.DayManualItem.date == data.date,
                models.DayManualItem.task_id == data.task_id,
            )
            .first()
        )
        if existing:
            raise ValueError("该任务当天已添加")
    item = models.DayManualItem(
        plan_id=plan_id,
        date=data.date,
        task_id=data.task_id,
        title=data.title.strip(),
        start_time=_parse_time(data.start_time),
        end_time=_parse_time(data.end_time),
        is_all_day=data.is_all_day,
        location_id=data.location_id,
        description=data.description,
        planned_units=data.planned_units if data.task_id else None,
        notes=data.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    item = _get_day_manual_item(db, item.id, plan_id)
    return day_manual_item_to_out(db, item)


def update_day_manual_item(
    db: Session, plan_id: int, item_id: int, data: schemas.DayManualItemUpdate
) -> schemas.DayManualItemOut | None:
    item = _get_day_manual_item(db, item_id, plan_id)
    if not item:
        return None
    updates = data.model_dump(exclude_unset=True)
    if "title" in updates and updates["title"] is not None:
        updates["title"] = updates["title"].strip()
        if not updates["title"]:
            raise ValueError("标题不能为空")
    if "start_time" in updates:
        updates["start_time"] = _parse_time(updates.pop("start_time"))
    if "end_time" in updates:
        updates["end_time"] = _parse_time(updates.pop("end_time"))
    if "location_id" in updates and updates["location_id"]:
        loc = (
            db.query(models.Location)
            .filter(models.Location.id == updates["location_id"], models.Location.plan_id == plan_id)
            .first()
        )
        if not loc:
            raise ValueError("地点不存在")
    if "task_id" in updates:
        new_task_id = updates.pop("task_id")
        if new_task_id != item.task_id:
            if new_task_id is not None:
                task = _get_task_in_plan(db, new_task_id, plan_id)
                if not task:
                    raise ValueError("任务不存在")
                existing = (
                    db.query(models.DayManualItem)
                    .filter(
                        models.DayManualItem.plan_id == plan_id,
                        models.DayManualItem.date == item.date,
                        models.DayManualItem.task_id == new_task_id,
                        models.DayManualItem.id != item_id,
                    )
                    .first()
                )
                if existing:
                    raise ValueError("该任务当天已添加")
                item.task_id = new_task_id
                item.title = task.title
            else:
                item.task_id = None
                item.planned_units = None
    for key, value in updates.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    item = _get_day_manual_item(db, item_id, plan_id)
    return day_manual_item_to_out(db, item)


def complete_day_manual_item(
    db: Session, plan_id: int, item_id: int, score: float | None = None
) -> schemas.DayManualItemOut | None:
    item = _get_day_manual_item(db, item_id, plan_id)
    if not item:
        return None
    item.status = "completed"
    if score is not None:
        item.score = score
    db.commit()
    db.refresh(item)
    item = _get_day_manual_item(db, item_id, plan_id)
    return day_manual_item_to_out(db, item)


def delete_day_manual_item(
    db: Session, plan_id: int, item_id: int, deleted_by_user_id: int | None = None
) -> bool:
    item = _get_day_manual_item(db, item_id, plan_id)
    if not item:
        return False
    plan = db.get(models.Plan, plan_id)
    if not plan:
        return False
    record_deletion(
        db,
        entity_type=ENTITY_DAY_MANUAL_ITEM,
        entity_id=item_id,
        plan_id=plan_id,
        user_id=plan.user_id,
        deleted_by_user_id=deleted_by_user_id or plan.user_id,
        snapshot={"entity": model_to_dict(item)},
    )
    db.delete(item)
    db.commit()
    return True


def get_dashboard(db: Session, plan_id: int, user_id: int) -> schemas.DashboardOut | None:
    plan = get_plan(db, plan_id, user_id)
    if not plan:
        return None

    today = date.today()
    days_remaining = (plan.deadline - today).days if plan.deadline else None
    today_entries = list_daily_entries(db, plan_id, today)
    today_schedule = list_schedule_for_date(db, plan_id, today)
    today_slot_plans = list_slot_daily_plans(db, plan_id, today)

    subjects = list_subjects(db, plan_id)
    subject_progress: list[schemas.SubjectProgress] = []
    total_all = 0
    completed_all = 0

    for subject in subjects:
        tasks = (
            db.query(models.Task)
            .filter(models.Task.subject_id == subject.id, models.Task.is_active.is_(True))
            .all()
        )
        subject_total = sum(t.total_units for t in tasks)
        subject_completed = sum(_task_progress(db, t)[0] for t in tasks)
        total_all += subject_total
        completed_all += subject_completed
        ratio = subject_completed / subject_total if subject_total > 0 else 0.0
        subject_progress.append(
            schemas.SubjectProgress(
                subject=schemas.SubjectOut.model_validate(subject),
                total_units=subject_total,
                completed_units=subject_completed,
                progress_ratio=round(ratio, 3),
                task_count=len(tasks),
            )
        )

    overall = completed_all / total_all if total_all > 0 else 0.0

    return schemas.DashboardOut(
        plan=plan_to_out(db, plan),
        deadline=plan.deadline,
        days_remaining=days_remaining,
        today=today,
        today_schedule=today_schedule,
        today_slot_plans=today_slot_plans,
        today_entries=today_entries,
        subject_progress=subject_progress,
        overall_progress=round(overall, 3),
    )


# --- 用户认证 / 运营 ---


def user_to_out(user: models.User) -> schemas.UserOut:
    return schemas.UserOut.model_validate(user)


def register_user(db: Session, data: schemas.RegisterIn) -> models.User:
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise ValueError("用户名已被占用")
    from .security import hash_password

    user = models.User(
        username=data.username,
        display_name=data.display_name,
        password_hash=hash_password(data.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> models.User | None:
    from .security import verify_password

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def update_profile(db: Session, user: models.User, data: schemas.ProfileUpdate) -> models.User:
    if data.display_name is not None:
        user.display_name = data.display_name
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: models.User, data: schemas.PasswordChange) -> None:
    from .security import hash_password, verify_password

    if not verify_password(data.old_password, user.password_hash):
        raise ValueError("原密码不正确")
    user.password_hash = hash_password(data.new_password)
    db.commit()


def admin_reset_user_password(db: Session, user_id: int, new_password: str) -> models.User | None:
    from .security import hash_password

    user = db.get(models.User, user_id)
    if not user:
        return None
    user.password_hash = hash_password(new_password)
    db.commit()
    db.refresh(user)
    return user


def admin_stats(db: Session) -> schemas.AdminStatsOut:
    return schemas.AdminStatsOut(
        user_count=db.query(models.User).count(),
        active_user_count=db.query(models.User).filter(models.User.is_active.is_(True)).count(),
        plan_count=db.query(models.Plan).count(),
        task_count=db.query(models.Task).count(),
    )


def admin_list_users(db: Session) -> list[schemas.AdminUserOut]:
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    result: list[schemas.AdminUserOut] = []
    for u in users:
        plan_count = db.query(models.Plan).filter_by(user_id=u.id).count()
        result.append(
            schemas.AdminUserOut(
                id=u.id,
                username=u.username,
                display_name=u.display_name,
                role=u.role,
                is_active=u.is_active,
                created_at=u.created_at,
                plan_count=plan_count,
            )
        )
    return result


def admin_update_user(
    db: Session, user_id: int, data: schemas.AdminUserUpdate
) -> schemas.AdminUserOut | None:
    user = db.get(models.User, user_id)
    if not user:
        return None
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    plan_count = db.query(models.Plan).filter_by(user_id=user.id).count()
    return schemas.AdminUserOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        plan_count=plan_count,
    )


def admin_list_plans(db: Session) -> list[schemas.AdminPlanOut]:
    plans = db.query(models.Plan).order_by(models.Plan.created_at.desc()).all()
    result: list[schemas.AdminPlanOut] = []
    for p in plans:
        user = db.get(models.User, p.user_id)
        out = plan_to_out(db, p)
        result.append(
            schemas.AdminPlanOut(
                id=p.id,
                user_id=p.user_id,
                username=user.username if user else "?",
                display_name=user.display_name if user else "?",
                name=p.name,
                is_active=p.is_active,
                created_at=p.created_at,
                slot_count=out.slot_count,
                task_count=out.task_count,
            )
        )
    return result


def admin_delete_plan(db: Session, plan_id: int, deleted_by_user_id: int | None = None) -> bool:
    plan = db.get(models.Plan, plan_id)
    if not plan:
        return False
    user_id = plan.user_id
    return delete_plan(db, plan_id, user_id, deleted_by_user_id=deleted_by_user_id or user_id)


def deleted_record_to_out(record: models.DeletedRecord) -> schemas.DeletedRecordOut:
    from .deleted_records import ENTITY_LABELS

    return schemas.DeletedRecordOut(
        id=record.id,
        entity_type=record.entity_type,
        entity_type_label=ENTITY_LABELS.get(record.entity_type, record.entity_type),
        entity_id=record.entity_id,
        plan_id=record.plan_id,
        user_id=record.user_id,
        username=record.user.username if record.user else "",
        display_name=record.user.display_name if record.user else "",
        display_title=record.display_title,
        deleted_at=record.deleted_at,
        deleted_by_user_id=record.deleted_by_user_id,
        deleted_by_username=record.deleted_by.username if record.deleted_by else None,
        expires_at=record.expires_at,
        restored_at=record.restored_at,
    )


def admin_list_deleted_records(
    db: Session, entity_type: str | None = None
) -> list[schemas.DeletedRecordOut]:
    rows = list_deleted_records(db, entity_type=entity_type)
    return [deleted_record_to_out(row) for row in rows]


def admin_restore_deleted_record(db: Session, record_id: int) -> schemas.DeletedRecordOut:
    record = restore_deleted_record(db, record_id)
    record = (
        db.query(models.DeletedRecord)
        .options(
            joinedload(models.DeletedRecord.user),
            joinedload(models.DeletedRecord.deleted_by),
        )
        .filter(models.DeletedRecord.id == record_id)
        .first()
    )
    return deleted_record_to_out(record)


def admin_purge_deleted_record(db: Session, record_id: int) -> bool:
    return permanent_delete_record(db, record_id)


def _count_by_plan(db: Session, model, plan_ids: list[int], *, extra_filter=None) -> dict[int, int]:
    if not plan_ids:
        return {}
    q = db.query(model.plan_id, func.count()).filter(model.plan_id.in_(plan_ids))
    if extra_filter is not None:
        q = q.filter(extra_filter)
    return {pid: cnt for pid, cnt in q.group_by(model.plan_id).all()}


def _count_by_plan_via_task(db: Session, plan_ids: list[int], *, extra_filter=None) -> dict[int, int]:
    if not plan_ids:
        return {}
    q = (
        db.query(models.Task.plan_id, func.count())
        .join(models.DailyEntry, models.DailyEntry.task_id == models.Task.id)
        .filter(models.Task.plan_id.in_(plan_ids))
    )
    if extra_filter is not None:
        q = q.filter(extra_filter)
    return {pid: cnt for pid, cnt in q.group_by(models.Task.plan_id).all()}


def _count_by_plan_via_slot(db: Session, plan_ids: list[int], *, extra_filter=None) -> dict[int, int]:
    if not plan_ids:
        return {}
    q = (
        db.query(models.ScheduleSlot.plan_id, func.count())
        .join(models.SlotDailyPlan, models.SlotDailyPlan.slot_id == models.ScheduleSlot.id)
        .filter(models.ScheduleSlot.plan_id.in_(plan_ids))
    )
    if extra_filter is not None:
        q = q.filter(extra_filter)
    return {pid: cnt for pid, cnt in q.group_by(models.ScheduleSlot.plan_id).all()}


def _attachment_stats_by_plan(db: Session, plan_ids: list[int]) -> dict[int, tuple[int, int]]:
    if not plan_ids:
        return {}
    result: dict[int, tuple[int, int]] = {pid: (0, 0) for pid in plan_ids}
    for pid, cnt, total in (
        db.query(
            models.PlanAttachment.plan_id,
            func.count(),
            func.coalesce(func.sum(models.PlanAttachment.file_size), 0),
        )
        .filter(models.PlanAttachment.plan_id.in_(plan_ids))
        .group_by(models.PlanAttachment.plan_id)
        .all()
    ):
        result[pid] = (result[pid][0] + int(cnt), result[pid][1] + int(total))
    for pid, cnt, total in (
        db.query(
            models.Task.plan_id,
            func.count(),
            func.coalesce(func.sum(models.TaskAttachment.file_size), 0),
        )
        .join(models.TaskAttachment, models.TaskAttachment.task_id == models.Task.id)
        .filter(models.Task.plan_id.in_(plan_ids))
        .group_by(models.Task.plan_id)
        .all()
    ):
        c, b = result.get(pid, (0, 0))
        result[pid] = (c + int(cnt), b + int(total))
    return result


def _last_activity_by_plan(db: Session, plan_ids: list[int]) -> dict[int, datetime]:
    if not plan_ids:
        return {}
    result: dict[int, datetime | None] = {pid: None for pid in plan_ids}

    def _merge(rows: list[tuple[int, datetime | None]]) -> None:
        for pid, ts in rows:
            if ts is None:
                continue
            prev = result.get(pid)
            if prev is None or ts > prev:
                result[pid] = ts

    _merge(
        db.query(models.Plan.id, models.Plan.created_at)
        .filter(models.Plan.id.in_(plan_ids))
        .all()
    )
    _merge(
        db.query(models.Task.plan_id, func.max(models.DailyEntry.created_at))
        .join(models.DailyEntry, models.DailyEntry.task_id == models.Task.id)
        .filter(models.Task.plan_id.in_(plan_ids))
        .group_by(models.Task.plan_id)
        .all()
    )
    _merge(
        db.query(models.ScheduleSlot.plan_id, func.max(models.SlotDailyPlan.created_at))
        .join(models.SlotDailyPlan, models.SlotDailyPlan.slot_id == models.ScheduleSlot.id)
        .filter(models.ScheduleSlot.plan_id.in_(plan_ids))
        .group_by(models.ScheduleSlot.plan_id)
        .all()
    )
    _merge(
        db.query(models.DayManualItem.plan_id, func.max(models.DayManualItem.created_at))
        .filter(models.DayManualItem.plan_id.in_(plan_ids))
        .group_by(models.DayManualItem.plan_id)
        .all()
    )
    return {pid: ts for pid, ts in result.items() if ts is not None}


def admin_user_usage_stats(db: Session, user_id: int) -> schemas.AdminUserUsageOut:
    user = db.get(models.User, user_id)
    if not user:
        return schemas.AdminUserUsageOut()

    plans = (
        db.query(models.Plan)
        .filter_by(user_id=user_id)
        .order_by(models.Plan.created_at.desc())
        .all()
    )
    plan_ids = [p.id for p in plans]
    registered_days = max(0, (datetime.now() - user.created_at).days)

    if not plan_ids:
        return schemas.AdminUserUsageOut(registered_days=registered_days)

    courses = _count_by_plan(db, models.Course, plan_ids)
    locations = _count_by_plan(db, models.Location, plan_ids)
    slots = _count_by_plan(db, models.ScheduleSlot, plan_ids)
    tasks = _count_by_plan(db, models.Task, plan_ids)
    active_tasks = _count_by_plan(db, models.Task, plan_ids, extra_filter=models.Task.is_active.is_(True))
    daily_entries = _count_by_plan_via_task(db, plan_ids)
    daily_completed = _count_by_plan_via_task(
        db, plan_ids, extra_filter=models.DailyEntry.status == "completed"
    )
    slot_plans = _count_by_plan_via_slot(db, plan_ids)
    slot_completed = _count_by_plan_via_slot(
        db, plan_ids, extra_filter=models.SlotDailyPlan.status == "completed"
    )
    manual_items = _count_by_plan(db, models.DayManualItem, plan_ids)
    manual_completed = _count_by_plan(
        db, models.DayManualItem, plan_ids, extra_filter=models.DayManualItem.status == "completed"
    )
    exceptions = _count_by_plan(db, models.ScheduleException, plan_ids)
    attachments = _attachment_stats_by_plan(db, plan_ids)
    last_activity_map = _last_activity_by_plan(db, plan_ids)

    deleted_count = (
        db.query(func.count())
        .select_from(models.DeletedRecord)
        .filter(
            models.DeletedRecord.user_id == user_id,
            models.DeletedRecord.restored_at.is_(None),
        )
        .scalar()
        or 0
    )

    plan_usages: list[schemas.AdminUserPlanUsageOut] = []
    totals = {
        "course": 0,
        "location": 0,
        "slot": 0,
        "task": 0,
        "active_task": 0,
        "daily": 0,
        "daily_done": 0,
        "slot_plan": 0,
        "slot_done": 0,
        "manual": 0,
        "manual_done": 0,
        "attach": 0,
        "attach_bytes": 0,
        "exception": 0,
    }

    for plan in plans:
        pid = plan.id
        attach_cnt, attach_bytes = attachments.get(pid, (0, 0))
        usage = schemas.AdminUserPlanUsageOut(
            plan_id=pid,
            plan_name=plan.name,
            is_active=plan.is_active,
            created_at=plan.created_at,
            course_count=courses.get(pid, 0),
            location_count=locations.get(pid, 0),
            schedule_slot_count=slots.get(pid, 0),
            task_count=tasks.get(pid, 0),
            active_task_count=active_tasks.get(pid, 0),
            daily_entry_count=daily_entries.get(pid, 0),
            daily_entry_completed=daily_completed.get(pid, 0),
            slot_daily_plan_count=slot_plans.get(pid, 0),
            slot_daily_plan_completed=slot_completed.get(pid, 0),
            day_manual_item_count=manual_items.get(pid, 0),
            day_manual_item_completed=manual_completed.get(pid, 0),
            attachment_count=attach_cnt,
            attachment_bytes=attach_bytes,
            schedule_exception_count=exceptions.get(pid, 0),
            last_activity_at=last_activity_map.get(pid),
        )
        plan_usages.append(usage)
        totals["course"] += usage.course_count
        totals["location"] += usage.location_count
        totals["slot"] += usage.schedule_slot_count
        totals["task"] += usage.task_count
        totals["active_task"] += usage.active_task_count
        totals["daily"] += usage.daily_entry_count
        totals["daily_done"] += usage.daily_entry_completed
        totals["slot_plan"] += usage.slot_daily_plan_count
        totals["slot_done"] += usage.slot_daily_plan_completed
        totals["manual"] += usage.day_manual_item_count
        totals["manual_done"] += usage.day_manual_item_completed
        totals["attach"] += usage.attachment_count
        totals["attach_bytes"] += usage.attachment_bytes
        totals["exception"] += usage.schedule_exception_count

    trackable = totals["daily"] + totals["slot_plan"] + totals["manual"]
    completed = totals["daily_done"] + totals["slot_done"] + totals["manual_done"]
    completion_rate = round(completed / trackable, 3) if trackable > 0 else 0.0

    last_activity = max(
        (u.last_activity_at for u in plan_usages if u.last_activity_at),
        default=None,
    )

    return schemas.AdminUserUsageOut(
        registered_days=registered_days,
        last_activity_at=last_activity,
        active_plan_count=sum(1 for p in plans if p.is_active),
        total_plan_count=len(plans),
        course_count=totals["course"],
        location_count=totals["location"],
        schedule_slot_count=totals["slot"],
        task_count=totals["task"],
        active_task_count=totals["active_task"],
        daily_entry_count=totals["daily"],
        daily_entry_completed=totals["daily_done"],
        slot_daily_plan_count=totals["slot_plan"],
        slot_daily_plan_completed=totals["slot_done"],
        day_manual_item_count=totals["manual"],
        day_manual_item_completed=totals["manual_done"],
        attachment_count=totals["attach"],
        attachment_bytes=totals["attach_bytes"],
        schedule_exception_count=totals["exception"],
        deleted_record_count=int(deleted_count),
        completion_rate=completion_rate,
        plan_usages=plan_usages,
    )


def admin_get_user(db: Session, user_id: int) -> schemas.AdminUserDetailOut | None:
    user = db.get(models.User, user_id)
    if not user:
        return None
    plans = list_plans(db, user_id)
    plan_count = len(plans)
    return schemas.AdminUserDetailOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        plan_count=plan_count,
        plans=plans,
        usage=admin_user_usage_stats(db, user_id),
    )


def admin_get_plan_detail(db: Session, plan_id: int) -> schemas.AdminPlanDetailOut | None:
    plan = db.get(models.Plan, plan_id)
    if not plan:
        return None
    owner = db.get(models.User, plan.user_id)
    if not owner:
        return None
    dashboard = get_dashboard(db, plan_id, plan.user_id)
    if not dashboard:
        return None
    return schemas.AdminPlanDetailOut(
        user=schemas.AdminPlanUserBrief(
            id=owner.id,
            username=owner.username,
            display_name=owner.display_name,
        ),
        plan=plan_to_out(db, plan),
        locations=list_locations(db, plan_id),
        courses=list_courses(db, plan_id, active_only=False),
        tasks=list_tasks(db, plan_id, active_only=False),
        schedule=list_schedule_slots(db, plan_id),
        dashboard=dashboard,
    )
