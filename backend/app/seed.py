from sqlalchemy.orm import Session

from . import crud, models, schemas
from .config import ADMIN_PASSWORD, ADMIN_USERNAME
from .security import hash_password


def seed_database(db: Session) -> None:
    admin = db.query(models.User).filter(models.User.username == ADMIN_USERNAME).first()
    if not admin:
        admin = models.User(
            username=ADMIN_USERNAME,
            display_name="系统管理员",
            password_hash=hash_password(ADMIN_PASSWORD),
            role="admin",
        )
        db.add(admin)
        db.commit()
    elif not admin.password_hash:
        admin.password_hash = hash_password(ADMIN_PASSWORD)
        admin.role = "admin"
        db.commit()

    dev = db.get(models.User, 1)
    if not dev:
        dev = models.User(
            id=1,
            username="dev",
            display_name="开发用户",
            password_hash=hash_password("dev123456"),
            role="user",
        )
        db.add(dev)
        db.commit()
    elif not dev.password_hash:
        dev.password_hash = hash_password("dev123456")
        db.commit()

    if db.query(models.Plan).count() > 0:
        return

    from datetime import date, timedelta

    from . import schemas as s

    WEEKLY_TEMPLATE_SLOTS = [
        {"weekday": 0, "start": "08:30", "end": "10:00", "activity": "自安排", "location": "地点C", "order": 1},
        {"weekday": 0, "start": "10:10", "end": "12:10", "activity": "绘画", "location": "地点B", "order": 2},
        {"weekday": 0, "start": "13:30", "end": "15:00", "activity": "自安排", "location": "地点C", "order": 3},
        {"weekday": 0, "start": "15:10", "end": "17:10", "activity": "英语", "location": "地点A", "order": 4},
        {"weekday": 1, "start": "08:30", "end": "10:00", "activity": "数学", "location": "地点A", "order": 1},
        {"weekday": 1, "start": "10:10", "end": "12:10", "activity": "自安排", "location": "地点C", "order": 2},
        {"weekday": 1, "start": "13:30", "end": "15:00", "activity": "自安排", "location": "地点C", "order": 3},
        {"weekday": 1, "start": "15:10", "end": "17:10", "activity": "语文", "location": "地点A", "order": 4},
    ]

    slots = [
        s.ScheduleSlotTemplate(
            weekday=item["weekday"],
            start_time=item.get("start"),
            end_time=item.get("end"),
            activity=item["activity"],
            location_name=item.get("location"),
            is_all_day=item.get("all_day", False),
            sort_order=item["order"],
        )
        for item in WEEKLY_TEMPLATE_SLOTS
    ]
    template = s.PlanFromTemplate(
        name="暑假周课表",
        description="周一至周六分时段安排",
        deadline=date.today() + timedelta(days=60),
        locations=["地点A", "地点B", "地点C"],
        slots=slots,
    )

    owner = dev or admin
    crud.create_plan_from_template(db, owner.id, template)

    homework_plan = crud.create_plan(
        db,
        owner.id,
        s.PlanCreate(
            name="寒假作业计划",
            description="各科作业进度追踪",
            deadline=date.today() + timedelta(days=30),
        ),
    )

    subjects = [
        models.Subject(plan_id=homework_plan.id, name="数学", color="#3b82f6", sort_order=1),
        models.Subject(plan_id=homework_plan.id, name="语文", color="#ec4899", sort_order=2),
    ]
    db.add_all(subjects)
    db.commit()
