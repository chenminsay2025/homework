import { useEffect, useState } from "react";
import {
  activityColor,
  api,
  formatDisplayDate,
  formatLocationName,
  formatTimeRange,
  locationOptionLabel,
  percent,
  statusColor,
  statusLabel,
} from "../api";
import type { DayManualItem, Location, Task, TaskLastActivity } from "../types";
import CompleteScoreSheet from "./CompleteScoreSheet";
import SelectMenu from "./SelectMenu";
import { TimePickerField } from "./TimePickerSheet";
import TaskPicker from "./TaskPicker";

type ItemSource = "custom" | "task";

type ItemForm = {
  source: ItemSource;
  task_id: number;
  title: string;
  start_time: string;
  end_time: string;
  location_id: number;
  description: string;
  planned_units: number;
};

function defaultHourlyTimes(): { start_time: string; end_time: string } {
  const now = new Date();
  const startH = now.getHours();
  const endH = Math.min(23, startH + 2);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { start_time: `${pad(startH)}:00`, end_time: `${pad(endH)}:00` };
}

function emptyForm(tasks: Task[] = []): ItemForm {
  const firstTask = tasks[0];
  const times = defaultHourlyTimes();
  return {
    source: tasks.length > 0 ? "task" : "custom",
    task_id: firstTask?.id || 0,
    title: firstTask?.title || "",
    ...times,
    location_id: 0,
    description: "",
    planned_units: 1,
  };
}

function itemToForm(item: DayManualItem): ItemForm {
  const times =
    item.start_time || item.end_time
      ? {
          start_time: item.start_time?.slice(0, 5) || "",
          end_time: item.end_time?.slice(0, 5) || "",
        }
      : defaultHourlyTimes();
  return {
    source: item.task_id ? "task" : "custom",
    task_id: item.task_id || 0,
    title: item.title,
    ...times,
    location_id: item.location_id || 0,
    description: item.description || "",
    planned_units: item.planned_units ?? 1,
  };
}

function sortItems(items: DayManualItem[]): DayManualItem[] {
  return [...items].sort((a, b) => {
    if (a.is_all_day !== b.is_all_day) return a.is_all_day ? -1 : 1;
    const ta = a.start_time || "99:99";
    const tb = b.start_time || "99:99";
    if (ta !== tb) return ta.localeCompare(tb);
    return a.id - b.id;
  });
}

