import os
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from . import crud, models, schemas, seed
from .auth import get_current_admin, get_current_user
from .config import DEV_MODE, DEV_USER_ID
from .database import SessionLocal, get_db
from .files import content_type_for, resolve_plan_file, save_plan_upload
from .deleted_records import purge_expired
from .settings_store import get_admin_settings, get_upload_max_bytes, get_upload_max_mb, update_admin_settings
from .migrate import run_migrations
from .security import create_access_token


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "*").strip()
    if raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(_: FastAPI):
    run_migrations()
    db = SessionLocal()
    try:
        seed.seed_database(db)
        purge_expired(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="作业计划表",
    description="REST API，支持 Web / iOS / Android 客户端",
    lifespan=lifespan,
)


@app.exception_handler(ValueError)
async def handle_value_error(_request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "name": "作业计划表 API",
        "status": "running",
        "docs": "/docs",
        "api": "/api/plans",
        "health": "/api/health",
        "frontend_dev": "http://localhost:5173",
        "admin_dev": "http://localhost:5173/admin",
    }


@app.get("/api/health")
def health():
    """启动自检：确认当前进程为本项目最新 API。"""
    return {
        "status": "ok",
        "api_version": "0.3",
        "features": [
            "day-items",
            "slot-plans",
            "schedule-exceptions",
            "deleted-records",
            "plan-task-guide",
            "list-reorder",
        ],
    }


@app.post("/api/auth/register", response_model=schemas.TokenOut)
def register(data: schemas.RegisterIn, db: Session = Depends(get_db)):
    user = crud.register_user(db, data)
    token = create_access_token(user.id, user.role)
    return schemas.TokenOut(access_token=token, user=crud.user_to_out(user))


