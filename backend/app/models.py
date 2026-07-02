from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    display_name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="user")
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    plans: Mapped[list["Plan"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    user: Mapped["User"] = relationship(back_populates="plans")
    locations: Mapped[list["Location"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    schedule_slots: Mapped[list["ScheduleSlot"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    subjects: Mapped[list["Subject"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    courses: Mapped[list["Course"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    schedule_exceptions: Mapped[list["ScheduleException"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    day_manual_items: Mapped[list["DayManualItem"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    task_guide_attachments: Mapped[list["PlanAttachment"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="PlanAttachment.sort_order"
    )


class PlanAttachment(Base):
    __tablename__ = "plan_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"))
    file_url: Mapped[str] = mapped_column(String(500))
    file_name: Mapped[str] = mapped_column(String(255))
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    plan: Mapped["Plan"] = relationship(back_populates="task_guide_attachments")


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (UniqueConstraint("plan_id", "name", name="uq_course_plan_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"))
    name: Mapped[str] = mapped_column(String(100))
    teacher: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")
    default_location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    plan: Mapped["Plan"] = relationship(back_populates="courses")
    default_location: Mapped["Location | None"] = relationship(foreign_keys=[default_location_id])
    schedule_slots: Mapped[list["ScheduleSlot"]] = relationship(back_populates="course")


class Location(Base):
    __tablename__ = "locations"
    __table_args__ = (UniqueConstraint("plan_id", "name", name="uq_location_plan_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"))
    name: Mapped[str] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)

    plan: Mapped["Plan"] = relationship(back_populates="locations")
    schedule_slots: Mapped[list["ScheduleSlot"]] = relationship(back_populates="location")


class ScheduleSlot(Base):
    __tablename__ = "schedule_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"))
    weekday: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    activity: Mapped[str] = mapped_column(String(100))
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    is_all_day: Mapped[bool] = mapped_column(default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    slot_type: Mapped[str] = mapped_column(String(20), default="class")
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"), nullable=True)
    default_task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)

    plan: Mapped["Plan"] = relationship(back_populates="schedule_slots")
    location: Mapped["Location | None"] = relationship(back_populates="schedule_slots")
    course: Mapped["Course | None"] = relationship(back_populates="schedule_slots")
    default_task: Mapped["Task | None"] = relationship(foreign_keys=[default_task_id])
    daily_plans: Mapped[list["SlotDailyPlan"]] = relationship(
        back_populates="slot", cascade="all, delete-orphan"
    )
    exceptions: Mapped[list["ScheduleException"]] = relationship(
        back_populates="slot", cascade="all, delete-orphan"
    )


class SlotDailyPlan(Base):
    __tablename__ = "slot_daily_plans"
    __table_args__ = (UniqueConstraint("slot_id", "date", name="uq_slot_daily_plan"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slot_id: Mapped[int] = mapped_column(ForeignKey("schedule_slots.id"))
    date: Mapped[date] = mapped_column(Date, index=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    description: Mapped[str] = mapped_column(Text)
    planned_units: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="planned")
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    slot: Mapped["ScheduleSlot"] = relationship(back_populates="daily_plans")
    task: Mapped["Task | None"] = relationship()


class ScheduleException(Base):
    __tablename__ = "schedule_exceptions"
    __table_args__ = (UniqueConstraint("slot_id", "date", name="uq_exception_slot_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"))
    slot_id: Mapped[int] = mapped_column(ForeignKey("schedule_slots.id"))
    date: Mapped[date] = mapped_column(Date, index=True)
    exception_type: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(String(200))
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    plan: Mapped["Plan"] = relationship(back_populates="schedule_exceptions")
    slot: Mapped["ScheduleSlot"] = relationship(back_populates="exceptions")
    location: Mapped["Location | None"] = relationship()


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("plan_id", "name", name="uq_subject_plan_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"))
    name: Mapped[str] = mapped_column(String(50))
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    plan: Mapped["Plan"] = relationship(back_populates="subjects")
    tasks: Mapped[list["Task"]] = relationship(back_populates="subject", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_units: Mapped[int] = mapped_column(Integer, default=1)
    unit_label: Mapped[str] = mapped_column(String(20), default="节")
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    plan: Mapped["Plan"] = relationship(back_populates="tasks")
    subject: Mapped["Subject"] = relationship(back_populates="tasks")
    daily_entries: Mapped[list["DailyEntry"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )
    attachments: Mapped[list["TaskAttachment"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="TaskAttachment.sort_order"
    )
    day_manual_items: Mapped[list["DayManualItem"]] = relationship(back_populates="task")


class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    file_url: Mapped[str] = mapped_column(String(500))
    file_name: Mapped[str] = mapped_column(String(255))
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    task: Mapped["Task"] = relationship(back_populates="attachments")


class DayManualItem(Base):
    __tablename__ = "day_manual_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"))
    date: Mapped[date] = mapped_column(Date, index=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    is_all_day: Mapped[bool] = mapped_column(default=False)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    planned_units: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="planned")
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    plan: Mapped["Plan"] = relationship(back_populates="day_manual_items")
    location: Mapped["Location | None"] = relationship()
    task: Mapped["Task | None"] = relationship(back_populates="day_manual_items")


class DailyEntry(Base):
    __tablename__ = "daily_entries"
    __table_args__ = (UniqueConstraint("task_id", "date", name="uq_daily_entry_task_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"))
    date: Mapped[date] = mapped_column(Date, index=True)
    planned_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    planned_units: Mapped[int] = mapped_column(Integer, default=1)
    completed_units: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="planned")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    task: Mapped["Task"] = relationship(back_populates="daily_entries")


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(String(500))


class DeletedRecord(Base):
    __tablename__ = "deleted_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    plan_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    snapshot_json: Mapped[str] = mapped_column(Text)
    display_title: Mapped[str] = mapped_column(String(300))
    deleted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, index=True)
    deleted_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    restored_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    deleted_by: Mapped["User | None"] = relationship(foreign_keys=[deleted_by_user_id])
