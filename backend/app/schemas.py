from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    role: str = "user"
    is_active: bool = True

    model_config = {"from_attributes": True}


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    display_name: str = Field(min_length=1, max_length=100)


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6, max_length=100)


class AdminUserOut(UserOut):
    created_at: datetime
    plan_count: int = 0


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    role: Literal["user", "admin"] | None = None
    display_name: str | None = Field(default=None, min_length=1, max_length=100)


class AdminPasswordReset(BaseModel):
    new_password: str = Field(min_length=6, max_length=100)


class AdminStatsOut(BaseModel):
    user_count: int
    active_user_count: int
    plan_count: int
    task_count: int


class AdminPlanOut(BaseModel):
    id: int
    user_id: int
    username: str
    display_name: str
    name: str
    is_active: bool
    created_at: datetime
    slot_count: int = 0
    task_count: int = 0


class AdminPlanUserBrief(BaseModel):
    id: int
    username: str
    display_name: str


class AdminUserDetailOut(AdminUserOut):
    plans: list["PlanOut"] = []
    usage: "AdminUserUsageOut" = Field(default_factory=lambda: AdminUserUsageOut())


class AdminUserPlanUsageOut(BaseModel):
    plan_id: int
    plan_name: str
    is_active: bool
    created_at: datetime
    course_count: int = 0
    location_count: int = 0
    schedule_slot_count: int = 0
    task_count: int = 0
    active_task_count: int = 0
    daily_entry_count: int = 0
    daily_entry_completed: int = 0
    slot_daily_plan_count: int = 0
    slot_daily_plan_completed: int = 0
    day_manual_item_count: int = 0
    day_manual_item_completed: int = 0
    attachment_count: int = 0
    attachment_bytes: int = 0
    schedule_exception_count: int = 0
    last_activity_at: datetime | None = None


class AdminUserUsageOut(BaseModel):
    registered_days: int = 0
    last_activity_at: datetime | None = None
    active_plan_count: int = 0
    total_plan_count: int = 0
    course_count: int = 0
    location_count: int = 0
    schedule_slot_count: int = 0
    task_count: int = 0
    active_task_count: int = 0
    daily_entry_count: int = 0
    daily_entry_completed: int = 0
    slot_daily_plan_count: int = 0
    slot_daily_plan_completed: int = 0
    day_manual_item_count: int = 0
    day_manual_item_completed: int = 0
    attachment_count: int = 0
    attachment_bytes: int = 0
    schedule_exception_count: int = 0
    deleted_record_count: int = 0
    completion_rate: float = 0.0
    plan_usages: list[AdminUserPlanUsageOut] = []


class AdminPlanDetailOut(BaseModel):
    user: AdminPlanUserBrief
    plan: "PlanOut"
    locations: list["LocationOut"]
    courses: list["CourseOut"]
    tasks: list["TaskOut"]
    schedule: list["ScheduleSlotOut"]
    dashboard: "DashboardOut"


class PlanOut(BaseModel):
    id: int
    user_id: int
    name: str
    description: str | None
    deadline: date | None
    is_active: bool
    created_at: datetime
    slot_count: int = 0
    task_count: int = 0

    model_config = {"from_attributes": True}


class PlanCreate(BaseModel):
    name: str
    description: str | None = None
    deadline: date | None = None


class PlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    deadline: date | None = None
    is_active: bool | None = None


class PlanFromTemplate(BaseModel):
    name: str
    description: str | None = None
    deadline: date | None = None
    locations: list[str] = Field(default_factory=lambda: ["地点A", "地点B", "地点C"])
    slots: list["ScheduleSlotTemplate"]