function ManualItemFormSheet({
  open,
  onClose,
  editing,
  date,
  planId,
  locations,
  tasks,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: DayManualItem | null;
  date: string;
  planId: number;
  locations: Location[];
  tasks: Task[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ItemForm>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [lastActivity, setLastActivity] = useState<TaskLastActivity | null>(null);
  const [loadingLastActivity, setLoadingLastActivity] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing ? itemToForm(editing) : emptyForm(tasks));
      setLastActivity(null);
    }
  }, [open, editing, tasks]);

  useEffect(() => {
    if (!open || form.source !== "task" || !form.task_id) {
      setLastActivity(null);
      return;
    }
    let cancelled = false;
    setLoadingLastActivity(true);
    api
      .getTaskLastActivity(planId, form.task_id, {
        beforeDate: date,
        excludeItemId: editing?.id,
      })
      .then((data) => {
        if (!cancelled) setLastActivity(data);
      })
      .catch(() => {
        if (!cancelled) setLastActivity(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingLastActivity(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, form.source, form.task_id, date, planId, editing?.id]);

  useEffect(() => {
    if (!open || editing || form.source !== "task" || !lastActivity?.content) return;
    setForm((f) => (f.description.trim() ? f : { ...f, description: lastActivity.content! }));
  }, [open, editing, form.source, lastActivity, form.task_id]);

  if (!open) return null;

  const selectedTask = tasks.find((t) => t.id === form.task_id);
  const titleFromTask = form.source === "task" && selectedTask ? selectedTask.title : form.title;
  const effectiveTitle = editing
    ? (form.source === "task"
        ? selectedTask?.title || editing.task?.title || editing.title
        : form.title
      ).trim()
    : titleFromTask.trim();

  const handleSave = async () => {
    if (form.source === "custom" && !form.title.trim()) return;
    if (form.source === "task" && !form.task_id) return;
    if (form.source === "task" && form.planned_units < 1) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        is_all_day: false,
        location_id: form.location_id || null,
        description: form.description.trim() || null,
        planned_units: form.source === "task" && form.task_id ? form.planned_units : null,
      };
      if (editing) {
        if (form.source === "task") {
          if (form.task_id !== editing.task_id) {
            payload.task_id = form.task_id;
          }
        } else {
          payload.title = form.title.trim();
          if (editing.task_id) {
            payload.task_id = null;
          }
        }
        await api.updateDayItem(planId, editing.id, payload);
      } else {
        await api.createDayItem(planId, {
          date,
          title: effectiveTitle,
          task_id: form.source === "task" && form.task_id ? form.task_id : null,
          ...payload,
        });
      }
      onClose();
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleSourceChange = (source: ItemSource) => {
    if (source === "custom") {
      setForm({
        ...form,
        source,
        task_id: 0,
        title: editing?.task?.title || editing?.title || form.title,
      });
      return;
    }
    const firstTask = tasks[0];
    setForm({
      ...form,
      source,
      task_id: firstTask?.id || 0,
      title: firstTask?.title || "",
      description: "",
      planned_units: 1,
    });
  };

  const handleTaskChange = (task_id: number) => {
    const task = tasks.find((t) => t.id === task_id);
    setForm({
      ...form,
      task_id,
      title: task?.title || "",
      description: "",
      planned_units: 1,
    });
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-scroll">
          <div className="sheet-handle" />
          <h3 className="mb-1 text-lg font-semibold">
            {editing ? "编辑补充安排" : "添加补充安排"}
          </h3>
          <p className="mb-4 text-sm text-slate-500">仅出现在 {date}，不会加入周课表</p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-600">来源</label>
              <SelectMenu
                value={form.source}
                options={[
                  { value: "task" as const, label: "从任务选择" },
                  { value: "custom" as const, label: "自定义" },
                ]}
                onChange={handleSourceChange}
              />
            </div>
            {form.source === "task" && (
              <div>
                <label className="mb-2 block text-sm text-slate-600">任务</label>
                <TaskPicker
                  tasks={tasks}
                  value={form.task_id}
                  onChange={handleTaskChange}
                />
              </div>
            )}
            {form.source === "custom" && (
              <div>
                <label className="mb-1 block text-sm text-slate-600">事项名称</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="如：钢琴考级练习、医院复查"
                  autoFocus={!editing}
                />
              </div>
            )}
            {form.source === "task" && selectedTask && (
              <div>
                <label className="mb-1 block text-sm text-slate-600">
                  今日计划（{selectedTask.unit_label}）
                </label>
                <input
                  type="number"
                  min={1}
                  className="input max-w-[8rem]"
                  value={form.planned_units}
                  onChange={(e) =>
                    setForm({ ...form, planned_units: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </div>
            )}
            {form.source === "task" && selectedTask && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-sm font-medium text-slate-800">{selectedTask.title}</p>
                {selectedTask.description && (
                  <p className="mt-0.5 text-sm text-slate-500">{selectedTask.description}</p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  总进度 {selectedTask.completed_units}/{selectedTask.total_units}{" "}
                  {selectedTask.unit_label}（{percent(selectedTask.progress_ratio)}）
                </p>
                {loadingLastActivity ? (
                  <p className="mt-2 text-xs text-slate-400">加载上次记录...</p>
                ) : lastActivity ? (
                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <p className="text-xs text-slate-500">
                      上次 · {formatDisplayDate(lastActivity.date)}
                      {lastActivity.source === "daily" ? " · 长期作业" : " · 补充安排"}
                      {lastActivity.status && ` · ${statusLabel[lastActivity.status] || lastActivity.status}`}
                    </p>
                    {lastActivity.planned_units != null && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        计划 {lastActivity.planned_units} {lastActivity.unit_label}，完成{" "}
                        {lastActivity.completed_units ?? 0} {lastActivity.unit_label}
                      </p>
                    )}
                    {lastActivity.content && (
                      <p className="mt-1 text-sm text-slate-600">{lastActivity.content}</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">暂无更早的记录</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-600">开始时间</label>
                <TimePickerField
                  value={form.start_time}
                  onChange={(start_time) => setForm({ ...form, start_time })}
                  title="开始时间"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">结束时间</label>
                <TimePickerField
                  value={form.end_time}
                  onChange={(end_time) => setForm({ ...form, end_time })}
                  title="结束时间"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">地点（可选）</label>
              <SelectMenu
                value={form.location_id}
                options={[
                  { value: 0, label: "不指定" },
                  ...locations.map((l) => ({ value: l.id, label: locationOptionLabel(l) })),
                ]}
                onChange={(location_id) => setForm({ ...form, location_id })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">
                {form.source === "task" ? "详细说明（可选）" : "说明（可选）"}
              </label>
              <textarea
                className="input min-h-[4rem] resize-none"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={form.source === "task" ? "如：教材全解 P30-34" : "补充备注"}
              />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary"
              disabled={
                saving ||
                (form.source === "custom" ? !form.title.trim() : !form.task_id || form.planned_units < 1)
              }
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoreButton({ onClick }: { onClick: () => void }) {
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

function ManualItemHeaderLine({ item }: { item: DayManualItem }) {
  const timeText =
    item.is_all_day || (!item.start_time && !item.end_time)
      ? "时间不限"
      : formatTimeRange(item.start_time, item.end_time, false);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-sm font-medium text-slate-800">{item.title}</span>
      <span className="text-sm text-slate-500">{timeText}</span>
      {!item.is_all_day && (
        <span className="text-sm text-slate-500">📍 {formatLocationName(item.location)}</span>
      )}
    </div>
  );
}

function ManualItemActionSheet({
  item,
  show,
  onClose,
  onComplete,
  onEdit,
  onRevoke,
  onDelete,
}: {
  item: DayManualItem;
  show: boolean;
  onClose: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onRevoke: () => void;
  onDelete: () => void;
}) {
  if (!show) return null;

  const timeText =
    item.is_all_day || (!item.start_time && !item.end_time)
      ? "时间不限"
      : formatTimeRange(item.start_time, item.end_time, false);

  return (
    <div className="sheet-backdrop z-[60]" onClick={onClose}>
      <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="action-sheet-title">
          <p>{item.title}</p>
          <p className="action-sheet-subtitle">
            {timeText}
            {!item.is_all_day && ` · 📍 ${formatLocationName(item.location)}`}
          </p>
        </div>
        <div className="action-sheet-group">
          {item.status !== "completed" && (
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
          {item.status === "completed" && (
            <button
              type="button"
              className="action-sheet-item text-orange-600"
              onClick={() => {
                onClose();
                onRevoke();
              }}
            >
              撤销完成
            </button>
          )}
          <button
            type="button"
            className="action-sheet-item text-red-600"
            onClick={() => {
              onClose();
              onDelete();
            }}
          >
            删除
          </button>
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

function ManualItemCard({
  item,
  planId,
  onEdit,
  onUpdated,
}: {
  item: DayManualItem;
  planId: number;
  onEdit: () => void;
  onUpdated: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const barColor = item.task?.subject?.color || activityColor(item.title);

  const handleComplete = async (score: number | null) => {
    await api.completeDayItem(planId, item.id, score ?? undefined);
    onUpdated();
  };

  const handleUncomplete = async () => {
    if (!confirm("改回未完成？")) return;
    await api.updateDayItem(planId, item.id, { status: "planned", score: null });
    onUpdated();
  };

  const handleDelete = async () => {
    if (!confirm(`确定删除「${item.title}」？`)) return;
    await api.deleteDayItem(planId, item.id);
    onUpdated();
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: barColor }} />
          <div className="min-w-0 flex-1">
            <ManualItemHeaderLine item={item} />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {item.task?.subject && (
                <span className="badge bg-slate-100 text-slate-600">{item.task.subject.name}</span>
              )}
              <span className={`badge ${statusColor[item.status]}`}>{statusLabel[item.status]}</span>
              {item.score !== null && (
                <span className="text-xs text-slate-500">评分 {item.score}/10</span>
              )}
            </div>
            {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
            {item.task && item.planned_units != null && (
              <p className="mt-1 text-sm text-slate-600">
                今日 {item.planned_units} {item.task.unit_label}
              </p>
            )}
          </div>
          <MoreButton onClick={() => setShowMenu(true)} />
        </div>
      </div>

      <ManualItemActionSheet
        item={item}
        show={showMenu}
        onClose={() => setShowMenu(false)}
        onComplete={() => setShowScoreSheet(true)}
        onEdit={onEdit}
        onRevoke={handleUncomplete}
        onDelete={handleDelete}
      />
      <CompleteScoreSheet
        open={showScoreSheet}
        onClose={() => setShowScoreSheet(false)}
        title={`完成 · ${item.title}`}
        subtitle={item.description || undefined}
        onConfirm={handleComplete}
      />
    </>
  );
}

export default function DayManualItems({
  items,
  date,
  planId,
  tasks,
  onUpdated,
  formOpen,
  onFormClose,
}: {
  items: DayManualItem[];
  date: string;
  planId: number;
  tasks: Task[];
  onUpdated: () => void;
  formOpen: boolean;
  onFormClose: () => void;
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [editing, setEditing] = useState<DayManualItem | null>(null);

  useEffect(() => {
    api.getLocations(planId).then(setLocations);
  }, [planId]);

  useEffect(() => {
    if (formOpen) setEditing(null);
  }, [formOpen]);

  const openEdit = (item: DayManualItem) => {
    setEditing(item);
  };

  const sorted = sortItems(items);
  const sheetOpen = formOpen || editing !== null;

  const closeForm = () => {
    setEditing(null);
    onFormClose();
  };

  return (
    <>
      {sorted.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          {sorted.map((item) => (
            <ManualItemCard
              key={item.id}
              item={item}
              planId={planId}
              onEdit={() => openEdit(item)}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      )}
      <ManualItemFormSheet
        open={sheetOpen}
        onClose={closeForm}
        editing={editing}
        date={date}
        planId={planId}
        locations={locations}
        tasks={tasks}
        onSaved={() => {
          closeForm();
          onUpdated();
        }}
      />
    </>
  );
}