@app.post("/api/auth/login", response_model=schemas.TokenOut)
def login(data: schemas.LoginIn, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, data.username, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_access_token(user.id, user.role)
    return schemas.TokenOut(access_token=token, user=crud.user_to_out(user))


@app.get("/api/auth/me", response_model=schemas.UserOut)
def auth_me(user: models.User = Depends(get_current_user)):
    return crud.user_to_out(user)


@app.put("/api/auth/me", response_model=schemas.UserOut)
def update_me(
    data: schemas.ProfileUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return crud.user_to_out(crud.update_profile(db, user, data))


@app.post("/api/auth/change-password")
def change_password(
    data: schemas.PasswordChange,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    try:
        crud.change_password(db, user, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"ok": True}


@app.get("/api/admin/stats", response_model=schemas.AdminStatsOut)
def admin_stats(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    return crud.admin_stats(db)


@app.get("/api/admin/users", response_model=list[schemas.AdminUserOut])
def admin_list_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    return crud.admin_list_users(db)


@app.patch("/api/admin/users/{user_id}", response_model=schemas.AdminUserOut)
def admin_update_user(
    user_id: int,
    data: schemas.AdminUserUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    result = crud.admin_update_user(db, user_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return result


@app.post("/api/admin/users/{user_id}/reset-password")
def admin_reset_user_password(
    user_id: int,
    data: schemas.AdminPasswordReset,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    user = crud.admin_reset_user_password(db, user_id, data.new_password)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"ok": True}


@app.get("/api/admin/users/{user_id}", response_model=schemas.AdminUserDetailOut)
def admin_get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    result = crud.admin_get_user(db, user_id)
    if not result:
        raise HTTPException(status_code=404, detail="用户不存在")
    return result


@app.get("/api/admin/plans/{plan_id}", response_model=schemas.AdminPlanDetailOut)
def admin_get_plan_detail(
    plan_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    result = crud.admin_get_plan_detail(db, plan_id)
    if not result:
        raise HTTPException(status_code=404, detail="计划不存在")
    return result


@app.get("/api/admin/plans", response_model=list[schemas.AdminPlanOut])
def admin_list_plans(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    return crud.admin_list_plans(db)


@app.delete("/api/admin/plans/{plan_id}")
def admin_delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin),
):
    if not crud.admin_delete_plan(db, plan_id, deleted_by_user_id=admin.id):
        raise HTTPException(status_code=404, detail="计划不存在")
    return {"ok": True}


@app.get("/api/admin/deleted", response_model=list[schemas.DeletedRecordOut])
def admin_list_deleted(
    entity_type: str | None = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    return crud.admin_list_deleted_records(db, entity_type=entity_type)


@app.post("/api/admin/deleted/{record_id}/restore", response_model=schemas.DeletedRecordOut)
def admin_restore_deleted(
    record_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    try:
        return crud.admin_restore_deleted_record(db, record_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/admin/deleted/{record_id}")
def admin_purge_deleted(
    record_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    if not crud.admin_purge_deleted_record(db, record_id):
        raise HTTPException(status_code=404, detail="删除记录不存在")
    return {"ok": True}


@app.get("/api/settings/upload", response_model=schemas.UploadSettingsOut)
def get_upload_settings(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    return schemas.UploadSettingsOut(max_mb=get_upload_max_mb(db))


@app.get("/api/admin/settings", response_model=schemas.AdminSettingsOut)
def admin_get_settings(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    settings = get_admin_settings(db)
    return schemas.AdminSettingsOut(**settings)


@app.patch("/api/admin/settings", response_model=schemas.AdminSettingsOut)
def admin_update_settings(
    data: schemas.AdminSettingsUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    settings = update_admin_settings(
        db,
        upload_max_mb=data.upload_max_mb,
        delete_retention_days=data.delete_retention_days,
    )
    return schemas.AdminSettingsOut(**settings)


def require_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> models.Plan:
    plan = crud.get_plan(db, plan_id, user.id)
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    return plan


@app.get("/api/dev-info", response_model=schemas.DevInfoOut)
def dev_info(db: Session = Depends(get_db)):
    if not DEV_MODE:
        return schemas.DevInfoOut(dev_mode=False, auth_enabled=True)
    user = db.get(models.User, DEV_USER_ID)
    if not user:
        raise HTTPException(status_code=500, detail="开发用户未初始化，请重启服务")
    return schemas.DevInfoOut(
        dev_mode=True,
        user=crud.user_to_out(user),
        auth_enabled=False,
    )


@app.get("/api/plans", response_model=list[schemas.PlanOut])
def list_plans(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crud.list_plans(db, user.id)


@app.post("/api/plans", response_model=schemas.PlanOut)
def create_plan(data: schemas.PlanCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crud.create_plan(db, user.id, data)


@app.post("/api/plans/from-template", response_model=schemas.PlanOut)
def create_plan_from_template(
    data: schemas.PlanFromTemplate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return crud.create_plan_from_template(db, user.id, data)


@app.get("/api/plans/{plan_id}", response_model=schemas.PlanOut)
def get_plan(plan: models.Plan = Depends(require_plan), db: Session = Depends(get_db)):
    return crud.plan_to_out(db, plan)


@app.put("/api/plans/{plan_id}", response_model=schemas.PlanOut)
def update_plan(
    data: schemas.PlanUpdate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    result = crud.update_plan(db, plan.id, user.id, data)
    if not result:
        raise HTTPException(status_code=404, detail="计划不存在")
    return result


@app.delete("/api/plans/{plan_id}")
def delete_plan(
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_plan(db, plan.id, user.id, deleted_by_user_id=user.id):
        raise HTTPException(status_code=404, detail="计划不存在")
    return {"ok": True}


@app.post("/api/plans/{plan_id}/duplicate", response_model=schemas.PlanOut)
def duplicate_plan(
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
    new_name: str | None = None,
):
    result = crud.duplicate_plan(db, plan.id, user.id, new_name)
    if not result:
        raise HTTPException(status_code=404, detail="计划不存在")
    return result


@app.get("/api/plans/{plan_id}/dashboard", response_model=schemas.DashboardOut)
def dashboard(
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    result = crud.get_dashboard(db, plan.id, user.id)
    if not result:
        raise HTTPException(status_code=404, detail="计划不存在")
    return result


@app.get("/api/plans/{plan_id}/locations", response_model=list[schemas.LocationOut])
def list_locations(plan: models.Plan = Depends(require_plan), db: Session = Depends(get_db)):
    return crud.list_locations(db, plan.id)


@app.post("/api/plans/{plan_id}/locations", response_model=schemas.LocationOut)
def create_location(
    data: schemas.LocationCreate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    return crud.create_location(db, plan.id, data)


@app.put("/api/plans/{plan_id}/locations/{location_id}", response_model=schemas.LocationOut)
def update_location(
    location_id: int,
    data: schemas.LocationUpdate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    result = crud.update_location(db, location_id, plan.id, data)
    if not result:
        raise HTTPException(status_code=404, detail="地点不存在")
    return result


@app.delete("/api/plans/{plan_id}/locations/{location_id}")
def delete_location(
    location_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_location(db, location_id, plan.id, deleted_by_user_id=user.id):
        raise HTTPException(status_code=404, detail="地点不存在")
    return {"ok": True}


@app.get("/api/plans/{plan_id}/courses", response_model=list[schemas.CourseOut])
def list_courses(
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    active_only: bool = False,
):
    return crud.list_courses(db, plan.id, active_only=active_only)


@app.post("/api/plans/{plan_id}/courses", response_model=schemas.CourseOut)
def create_course(
    data: schemas.CourseCreate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    return crud.create_course(db, plan.id, data)


@app.post("/api/plans/{plan_id}/courses/reorder", response_model=list[schemas.CourseOut])
@app.put("/api/plans/{plan_id}/courses/reorder", response_model=list[schemas.CourseOut], include_in_schema=False)
def reorder_courses(
    data: schemas.ReorderIn,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    try:
        return crud.reorder_courses(db, plan.id, data.ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/plans/{plan_id}/courses/{course_id}", response_model=schemas.CourseOut)
def update_course(
    course_id: int,
    data: schemas.CourseUpdate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    result = crud.update_course(db, course_id, plan.id, data)
    if not result:
        raise HTTPException(status_code=404, detail="课程不存在")
    return result


@app.delete("/api/plans/{plan_id}/courses/{course_id}")
def delete_course(
    course_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_course(db, course_id, plan.id, deleted_by_user_id=user.id):
        raise HTTPException(status_code=404, detail="课程不存在")
    return {"ok": True}


@app.get("/api/plans/{plan_id}/schedule", response_model=list[schemas.ScheduleSlotOut])
def list_schedule(
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    target_date: date | None = Query(default=None, alias="date"),
):
    if target_date:
        return crud.list_schedule_for_date(db, plan.id, target_date)
    return crud.list_schedule_slots(db, plan.id)


@app.post("/api/plans/{plan_id}/schedule", response_model=schemas.ScheduleSlotOut)
def create_schedule_slot(
    data: schemas.ScheduleSlotCreate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    try:
        return crud.create_schedule_slot(db, plan.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.put("/api/plans/{plan_id}/schedule/{slot_id}", response_model=schemas.ScheduleSlotOut)
def update_schedule_slot(
    slot_id: int,
    data: schemas.ScheduleSlotUpdate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    try:
        result = crud.update_schedule_slot(db, slot_id, plan.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not result:
        raise HTTPException(status_code=404, detail="时段不存在")
    return result


@app.delete("/api/plans/{plan_id}/schedule/{slot_id}")
def delete_schedule_slot(
    slot_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_schedule_slot(db, slot_id, plan.id, deleted_by_user_id=user.id):
        raise HTTPException(status_code=404, detail="时段不存在")
    return {"ok": True}


@app.get("/api/plans/{plan_id}/slot-plans", response_model=list[schemas.SlotDailyPlanOut])
def list_slot_plans(
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    target_date: date | None = Query(default=None, alias="date"),
):
    return crud.list_slot_daily_plans(db, plan.id, target_date)


@app.post("/api/plans/{plan_id}/slot-plans", response_model=schemas.SlotDailyPlanOut)
def create_slot_plan(
    data: schemas.SlotDailyPlanCreate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    try:
        return crud.create_slot_daily_plan(db, plan.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/plans/{plan_id}/slot-plans/{plan_entry_id}", response_model=schemas.SlotDailyPlanOut)
def update_slot_plan(
    plan_entry_id: int,
    data: schemas.SlotDailyPlanUpdate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    result = crud.update_slot_daily_plan(db, plan.id, plan_entry_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="计划不存在")
    return result


@app.post("/api/plans/{plan_id}/slot-plans/{plan_entry_id}/complete", response_model=schemas.SlotDailyPlanOut)
def complete_slot_plan(
    plan_entry_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    score: float | None = Query(default=None, ge=0, le=10),
):
    result = crud.complete_slot_daily_plan(db, plan.id, plan_entry_id, score)
    if not result:
        raise HTTPException(status_code=404, detail="计划不存在")
    return result


@app.delete("/api/plans/{plan_id}/slot-plans/{plan_entry_id}")
def delete_slot_plan(
    plan_entry_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_slot_daily_plan(db, plan.id, plan_entry_id, deleted_by_user_id=user.id):
        raise HTTPException(status_code=404, detail="计划不存在")
    return {"ok": True}


@app.get("/api/plans/{plan_id}/schedule-exceptions", response_model=list[schemas.ScheduleExceptionOut])
def list_schedule_exceptions(
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    target_date: date | None = Query(default=None, alias="date"),
):
    return crud.list_schedule_exceptions(db, plan.id, target_date)


@app.post("/api/plans/{plan_id}/schedule-exceptions", response_model=schemas.ScheduleExceptionOut)
def create_schedule_exception(
    data: schemas.ScheduleExceptionCreate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    try:
        return crud.create_schedule_exception(db, plan.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/plans/{plan_id}/schedule-exceptions/{exc_id}", response_model=schemas.ScheduleExceptionOut)
def update_schedule_exception(
    exc_id: int,
    data: schemas.ScheduleExceptionUpdate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    result = crud.update_schedule_exception(db, plan.id, exc_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="调整记录不存在")
    return result


@app.delete("/api/plans/{plan_id}/schedule-exceptions/{exc_id}")
def delete_schedule_exception(
    exc_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_schedule_exception(db, plan.id, exc_id, deleted_by_user_id=user.id):
        raise HTTPException(status_code=404, detail="调整记录不存在")
    return {"ok": True}


@app.get("/api/plans/{plan_id}/subjects", response_model=list[schemas.SubjectOut])
def list_subjects(plan: models.Plan = Depends(require_plan), db: Session = Depends(get_db)):
    return crud.list_subjects(db, plan.id)


@app.post("/api/plans/{plan_id}/subjects", response_model=schemas.SubjectOut)
def create_subject(
    data: schemas.SubjectCreate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    return crud.create_subject(db, plan.id, data)


@app.post("/api/plans/{plan_id}/subjects/reorder", response_model=list[schemas.SubjectOut])
@app.put("/api/plans/{plan_id}/subjects/reorder", response_model=list[schemas.SubjectOut], include_in_schema=False)
def reorder_subjects(
    data: schemas.ReorderIn,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    try:
        return crud.reorder_subjects(db, plan.id, data.ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/plans/{plan_id}/subjects/{subject_id}", response_model=schemas.SubjectOut)
def update_subject(
    subject_id: int,
    data: schemas.SubjectUpdate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    result = crud.update_subject(db, subject_id, plan.id, data)
    if not result:
        raise HTTPException(status_code=404, detail="作业安排不存在")
    return result


@app.delete("/api/plans/{plan_id}/subjects/{subject_id}")
def delete_subject(
    subject_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_subject(db, subject_id, plan.id, deleted_by_user_id=user.id):
        raise HTTPException(status_code=404, detail="作业安排不存在")
    return {"ok": True}


@app.get("/api/plans/{plan_id}/task-guide", response_model=list[schemas.TaskAttachmentOut])
def get_plan_task_guide(
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    return crud.list_plan_task_guide(db, plan.id)


@app.put("/api/plans/{plan_id}/task-guide", response_model=list[schemas.TaskAttachmentOut])
def update_plan_task_guide(
    data: schemas.PlanTaskGuideUpdate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    return crud.replace_plan_task_guide(db, plan.id, data.attachments)


@app.get("/api/plans/{plan_id}/tasks", response_model=list[schemas.TaskOut])
def list_tasks(
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    active_only: bool = True,
):
    return crud.list_tasks(db, plan.id, active_only=active_only)


@app.post("/api/plans/{plan_id}/tasks", response_model=schemas.TaskOut)
def create_task(
    data: schemas.TaskCreate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    return crud.create_task(db, plan.id, data)


@app.post("/api/plans/{plan_id}/files/upload", response_model=schemas.FileUploadOut)
@app.post("/api/plans/{plan_id}/tasks/upload", response_model=schemas.FileUploadOut, include_in_schema=False)
async def upload_task_file(
    plan: models.Plan = Depends(require_plan),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        stored, original, size = await save_plan_upload(
            plan.id, file, max_bytes=get_upload_max_bytes(db)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return schemas.FileUploadOut(
        file_url=f"/api/plans/{plan.id}/files/{stored}",
        file_name=original,
        size=size,
        content_type=content_type_for(stored),
    )


@app.get("/api/plans/{plan_id}/files/{stored_name}")
def get_plan_file(
    stored_name: str,
    plan: models.Plan = Depends(require_plan),
):
    path = resolve_plan_file(plan.id, stored_name)
    if not path:
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(
        path,
        media_type=content_type_for(stored_name),
        filename=stored_name,
        content_disposition_type="inline",
    )


@app.get("/api/plans/{plan_id}/tasks/{task_id}/last-activity", response_model=schemas.TaskLastActivityOut | None)
def get_task_last_activity(
    task_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    before_date: date | None = Query(default=None, alias="before_date"),
    exclude_item_id: int | None = Query(default=None),
):
    if not crud.get_task(db, task_id, plan.id):
        raise HTTPException(status_code=404, detail="任务不存在")
    return crud.get_task_last_activity(db, plan.id, task_id, before_date, exclude_item_id)


@app.put("/api/plans/{plan_id}/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(
    task_id: int,
    data: schemas.TaskUpdate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    result = crud.update_task(db, task_id, plan.id, data)
    if not result:
        raise HTTPException(status_code=404, detail="任务不存在")
    return result


@app.delete("/api/plans/{plan_id}/tasks/{task_id}")
def delete_task(
    task_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_task(db, task_id, plan.id, deleted_by_user_id=user.id):
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"ok": True}


@app.get("/api/plans/{plan_id}/daily", response_model=list[schemas.DailyEntryOut])
def list_daily(
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    target_date: date | None = Query(default=None, alias="date"),
):
    return crud.list_daily_entries(db, plan.id, target_date)


@app.post("/api/plans/{plan_id}/daily", response_model=schemas.DailyEntryOut)
def create_daily(
    data: schemas.DailyEntryCreate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    try:
        return crud.create_daily_entry(db, plan.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/plans/{plan_id}/daily/{entry_id}", response_model=schemas.DailyEntryOut)
def update_daily(
    entry_id: int,
    data: schemas.DailyEntryUpdate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    result = crud.update_daily_entry(db, entry_id, plan.id, data)
    if not result:
        raise HTTPException(status_code=404, detail="记录不存在")
    return result


@app.post("/api/plans/{plan_id}/daily/{entry_id}/complete", response_model=schemas.DailyEntryOut)
def complete_daily(
    entry_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    completed_units: int = Query(ge=0),
    score: float | None = Query(default=None, ge=0, le=10),
):
    result = crud.complete_daily_entry(db, entry_id, plan.id, completed_units, score)
    if not result:
        raise HTTPException(status_code=404, detail="记录不存在")
    return result


@app.delete("/api/plans/{plan_id}/daily/{entry_id}")
def delete_daily(
    entry_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_daily_entry(db, entry_id, plan.id, deleted_by_user_id=user.id):
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"ok": True}


@app.get("/api/plans/{plan_id}/day-items", response_model=list[schemas.DayManualItemOut])
def list_day_items(
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    target_date: date | None = Query(default=None, alias="date"),
):
    return crud.list_day_manual_items(db, plan.id, target_date)


@app.post("/api/plans/{plan_id}/day-items", response_model=schemas.DayManualItemOut)
def create_day_item(
    data: schemas.DayManualItemCreate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    try:
        return crud.create_day_manual_item(db, plan.id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.put("/api/plans/{plan_id}/day-items/{item_id}", response_model=schemas.DayManualItemOut)
def update_day_item(
    item_id: int,
    data: schemas.DayManualItemUpdate,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
):
    try:
        result = crud.update_day_manual_item(db, plan.id, item_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not result:
        raise HTTPException(status_code=404, detail="事项不存在")
    return result


@app.post("/api/plans/{plan_id}/day-items/{item_id}/complete", response_model=schemas.DayManualItemOut)
def complete_day_item(
    item_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    score: float | None = Query(default=None, ge=0, le=10),
):
    result = crud.complete_day_manual_item(db, plan.id, item_id, score)
    if not result:
        raise HTTPException(status_code=404, detail="事项不存在")
    return result


@app.delete("/api/plans/{plan_id}/day-items/{item_id}")
def delete_day_item(
    item_id: int,
    plan: models.Plan = Depends(require_plan),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if not crud.delete_day_manual_item(db, plan.id, item_id, deleted_by_user_id=user.id):
        raise HTTPException(status_code=404, detail="事项不存在")
    return {"ok": True}
