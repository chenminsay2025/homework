import { useCallback, useEffect, useState } from "react";
import { api, addDaysToDateStr, formatDate, percent, statusColor, statusLabel } from "../api";
import { usePlan } from "../context/PlanContext";
import type { DailyEntry, DayManualItem, ScheduleSlot, Task } from "../types";
import { showAppError } from "../utils/appMessage";
import DayManualItems from "./DayManualItems";
import DayScheduleView from "./DayScheduleView";
import CompleteScoreSheet from "./CompleteScoreSheet";
import SelectMenu from "./SelectMenu";
import SwipeDateBar from "./SwipeDateBar";

export default function DailyPlanView() {
  const { currentPlanId } = usePlan();
  const planId = currentPlanId!;
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [dayItems, setDayItems] = useState<DayManualItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showScoreSheet, setShowScoreSheet] = useState(false);
  const [completingEntry, setCompletingEntry] = useState<DailyEntry | null>(null);
  const [editing, setEditing] = useState<DailyEntry | null>(null);
  const [form, setForm] = useState({ task_id: 0, planned_description: "", planned_units: 1 });

  const resetForm = () => {
    setForm({ task_id: tasks[0]?.id || 0, planned_description: "", planned_units: 1 });
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setShowForm(true);
  };

  const openEdit = (entry: DailyEntry) => {
    setEditing(entry);
    setForm({
      task_id: entry.task_id,
      planned_description: entry.planned_description || "",
      planned_units: entry.planned_units,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.task_id) return;
    try {
      if (editing) {
        await api.updateDaily(planId, editing.id, {
          planned_description: form.planned_description || undefined,
          planned_units: form.planned_units,
        });
      } else {
        await api.createDaily(planId, {
          task_id: form.task_id,
          date: selectedDate,
          planned_description: form.planned_description || undefined,
          planned_units: form.planned_units,
        });
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      load();
    } catch (e) {
      showAppError(e, editing ? "保存失败" : "添加失败");
    }
  };

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const [daily, daySchedule, manualItems, taskList] = await Promise.all([
        api.getDaily(planId, selectedDate),
        api.getSchedule(planId, selectedDate),
        api.getDayItems(planId, selectedDate),
        api.getTasks(planId),
      ]);
      setEntries(daily);
      setSchedule(daySchedule);
      setDayItems(manualItems);
      setTasks(taskList);
    } catch (e) {
      showAppError(e, "加载每日计划失败");
    } finally {
      setLoading(false);
    }
  }, [planId, selectedDate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tasks.length > 0 && form.task_id === 0) {
      setForm((f) => ({ ...f, task_id: tasks[0].id }));
    }
  }, [tasks, form.task_id]);

  if (!planId) return null;

  const shiftDate = (days: number) => {
    setSelectedDate((prev) => addDaysToDateStr(prev, days));
  };

  const openComplete = (entry: DailyEntry) => {
    setCompletingEntry(entry);
    setShowScoreSheet(true);
  };

  const handleComplete = async (score: number | null) => {
    if (!completingEntry) return;
    try {
      await api.completeDaily(
        planId,
        completingEntry.id,
        completingEntry.planned_units,
        score ?? undefined,
      );
      setCompletingEntry(null);
      load();
    } catch (e) {
      showAppError(e, "操作失败");
      throw e;
    }
  };

  const handleUncomplete = async (entry: DailyEntry) => {
    if (!confirm("改回未完成？")) return;
    try {
      await api.updateDaily(planId, entry.id, {
        status: "planned",
        completed_units: 0,
        score: null,
      });
      load();
    } catch (e) {
      showAppError(e, "操作失败");
    }
  };

  const handlePartial = async (entry: DailyEntry) => {
    const unitsStr = prompt(`完成了多少？（计划 ${entry.planned_units}）`,
      String(entry.completed_units || entry.planned_units));
    if (!unitsStr) return;
    const scoreStr = prompt("评分 (0-10，可留空):");
    const score = scoreStr ? parseFloat(scoreStr) : undefined;
    try {
      await api.completeDaily(planId, entry.id, parseInt(unitsStr, 10), score);
      load();
    } catch (e) {
      showAppError(e, "操作失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除？")) return;
    try {
      await api.deleteDaily(planId, id);
      load();
    } catch (e) {
      showAppError(e, "删除失败");
    }
  };

  const hasHomework = tasks.length > 0;

  return (
    <div className="space-y-6">
      <div className="card flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={() => shiftDate(-1)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-slate-600 active:bg-slate-100"
          aria-label="前一天"
        >
          ‹
        </button>
        <SwipeDateBar value={selectedDate} onChange={setSelectedDate} />
        <button
          type="button"
          onClick={() => shiftDate(1)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-slate-600 active:bg-slate-100"
          aria-label="后一天"
        >
          ›
        </button>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-700">当日课表</h3>
          <button
            type="button"
            onClick={() => setManualFormOpen(true)}
            className="btn-secondary shrink-0 text-xs"
          >
            + 添加
          </button>
        </div>
        {loading ? (
          <p className="py-4 text-center text-slate-500">加载中...</p>
        ) : (
          <>
            <DayScheduleView
              slots={schedule}
              date={selectedDate}
              planId={planId}
              tasks={tasks}
              onUpdated={load}
            />
            <DayManualItems
              items={dayItems}
              date={selectedDate}
              planId={planId}
              tasks={tasks}
              onUpdated={load}
              formOpen={manualFormOpen}
              onFormClose={() => setManualFormOpen(false)}
            />
          </>
        )}
      </div>

      {hasHomework && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">长期作业进度</h2>
              <p className="text-sm text-slate-500">跨多天的作业任务追踪（可选）</p>
            </div>
            <button onClick={openCreate} className="btn-secondary">+ 记录</button>
          </div>

          {entries.length === 0 ? (
            <div className="card py-8 text-center text-sm text-slate-400">今天没有作业进度记录</div>
          ) : (
            <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
              {entries.map((entry) => (
                <div key={entry.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.task?.subject?.color || "#94a3b8" }} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{entry.task?.subject?.name}</span>
                          <span className={`badge ${statusColor[entry.status]}`}>{statusLabel[entry.status]}</span>
                        </div>
                        <h3 className="mt-1 font-semibold">{entry.task?.title}</h3>
                        {entry.planned_description && <p className="mt-1 text-sm text-slate-600">{entry.planned_description}</p>}
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                          <span>计划: {entry.planned_units} {entry.task?.unit_label}</span>
                          <span>完成: {entry.completed_units}</span>
                          {entry.task && <span>总进度: {percent(entry.task.progress_ratio)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button onClick={() => openEdit(entry)} className="btn-secondary text-xs">编辑</button>
                      {(entry.status === "completed" || entry.status === "partial") ? (
                        <button onClick={() => handleUncomplete(entry)} className="btn-secondary text-xs">
                          未完成
                        </button>
                      ) : (
                        <>
                          <button onClick={() => openComplete(entry)} className="btn-primary text-xs">完成</button>
                          <button onClick={() => handlePartial(entry)} className="btn-secondary text-xs">部分完成</button>
                        </>
                      )}
                      <button onClick={() => handleDelete(entry.id)} className="text-xs text-red-400">删除</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <CompleteScoreSheet
        open={showScoreSheet}
        onClose={() => {
          setShowScoreSheet(false);
          setCompletingEntry(null);
        }}
        title={completingEntry ? `完成 · ${completingEntry.task?.title || "作业"}` : "完成"}
        subtitle={completingEntry?.planned_description || undefined}
        onConfirm={handleComplete}
      />

      {showForm && (
        <div className="sheet-backdrop" onClick={() => setShowForm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-scroll">
            <div className="sheet-handle" />
            <h3 className="mb-4 text-lg font-semibold">{editing ? "编辑作业记录" : "记录作业进度"}</h3>
            <div className="space-y-4">
              {!editing && (
                <div>
                  <label className="mb-1 block text-sm text-slate-600">任务</label>
                  <SelectMenu
                    value={form.task_id}
                    options={tasks.map((t) => ({
                      value: t.id,
                      label: `[${t.subject?.name}] ${t.title}`,
                    }))}
                    onChange={(task_id) => setForm({ ...form, task_id })}
                  />
                </div>
              )}
              {editing && (
                <p className="text-sm text-slate-600">
                  [{editing.task?.subject?.name}] {editing.task?.title}
                </p>
              )}
              <div>
                <label className="mb-1 block text-sm text-slate-600">具体内容</label>
                <input className="input" value={form.planned_description}
                  onChange={(e) => setForm({ ...form, planned_description: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">完成量</label>
                <input type="number" min={1} className="input" value={form.planned_units}
                  onChange={(e) => setForm({ ...form, planned_units: Number(e.target.value) })} />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary">取消</button>
              <button onClick={handleSave} className="btn-primary">{editing ? "保存" : "添加"}</button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