class ScheduleSlotTemplate(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: str | None = None
    end_time: str | None = None
    activity: str
    location_name: str | None = None
    is_all_day: bool = False
    sort_order: int = 0
    slot_type: Literal["class", "self_study"] | None = None


class LocationOut(BaseModel):
    id: int
    plan_id: int
    name: str
    address: str | None

    model_config = {"from_attributes": True}


class LocationCreate(BaseModel):
    name: str
    address: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = None
    address: str | None = None


class CourseOut(BaseModel):
    id: int
    plan_id: int
    name: str
    teacher: str | None
    phone: str | None
    description: str | None
    color: str
    default_location_id: int | None
    notes: str | None
    sort_order: int
    is_active: bool
    slot_count: int = 0
    default_location: LocationOut | None = None

    model_config = {"from_attributes": True}


class CourseCreate(BaseModel):
    name: str
    teacher: str | None = None
    phone: str | None = None
    description: str | None = None
    color: str = "#6366f1"
    default_location_id: int | None = None
    notes: str | None = None
    sort_order: int = 0


class CourseUpdate(BaseModel):
    name: str | None = None
    teacher: str | None = None
    phone: str | None = None
    description: str | None = None
    color: str | None = None
    default_location_id: int | None = None
    notes: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class ScheduleSlotOut(BaseModel):
    id: int
    plan_id: int
    weekday: int
    start_time: str | None
    end_time: str | None
    activity: str
    location_id: int | None
    is_all_day: bool
    sort_order: int
    notes: str | None
    slot_type: Literal["class", "self_study"]
    course_id: int | None = None
    default_task_id: int | None = None
    location: LocationOut | None = None
    course: CourseOut | None = None
    default_task: "TaskOut | None" = None
    daily_plan: "SlotDailyPlanOut | None" = None
    day_status: Literal["normal", "cancelled", "rescheduled"] = "normal"
    exception: "ScheduleExceptionOut | None" = None
    effective_start_time: str | None = None
    effective_end_time: str | None = None
    effective_location: LocationOut | None = None

    model_config = {"from_attributes": True}


class ScheduleSlotCreate(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: str | None = None
    end_time: str | None = None
    activity: str
    location_id: int | None = None
    is_all_day: bool = False
    sort_order: int = 0
    notes: str | None = None
    slot_type: Literal["class", "self_study"] | None = None
    course_id: int | None = None
    default_task_id: int | None = None


class ScheduleSlotUpdate(BaseModel):
    weekday: int | None = Field(default=None, ge=0, le=6)
    start_time: str | None = None
    end_time: str | None = None
    activity: str | None = None
    location_id: int | None = None
    is_all_day: bool | None = None
    sort_order: int | None = None
    notes: str | None = None
    slot_type: Literal["class", "self_study"] | None = None
    course_id: int | None = None
    default_task_id: int | None = None


class SlotDailyPlanOut(BaseModel):
    id: int
    slot_id: int
    date: date
    task_id: int | None
    description: str
    planned_units: int
    status: Literal["planned", "completed", "skipped"]
    score: float | None
    notes: str | None
    created_at: datetime
    slot: ScheduleSlotOut | None = None
    task: "TaskOut | None" = None

    model_config = {"from_attributes": True}


class SlotDailyPlanCreate(BaseModel):
    slot_id: int
    date: date
    task_id: int
    planned_units: int = Field(default=1, ge=1)
    description: str | None = None
    planned_units: int | None = Field(default=None, ge=1)
    notes: str | None = None


class SlotDailyPlanUpdate(BaseModel):
    task_id: int | None = None
    planned_units: int | None = Field(default=None, ge=1)
    description: str | None = None
    status: Literal["planned", "completed", "skipped"] | None = None
    score: float | None = Field(default=None, ge=0, le=10)
    notes: str | None = None


class DayManualItemOut(BaseModel):
    id: int
    plan_id: int
    date: date
    task_id: int | None
    title: str
    start_time: str | None
    end_time: str | None
    is_all_day: bool
    location_id: int | None
    description: str | None
    planned_units: int | None = None
    status: Literal["planned", "completed", "skipped"]
    score: float | None
    notes: str | None
    sort_order: int
    created_at: datetime
    location: "LocationOut | None" = None
    task: "TaskOut | None" = None

    model_config = {"from_attributes": True}


class DayManualItemCreate(BaseModel):
    date: date
    task_id: int | None = None
    title: str = Field(min_length=1, max_length=200)
    start_time: str | None = None
    end_time: str | None = None
    is_all_day: bool = False
    location_id: int | None = None
    description: str | None = None
    planned_units: int | None = Field(default=None, ge=1)
    notes: str | None = None


class DayManualItemUpdate(BaseModel):
    task_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    start_time: str | None = None
    end_time: str | None = None
    is_all_day: bool | None = None
    location_id: int | None = None
    description: str | None = None
    planned_units: int | None = Field(default=None, ge=1)
    status: Literal["planned", "completed", "skipped"] | None = None
    score: float | None = Field(default=None, ge=0, le=10)
    notes: str | None = None


class ScheduleExceptionOut(BaseModel):
    id: int
    plan_id: int
    slot_id: int
    date: date
    exception_type: Literal["cancelled", "rescheduled"]
    reason: str
    start_time: str | None
    end_time: str | None
    location_id: int | None
    notes: str | None
    created_at: datetime
    location: LocationOut | None = None

    model_config = {"from_attributes": True}


class ScheduleExceptionCreate(BaseModel):
    slot_id: int
    date: date
    exception_type: Literal["cancelled", "rescheduled"]
    reason: str
    start_time: str | None = None
    end_time: str | None = None
    location_id: int | None = None
    notes: str | None = None


class ScheduleExceptionUpdate(BaseModel):
    exception_type: Literal["cancelled", "rescheduled"] | None = None
    reason: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    location_id: int | None = None
    notes: str | None = None


class SubjectOut(BaseModel):
    id: int
    plan_id: int
    name: str
    color: str
    sort_order: int

    model_config = {"from_attributes": True}


class SubjectCreate(BaseModel):
    name: str
    color: str = "#6366f1"
    sort_order: int = 0


class SubjectUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    sort_order: int | None = None


class ReorderIn(BaseModel):
    ids: list[int] = Field(min_length=1)


class TaskAttachmentOut(BaseModel):
    id: int
    file_url: str
    file_name: str
    file_size: int | None = None
    content_type: str | None = None
    sort_order: int = 0

    model_config = {"from_attributes": True}


class TaskAttachmentIn(BaseModel):
    file_url: str
    file_name: str
    file_size: int | None = None
    content_type: str | None = None
    sort_order: int = 0


class PlanTaskGuideUpdate(BaseModel):
    attachments: list[TaskAttachmentIn] = Field(default_factory=list)


class TaskOut(BaseModel):
    id: int
    plan_id: int
    subject_id: int
    title: str
    description: str | None
    total_units: int
    unit_label: str
    file_url: str | None
    file_name: str | None = None
    attachments: list[TaskAttachmentOut] = []
    sort_order: int
    is_active: bool
    completed_units: int = 0
    progress_ratio: float = 0.0
    subject: SubjectOut | None = None

    model_config = {"from_attributes": True}


class TaskLastActivityOut(BaseModel):
    date: date
    source: Literal["daily", "manual"]
    content: str | None = None
    planned_units: int | None = None
    completed_units: int | None = None
    unit_label: str | None = None
    status: str | None = None


class TaskCreate(BaseModel):
    subject_id: int
    title: str
    description: str | None = None
    total_units: int = Field(ge=1)
    unit_label: str = "节"
    file_url: str | None = None
    file_name: str | None = None
    attachments: list[TaskAttachmentIn] = []
    sort_order: int = 0


class TaskUpdate(BaseModel):
    subject_id: int | None = None
    title: str | None = None
    description: str | None = None
    total_units: int | None = Field(default=None, ge=1)
    unit_label: str | None = None
    file_url: str | None = None
    file_name: str | None = None
    attachments: list[TaskAttachmentIn] | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class FileUploadOut(BaseModel):
    file_url: str
    file_name: str
    size: int
    content_type: str


class UploadSettingsOut(BaseModel):
    max_mb: int


class AdminSettingsOut(BaseModel):
    upload_max_mb: int
    delete_retention_days: int


class AdminSettingsUpdate(BaseModel):
    upload_max_mb: int | None = Field(default=None, ge=1, le=500)
    delete_retention_days: int | None = Field(default=None, ge=1, le=365)


class DeletedRecordOut(BaseModel):
    id: int
    entity_type: str
    entity_type_label: str
    entity_id: int
    plan_id: int | None
    user_id: int
    username: str
    display_name: str
    display_title: str
    deleted_at: datetime
    deleted_by_user_id: int | None
    deleted_by_username: str | None
    expires_at: datetime
    restored_at: datetime | None = None


class DailyEntryOut(BaseModel):
    id: int
    task_id: int
    date: date
    planned_description: str | None
    planned_units: int
    completed_units: int
    score: float | None
    status: Literal["planned", "completed", "partial", "skipped"]
    notes: str | None
    created_at: datetime
    task: TaskOut | None = None

    model_config = {"from_attributes": True}


class DailyEntryCreate(BaseModel):
    task_id: int
    date: date
    planned_description: str | None = None
    planned_units: int = Field(default=1, ge=1)
    completed_units: int = Field(default=0, ge=0)
    score: float | None = Field(default=None, ge=0, le=10)
    status: Literal["planned", "completed", "partial", "skipped"] = "planned"
    notes: str | None = None


class DailyEntryUpdate(BaseModel):
    planned_description: str | None = None
    planned_units: int | None = Field(default=None, ge=1)
    completed_units: int | None = Field(default=None, ge=0)
    score: float | None = Field(default=None, ge=0, le=10)
    status: Literal["planned", "completed", "partial", "skipped"] | None = None
    notes: str | None = None


class SubjectProgress(BaseModel):
    subject: SubjectOut
    total_units: int
    completed_units: int
    progress_ratio: float
    task_count: int


class DashboardOut(BaseModel):
    plan: PlanOut
    deadline: date | None
    days_remaining: int | None
    today: date
    today_schedule: list[ScheduleSlotOut]
    today_slot_plans: list[SlotDailyPlanOut]
    today_entries: list[DailyEntryOut]
    subject_progress: list[SubjectProgress]
    overall_progress: float


class DevInfoOut(BaseModel):
    dev_mode: bool
    user: UserOut | None = None
    auth_enabled: bool = False
