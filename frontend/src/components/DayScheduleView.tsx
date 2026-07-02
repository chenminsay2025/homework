import { useEffect, useState } from "react";
import {
  activityColor,
  api,
  DAY_STATUS_LABEL,
  displayLocation,
  displayTimeRange,
  EXCEPTION_REASONS,
  formatLocationName,
  locationOptionLabel,
  formatTimeRange,
  percent,
  statusColor,
  statusLabel,
} from "../api";
import type { Location, ScheduleSlot, SlotDailyPlan, Task } from "../types";
import SelectMenu from "./SelectMenu";
import TaskPicker from "./TaskPicker";
import { TimePickerField } from "./TimePickerSheet";
import CompleteScoreSheet from "./CompleteScoreSheet";
import SwipeActionRow, { type SwipeAction } from "./SwipeActionRow";

function isVirtualSlotPlan(plan: SlotDailyPlan): boolean {
  return plan.id <= 0;
}

function effectiveSlotDailyPlan(slot: ScheduleSlot, date: string): SlotDailyPlan | null {
  if (slot.daily_plan) return slot.daily_plan;
  const task = slot.default_task;
  const taskId = slot.default_task_id;
  if (!taskId || !task) return null;
  const base = (task.description || task.title).trim();
  return {
    id: 0,
    slot_id: slot.id,
    date,
    task_id: taskId,
    description: `${base}（今日 1${task.unit_label}）`,
    planned_units: 1,
    status: "planned",
    score: null,
    notes: null,
    created_at: "",
    task,
  };
}

function SlotExceptionBadge({ slot }: { slot: ScheduleSlot }) {
  if (slot.day_status !== "rescheduled") return null;
  return (
    <span className="badge bg-orange-50 text-orange-700">
      {DAY_STATUS_LABEL[slot.day_status]}
      {slot.exception?.reason ? ` · ${slot.exception.reason}` : ""}
    </span>
  );
}

function CancelledSlotNote({ reason }: { reason?: string | null }) {
  return (
    <p className="mt-1 text-xs text-red-500">
      今日不上课{reason ? ` · ${reason}` : ""}
    </p>
  );
}

function SlotTaskProgressBar({ task }: { task: Task }) {
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>
          {task.completed_units}/{task.total_units} {task.unit_label}
        </span>
        <span>{percent(task.progress_ratio)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${Math.min(task.progress_ratio * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function SlotMoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="更多操作"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-slate-500 active:bg-slate-100"
    >
      ⋮
    </button>
  );
}

function SlotAdjustFormSheet({
  open,
  onClose,
  slot,
  date,
  planId,
  locations,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  slot: ScheduleSlot;
  date: string;
  planId: number;
  locations: Location[];
  onUpdated: () => void;
}) {
  const [form, setForm] = useState({
    exception_type: "cancelled" as "cancelled" | "rescheduled",
    reason: EXCEPTION_REASONS[0],
    start_time: slot.start_time?.slice(0, 5) || "09:00",
    end_time: slot.end_time?.slice(0, 5) || "10:00",
    location_id: slot.location_id || 0,
    notes: "",
  });

  const handleSave = async () => {
    try {
      await api.createScheduleException(planId, {
        slot_id: slot.id,
        date,
        exception_type: form.exception_type,
        reason: form.reason,
        start_time: form.exception_type === "rescheduled" ? form.start_time : null,
        end_time: form.exception_type === "rescheduled" ? form.end_time : null,
        location_id:
          form.exception_type === "rescheduled" && form.location_id
            ? form.location_id
            : null,
        notes: form.notes || undefined,
      });
      onClose();
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    }
  };

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-scroll">
          <div className="sheet-handle" />
          <h3 className="mb-1 text-lg font-semibold">临时调整 · {slot.activity}</h3>
          <p className="mb-4 text-sm text-slate-500">仅影响 {date} 当天，不改变周课表</p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-600">调整类型</label>
              <SelectMenu
                value={form.exception_type}
                options={[
                  { value: "cancelled" as const, label: "请假 / 停课" },
                  { value: "rescheduled" as const, label: "改时间或地点" },
                ]}
                onChange={(exception_type) => setForm({ ...form, exception_type })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">原因</label>
              <SelectMenu
                value={form.reason}
                options={EXCEPTION_REASONS.map((r) => ({ value: r, label: r }))}
                onChange={(reason) => setForm({ ...form, reason })}
              />
            </div>
            {form.exception_type === "rescheduled" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-600">新开始时间</label>
                    <TimePickerField
                      value={form.start_time}
                      onChange={(start_time) => setForm({ ...form, start_time })}
                      title="新开始时间"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-600">新结束时间</label>
                    <TimePickerField
                      value={form.end_time}
                      onChange={(end_time) => setForm({ ...form, end_time })}
                      title="新结束时间"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">新地点（可选）</label>
                  <SelectMenu
                    value={form.location_id}
                    options={[
                      { value: 0, label: "保持原地点" },
                      ...locations.map((l) => ({ value: l.id, label: locationOptionLabel(l) })),
                    ]}
                    onChange={(location_id) => setForm({ ...form, location_id })}
                  />
                </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-sm text-slate-600">备注（可选）</label>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button type="button" onClick={handleSave} className="btn-primary">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlotAdjustActionSheet({
  slot,
  show,
  onClose,
  onAdjust,
  onRestore,
}: {
  slot: ScheduleSlot;
  show: boolean;
  onClose: () => void;
  onAdjust: () => void;
  onRestore: () => void;
}) {
  if (!show) return null;

  const hasException = !!slot.exception;

  return (
    <div className="sheet-backdrop z-[60]" onClick={onClose}>
      <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="action-sheet-title">
          <p>{slot.activity}</p>
          <p className="action-sheet-subtitle">
            {formatTimeRange(slot.start_time, slot.end_time, slot.is_all_day)}
            {!slot.is_all_day && slot.location && ` · ${formatLocationName(slot.location)}`}
          </p>
        </div>
        <div className="action-sheet-group">
          {hasException ? (
            <button
              type="button"
              className="action-sheet-item text-indigo-600"
              onClick={() => {
                onClose();
                onRestore();
              }}
            >
              恢复常态
            </button>
          ) : (
            <button
              type="button"
              className="action-sheet-item text-indigo-600"
              onClick={() => {
                onClose();
                onAdjust();
              }}
            >
              临时调整
            </button>
          )}
        </div>
        <div className="action-sheet-cancel">
          <button type="button" className="action-sheet-item" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

function SelfStudyActionSheet({
  slot,
  plan,
  hasPersistedPlan,
  cancelled,
  show,
  onClose,
  onWritePlan,
  onComplete,
  onAdjust,
  onRestore,
  onEdit,
  onRefill,
  onRevoke,
  onDelete,
}: {
  slot: ScheduleSlot;
  plan: SlotDailyPlan | null | undefined;
  hasPersistedPlan: boolean;
  cancelled: boolean;
  show: boolean;
  onClose: () => void;
  onWritePlan: () => void;
  onComplete: () => void;
  onAdjust: () => void;
  onRestore: () => void;
  onEdit: () => void;
  onRefill: () => void;
  onRevoke: () => void;
  onDelete: () => void;
}) {
  if (!show) return null;

  const hasException = !!slot.exception;

  return (
    <div className="sheet-backdrop z-[60]" onClick={onClose}>
      <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="action-sheet-title">
          <p>{slot.activity}</p>
          <p className="action-sheet-subtitle">
            {formatTimeRange(slot.start_time, slot.end_time, slot.is_all_day)}
            {!slot.is_all_day && slot.location && ` · ${formatLocationName(slot.location)}`}
          </p>
        </div>
        {!cancelled && (
          <div className="action-sheet-group">
            {!plan ? (
              <button
                type="button"
                className="action-sheet-item text-indigo-600"
                onClick={() => {
                  onClose();
                  onWritePlan();
                }}
              >
                选择任务
              </button>
            ) : (
              <>
                {plan.status !== "completed" && (
                  <button
                    type="button"
                    className="action-sheet-item text-indigo-600"
                    onClick={() => {
                      onClose();
                      onComplete();
                    }}
                  >
                    完成
                  </button>
                )}
                <button
                  type="button"
                  className="action-sheet-item text-indigo-600"
                  onClick={() => {
                    onClose();
                    onEdit();
                  }}
                >
                  修改
                </button>
                {hasPersistedPlan && (
                  <>
                    <button
                      type="button"
                      className="action-sheet-item text-indigo-600"
                      onClick={() => {
                        onClose();
                        onRefill();
                      }}
                    >
                      重填
                    </button>
                    <button
                      type="button"
                      className="action-sheet-item text-orange-600"
                      onClick={() => {
                        onClose();
                        onRevoke();
                      }}
                    >
                      {plan.status === "completed" ? "撤销完成" : "撤销填写"}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="action-sheet-item text-red-600"
                  onClick={() => {
                    onClose();
                    onDelete();
                  }}
                >
                  {hasPersistedPlan ? "删除" : "取消默认任务"}
                </button>
              </>
            )}
          </div>
        )}
        <div className="action-sheet-group">
          {hasException ? (
            <button
              type="button"
              className="action-sheet-item text-indigo-600"
              onClick={() => {
                onClose();
                onRestore();
              }}
            >
              恢复常态
            </button>
          ) : (
            <button
              type="button"
              className="action-sheet-item text-indigo-600"
              onClick={() => {
                onClose();
                onAdjust();
              }}
            >
              临时调整
            </button>
          )}
        </div>
        <div className="action-sheet-cancel">
          <button type="button" className="action-sheet-item" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

function buildSlotAdjustActions(
  slot: ScheduleSlot,
  planId: number,
  onUpdated: () => void,
  onAdjust: () => void,
): SwipeAction[] {
  const handleRestore = async () => {
    if (!slot.exception || !confirm("恢复为常规课表安排？")) return;
    await api.deleteScheduleException(planId, slot.exception.id);
    onUpdated();
  };

  if (slot.exception) {
    return [{ label: "恢复", onClick: handleRestore }];
  }
  return [{ label: "调整", onClick: onAdjust }];
}

function SlotHeaderLine({
  slot,
  cancelled,
}: {
  slot: ScheduleSlot;
  cancelled: boolean;
}) {
  const muted = cancelled ? "text-slate-400 line-through" : "text-slate-500";
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={`text-sm font-medium ${cancelled ? "text-slate-400 line-through" : "text-slate-800"}`}>
        {slot.activity}
      </span>
      <span className={`text-sm ${muted}`}>
        {formatTimeRange(slot.start_time, slot.end_time, slot.is_all_day)}
      </span>
      {!slot.is_all_day && (
        <span className={`text-sm ${muted}`}>📍 {formatLocationName(slot.location)}</span>
      )}
      <SlotExceptionBadge slot={slot} />
    </div>
  );
}

export function ClassSlotCard({
  slot,
  date,
  planId,
  locations,
  onUpdated,
  swipeOpen = false,
  onSwipeOpenChange,
}: {
  slot: ScheduleSlot;
  date: string;
  planId: number;
  locations: Location[];
  onUpdated: () => void;
  swipeOpen?: boolean;
  onSwipeOpenChange?: (open: boolean) => void;
}) {
  const cancelled = slot.day_status === "cancelled";
  const rescheduled = slot.day_status === "rescheduled";
  const [showMenu, setShowMenu] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleRestore = async () => {
    if (!slot.exception || !confirm("恢复为常规课表安排？")) return;
    await api.deleteScheduleException(planId, slot.exception.id);
    onUpdated();
  };

  const swipeActions = buildSlotAdjustActions(slot, planId, onUpdated, () => setShowForm(true));

  return (
    <>
      <SwipeActionRow
        actions={swipeActions}
        swipeOpen={swipeOpen}
        onSwipeOpenChange={onSwipeOpenChange}
      >
        <div
          className={`flex w-full min-h-[2.75rem] items-start gap-3 border px-4 py-3 ${
            cancelled ? "border-red-100 bg-red-50" : "border-slate-100 bg-white"
          }`}
        >
          <div
            className="w-1 self-stretch rounded-full"
            style={{ backgroundColor: activityColor(slot.activity, slot.course) }}
          />
          <div className="min-w-0 flex-1">
            <SlotHeaderLine slot={slot} cancelled={cancelled} />
            {slot.course?.teacher && (
              <p className="mt-0.5 text-sm text-slate-600">老师：{slot.course.teacher}</p>
            )}
            {rescheduled && (
              <p className="mt-1 text-sm font-medium text-orange-700">
                改为：{displayTimeRange(slot)}
                {!slot.is_all_day && ` · 📍 ${displayLocation(slot)}`}
              </p>
            )}
            {cancelled ? (
              <CancelledSlotNote reason={slot.exception?.reason} />
            ) : (
              <p className="mt-1 text-xs text-slate-400">按时上课即可</p>
            )}
          </div>
          <SlotMoreButton onClick={() => setShowMenu(true)} />
        </div>
      </SwipeActionRow>

      <SlotAdjustActionSheet
        slot={slot}
        show={showMenu}
        onClose={() => setShowMenu(false)}
        onAdjust={() => setShowForm(true)}
        onRestore={handleRestore}
      />
      <SlotAdjustFormSheet
        open={showForm}
        onClose={() => setShowForm(false)}
        slot={slot}
        date={date}
        planId={planId}
        locations={locations}
        onUpdated={onUpdated}
      />
    </>
  );
}

export function SelfStudySlotCard({
  slot,
  date,
  planId,
  locations,
  tasks,
  onUpdated,
  swipeOpen = false,
  onSwipeOpenChange,
}: {
  slot: ScheduleSlot;
  date: string;
  planId: number;
  locations: Location[];
  tasks: Task[];
  onUpdated: () => void;
  swipeOpen?: boolean;
  onSwipeOpenChange?: (open: boolean) => void;
}) {
  const plan = effectiveSlotDailyPlan(slot, date);
  const savedPlan = slot.daily_plan;
  const cancelled = slot.day_status === "cancelled";
  const rescheduled = slot.day_status === "rescheduled";
  const [showMenu, setShowMenu] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planFormMode, setPlanFormMode] = useState<"create" | "edit" | "refill">("create");
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const [taskId, setTaskId] = useState(0);
  const [plannedUnits, setPlannedUnits] = useState(1);
  const [saving, setSaving] = useState(false);

  const selectedTask = tasks.find((t) => t.id === taskId);

  const openPlanForm = (existing?: SlotDailyPlan | null, mode: "create" | "edit" | "refill" = "create") => {
    setTaskId(existing?.task_id || tasks[0]?.id || 0);
    setPlannedUnits(existing?.planned_units || 1);
    setPlanFormMode(mode);
    setShowPlanForm(true);
  };

  const handleSavePlan = async () => {
    if (!taskId) return;
    setSaving(true);
    try {
      if (savedPlan && planFormMode !== "refill") {
        await api.updateSlotPlan(planId, savedPlan.id, { task_id: taskId, planned_units: plannedUnits });
      } else {
        await api.createSlotPlan(planId, {
          slot_id: slot.id,
          date,
          task_id: taskId,
          planned_units: plannedUnits,
        });
      }
      setShowPlanForm(false);
      onUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!plan) return;
    if (isVirtualSlotPlan(plan)) {
      if (!confirm("取消课表绑定的默认任务？")) return;
      await api.updateScheduleSlot(planId, slot.id, { default_task_id: null });
      onUpdated();
      return;
    }
    if (!confirm("删除今日计划内容？")) return;
    await api.deleteSlotPlan(planId, plan.id);
    onUpdated();
  };

  const handleRefill = async () => {
    if (!confirm("清空后重新填写？")) return;
    if (savedPlan) {
      await api.deleteSlotPlan(planId, savedPlan.id);
    }
    openPlanForm(null, "refill");
    onUpdated();
  };

  const handleRevoke = async () => {
    if (!savedPlan) return;
    if (savedPlan.status === "completed") {
      if (!confirm("撤销完成状态？内容将保留。")) return;
      await api.updateSlotPlan(planId, savedPlan.id, { status: "planned", score: null });
    } else {
      if (!confirm("撤销今日填写？")) return;
      await api.deleteSlotPlan(planId, savedPlan.id);
    }
    onUpdated();
  };

  const handleComplete = async (score: number | null) => {
    if (!plan) return;
    let entryId = plan.id;
    if (isVirtualSlotPlan(plan)) {
      const created = await api.createSlotPlan(planId, {
        slot_id: slot.id,
        date,
        task_id: plan.task_id!,
        planned_units: plan.planned_units,
      });
      entryId = created.id;
    }
    await api.completeSlotPlan(planId, entryId, score ?? undefined);
    onUpdated();
  };

  const handleRestore = async () => {
    if (!slot.exception || !confirm("恢复为常规课表安排？")) return;
    await api.deleteScheduleException(planId, slot.exception.id);
    onUpdated();
  };

  const adjustActions = buildSlotAdjustActions(
    slot,
    planId,
    onUpdated,
    () => setShowAdjustForm(true),
  );

  const taskSwipeActions =
    cancelled
      ? []
      : plan
        ? [
            { label: "修改", onClick: () => openPlanForm(plan, "edit") },
            {
              label: "删除",
              className: "bg-red-500 active:bg-red-600",
              onClick: () => void handleDeletePlan(),
            },
          ]
        : [{ label: "选择", onClick: () => openPlanForm() }];

  const swipeActions = [...taskSwipeActions, ...adjustActions];

  return (
    <>
      <SwipeActionRow
        actions={swipeActions}
        swipeOpen={swipeOpen}
        onSwipeOpenChange={onSwipeOpenChange}
      >
        <div
          className={`flex w-full min-h-[2.75rem] items-start gap-3 border px-4 py-3 ${
            cancelled ? "border-red-100 bg-red-50" : "border-slate-100 bg-white"
          }`}
        >
          <div
            className="w-1 self-stretch rounded-full"
            style={{ backgroundColor: activityColor(slot.activity, slot.course) }}
          />
          <div className="min-w-0 flex-1">
            <SlotHeaderLine slot={slot} cancelled={cancelled} />
            {slot.course?.teacher && (
              <p className="mt-0.5 text-sm text-slate-600">老师：{slot.course.teacher}</p>
            )}
            {rescheduled && (
              <p className="mt-1 text-sm font-medium text-orange-700">
                改为：{displayTimeRange(slot)}
                {!slot.is_all_day && ` · 📍 ${displayLocation(slot)}`}
              </p>
            )}
            {cancelled ? (
              <CancelledSlotNote reason={slot.exception?.reason} />
            ) : plan ? (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`badge ${statusColor[plan.status]}`}>{statusLabel[plan.status]}</span>
                  {plan.score !== null && (
                    <span className="text-xs text-slate-500">评分 {plan.score}/10</span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {plan.task?.title || slot.activity}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                  今日 {plan.planned_units} {plan.task?.unit_label || "节"}
                  {plan.task?.description ? ` · ${plan.task.description}` : ""}
                </p>
                {plan.task && <SlotTaskProgressBar task={plan.task} />}
              </>
            ) : (
              <p
                role="button"
                tabIndex={0}
                className="mt-1 cursor-pointer text-xs font-medium text-amber-600 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  openPlanForm();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPlanForm();
                  }
                }}
              >
                点击 ⋮ 选择今日任务
              </p>
            )}
          </div>
          <SlotMoreButton onClick={() => setShowMenu(true)} />
        </div>
      </SwipeActionRow>

      <SelfStudyActionSheet
        slot={slot}
        plan={plan}
        hasPersistedPlan={!!savedPlan}
        cancelled={cancelled}
        show={showMenu}
        onClose={() => setShowMenu(false)}
        onWritePlan={() => openPlanForm()}
        onComplete={() => setShowScoreSheet(true)}
        onAdjust={() => setShowAdjustForm(true)}
        onRestore={handleRestore}
        onEdit={() => openPlanForm(plan, "edit")}
        onRefill={handleRefill}
        onRevoke={handleRevoke}
        onDelete={handleDeletePlan}
      />
      <SlotAdjustFormSheet
        open={showAdjustForm}
        onClose={() => setShowAdjustForm(false)}
        slot={slot}
        date={date}
        planId={planId}
        locations={locations}
        onUpdated={onUpdated}
      />

      {showPlanForm && (
        <div className="sheet-backdrop" onClick={() => setShowPlanForm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-scroll">
              <div className="sheet-handle" />
              <h3 className="mb-1 text-lg font-semibold">
                {planFormMode === "edit"
                  ? "修改今日任务"
                  : planFormMode === "refill"
                    ? "重选今日任务"
                    : "选择今日任务"}
              </h3>
              <p className="mb-4 text-sm text-slate-500">
                {slot.activity} · {formatTimeRange(slot.start_time, slot.end_time, slot.is_all_day)}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-slate-600">任务</label>
                  <TaskPicker
                    variant="list"
                    tasks={tasks}
                    value={taskId}
                    onChange={(id) => {
                      setTaskId(id);
                      setPlannedUnits(1);
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">
                    今日计划量{selectedTask ? `（${selectedTask.unit_label}）` : ""}
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={plannedUnits}
                    onChange={(e) => setPlannedUnits(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button onClick={() => setShowPlanForm(false)} className="btn-secondary" disabled={saving}>
                  取消
                </button>
                <button
                  onClick={handleSavePlan}
                  className="btn-primary"
                  disabled={saving || !taskId}
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <CompleteScoreSheet
        open={showScoreSheet}
        onClose={() => setShowScoreSheet(false)}
        title={`完成 · ${slot.activity}`}
        subtitle={plan?.task?.title || plan?.description}
        onConfirm={handleComplete}
      />
    </>
  );
}

export default function DayScheduleView({
  slots,
  date,
  planId,
  tasks = [],
  onUpdated,
  emptyText = "当天没有课表安排",
}: {
  slots: ScheduleSlot[];
  date: string;
  planId: number;
  tasks?: Task[];
  onUpdated?: () => void;
  emptyText?: string;
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [swipeOpenId, setSwipeOpenId] = useState<number | null>(null);

  useEffect(() => {
    api.getLocations(planId).then(setLocations);
  }, [planId]);

  useEffect(() => {
    if (swipeOpenId === null) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest("[data-swipe-row]")) setSwipeOpenId(null);
    };
    document.addEventListener("touchstart", close);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("touchstart", close);
      document.removeEventListener("mousedown", close);
    };
  }, [swipeOpenId]);

  if (slots.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">{emptyText}</p>;
  }

  const refresh = onUpdated || (() => {});

  const sortByTime = (a: ScheduleSlot, b: ScheduleSlot) => {
    if (a.is_all_day !== b.is_all_day) return a.is_all_day ? -1 : 1;
    const ta = a.start_time || "99:99";
    const tb = b.start_time || "99:99";
    if (ta !== tb) return ta.localeCompare(tb);
    return a.sort_order - b.sort_order || a.id - b.id;
  };

  const sortedSlots = [...slots].sort(sortByTime);

  return (
    <div className="space-y-2">
      {sortedSlots.map((s) =>
        s.slot_type === "class" ? (
          <ClassSlotCard
            key={s.id}
            slot={s}
            date={date}
            planId={planId}
            locations={locations}
            onUpdated={refresh}
            swipeOpen={swipeOpenId === s.id}
            onSwipeOpenChange={(open) => setSwipeOpenId(open ? s.id : null)}
          />
        ) : (
          <SelfStudySlotCard
            key={s.id}
            slot={s}
            date={date}
            planId={planId}
            locations={locations}
            tasks={tasks}
            onUpdated={refresh}
            swipeOpen={swipeOpenId === s.id}
            onSwipeOpenChange={(open) => setSwipeOpenId(open ? s.id : null)}
          />
        ),
      )}
    </div>
  );
}
