import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api, WEEKDAYS } from "../api";
import { usePlan } from "../context/PlanContext";
import type { Course, Location, ScheduleSlot, Subject, Task } from "../types";
import { showAppError } from "../utils/appMessage";
import LocationField from "./LocationField";
import SelectMenu from "./SelectMenu";
import TaskPicker from "./TaskPicker";
import { TimePickerField } from "./TimePickerSheet";
import WeeklyScheduleGrid, {
  getTodayWeekday,
  LandscapeScheduleOverlay,
  ScheduleSlotRow,
} from "./WeeklyScheduleGrid";

type ViewMode = "list" | "grid";
const VIEW_KEY = "homework_schedule_view";

type SlotForm = {
  weekdays: number[];
  start_time: string;
  end_time: string;
  course_id: number;
  subject_activity: string;
  location_id: number;
  is_all_day: boolean;
  slot_type: "class" | "self_study";
  default_task_id: number;
};

const defaultForm = (): SlotForm => ({
  weekdays: [0],
  start_time: "08:30",
  end_time: "10:00",
  course_id: 0,
  subject_activity: "自安排",
  location_id: 0,
  is_all_day: false,
  slot_type: "self_study",
  default_task_id: 0,
});

function slotToForm(slot: ScheduleSlot, courses: Course[]): SlotForm {
  const isClass = slot.slot_type === "class";
  const courseId =
    slot.course_id ||
    slot.course?.id ||
    courses.find((c) => c.name === slot.activity)?.id ||
    0;
  return {
    weekdays: [slot.weekday],
    start_time: slot.start_time?.slice(0, 5) || "08:30",
    end_time: slot.end_time?.slice(0, 5) || "10:00",
    course_id: courseId,
    subject_activity: isClass ? "自安排" : slot.activity,
    location_id: slot.location_id || slot.course?.default_location_id || 0,
    is_all_day: slot.is_all_day,
    slot_type: slot.slot_type,
    default_task_id: slot.default_task_id || slot.default_task?.id || 0,
  };
}

function tasksForSubject(tasks: Task[], activity: string): Task[] {
  if (activity === "自安排") return tasks;
  return tasks.filter((t) => t.subject?.name === activity);
}

function defaultLocationForActivity(
  activity: string,
  courses: Course[],
  current: number,
): number {
  const course = courses.find((c) => c.name === activity);
  return course?.default_location_id || current;
}

/** 编辑时判断其它天的时段是否与当前表单为同一门课/同一安排 */
function formMatchesSlot(form: SlotForm, slot: ScheduleSlot, courses: Course[]): boolean {
  const isClass = form.slot_type === "class";
  const selectedCourse = courses.find((c) => c.id === form.course_id);
  const activity = isClass ? selectedCourse?.name || "" : form.subject_activity;

  if (slot.slot_type !== form.slot_type) return false;
  if (slot.activity !== activity) return false;
  if (isClass && (slot.course_id || 0) !== form.course_id) return false;
  if (slot.is_all_day !== form.is_all_day) return false;
  if (!form.is_all_day) {
    if ((slot.start_time?.slice(0, 5) || "") !== form.start_time) return false;
    if ((slot.end_time?.slice(0, 5) || "") !== form.end_time) return false;
    if ((slot.location_id || 0) !== (form.location_id || 0)) return false;
  }
  if (!isClass && (slot.default_task_id || 0) !== (form.default_task_id || 0)) return false;
  return true;
}

function relatedWeekdaysForEdit(
  slots: ScheduleSlot[],
  editingSlot: ScheduleSlot,
  form: SlotForm,
  courses: Course[],
): number[] {
  return [
    ...new Set(
      slots
        .filter((s) => s.id !== editingSlot.id && formMatchesSlot(form, s, courses))
        .map((s) => s.weekday),
    ),
  ];
}

export default function WeeklyScheduleView() {
  const { currentPlanId } = usePlan();
  const planId = currentPlanId!;
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_KEY) as ViewMode) || "grid",
  );
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);
  const [form, setForm] = useState<SlotForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [swipeOpenId, setSwipeOpenId] = useState<number | null>(null);
  const [landscapeOpen, setLandscapeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const [slotList, locList, courseList, subjectList, taskList] = await Promise.all([
        api.getSchedule(planId),
        api.getLocations(planId),
        api.getCourses(planId, true).catch(() => [] as Course[]),
        api.getSubjects(planId).catch(() => [] as Subject[]),
        api.getTasks(planId).catch(() => [] as Task[]),
      ]);
      setSlots(slotList);
      setLocations(locList);
      setCourses(courseList);
      setSubjects(subjectList);
      setTasks(taskList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  const refreshFormOptions = useCallback(async () => {
    if (!planId) return { courses: [] as Course[], subjects: [] as Subject[], tasks: [] as Task[] };
    const [locList, courseList, subjectList, taskList] = await Promise.all([
      api.getLocations(planId),
      api.getCourses(planId, true).catch(() => [] as Course[]),
      api.getSubjects(planId).catch(() => [] as Subject[]),
      api.getTasks(planId).catch(() => [] as Task[]),
    ]);
    setLocations(locList);
    setCourses(courseList);
    setSubjects(subjectList);
    setTasks(taskList);
    return { courses: courseList, subjects: subjectList, tasks: taskList };
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => {
    setShowForm(false);
    setEditingSlot(null);
    setForm(defaultForm());
  };

  const openCreate = async () => {
    setEditingSlot(null);
    setForm(defaultForm());
    await refreshFormOptions();
    setShowForm(true);
  };

  const openEdit = async (slot: ScheduleSlot) => {
    const { courses: courseList } = await refreshFormOptions();
    setEditingSlot(slot);
    setForm(slotToForm(slot, courseList));
    setShowForm(true);
  };

  const buildPayload = (weekday: number) => {
    const isClass = form.slot_type === "class";
    const selectedCourse = courses.find((c) => c.id === form.course_id);
    const activity = isClass ? selectedCourse?.name || "" : form.subject_activity;
    const isAllDay = editingSlot?.is_all_day ?? false;
    return {
      weekday,
      start_time: isAllDay ? null : form.start_time,
      end_time: isAllDay ? null : form.end_time,
      activity,
      course_id: isClass && form.course_id ? form.course_id : null,
      location_id: isAllDay ? null : form.location_id || null,
      is_all_day: isAllDay,
      slot_type: form.slot_type,
      default_task_id:
        !isClass && form.default_task_id > 0 ? form.default_task_id : null,
    };
  };

  const toggleWeekday = (day: number) => {
    if (editingSlot) {
      setForm((prev) => ({ ...prev, weekdays: [day] }));
      return;
    }
    setForm((prev) => {
      const selected = prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day].sort((a, b) => a - b);
      return { ...prev, weekdays: selected };
    });
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    const weekdays = [...new Set(form.weekdays)];
    if (weekdays.length === 0) return;
    const sample = buildPayload(weekdays[0]);
    if (!sample.activity) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (editingSlot) {
        await api.updateScheduleSlot(planId, editingSlot.id, buildPayload(weekdays[0]));
      } else {
        for (const weekday of weekdays) {
          await api.createScheduleSlot(planId, buildPayload(weekday));
        }
      }
      closeForm();
      load();
    } catch (e) {
      showAppError(e, "保存失败");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, options?: { skipConfirm?: boolean }) => {
    if (!options?.skipConfirm && !confirm("确定删除这个时段？")) return;
    await api.deleteScheduleSlot(planId, id);
    if (editingSlot?.id === id) closeForm();
    setSwipeOpenId(null);
    load();
  };

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

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  };

  const showTimeAndLocation = !form.is_all_day || !!editingSlot;

  const editingPrimaryWeekday = editingSlot?.weekday ?? null;
  const editingRelatedWeekdays =
    editingSlot && editingPrimaryWeekday !== null
      ? relatedWeekdaysForEdit(slots, editingSlot, form, courses)
      : [];

  const byDay = WEEKDAYS.map((day) => ({
    ...day,
    slots: slots
      .filter((s) => s.weekday === day.value)
      .sort((a, b) => a.sort_order - b.sort_order || (a.start_time || "").localeCompare(b.start_time || "")),
  }));
  const today = getTodayWeekday();

  if (!planId) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">周课表</h2>
          </div>
          <div className="flex shrink-0 rounded-xl bg-slate-200/80 p-0.5">
            <button
              type="button"
              onClick={() => switchView("grid")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "grid" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"
              }`}
            >
              表格
            </button>
            <button
              type="button"
              onClick={() => switchView("list")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                viewMode === "list" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600"
              }`}
            >
              列表
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">加载中...</div>
      ) : viewMode === "grid" ? (
        <WeeklyScheduleGrid
          slots={slots}
          onEdit={openEdit}
          onLandscapeOpen={() => setLandscapeOpen(true)}
          onAdd={openCreate}
        />
      ) : (
        <div className="space-y-4">
          {byDay.map((day) => {
            const isToday = day.value === today;
            return (
              <div
                key={day.value}
                className={`card overflow-hidden${isToday ? " ring-1 ring-indigo-200" : ""}`}
              >
                <div
                  className={`border-b px-4 py-2.5 font-semibold ${
                    isToday
                      ? "schedule-grid-today-head border-indigo-100 text-indigo-800"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {day.label}
                  {isToday && (
                    <span className="ml-1.5 text-xs font-normal text-indigo-500">今天</span>
                  )}
                </div>
                {day.slots.length === 0 ? (
                  <p
                    className={`px-4 py-6 text-center text-sm ${
                      isToday ? "schedule-grid-today-cell text-slate-500" : "text-slate-400"
                    }`}
                  >
                    无安排
                  </p>
                ) : (
                  <div className={isToday ? "schedule-list-today-body" : "divide-y divide-slate-200"}>
                    {day.slots.map((s) => (
                      <ScheduleSlotRow
                        key={s.id}
                        slot={s}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        swipeOpen={swipeOpenId === s.id}
                        onSwipeOpenChange={(open) => setSwipeOpenId(open ? s.id : null)}
                        highlightToday={isToday}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" onClick={openCreate} className="btn-primary w-full">
            + 添加时段
          </button>
        </div>
      )}

      {landscapeOpen && (
        <LandscapeScheduleOverlay
          slots={slots}
          onEdit={(slot) => {
            setLandscapeOpen(false);
            void openEdit(slot);
          }}
          onClose={() => setLandscapeOpen(false)}
        />
      )}

      {showForm && (
        <div className="sheet-backdrop" onClick={closeForm}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-scroll">
            <div className="sheet-handle" />
            <h3 className="mb-4 text-lg font-semibold">{editingSlot ? "编辑时段" : "添加时段"}</h3>
            <div className="space-y-4">
              <Field label={editingSlot ? "星期" : "星期（可多选）"}>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d) => {
                    const isPrimary = editingSlot
                      ? d.value === editingPrimaryWeekday
                      : form.weekdays.includes(d.value);
                    const isRelated =
                      editingSlot &&
                      !isPrimary &&
                      editingRelatedWeekdays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleWeekday(d.value)}
                        className={`min-w-[2.75rem] rounded-lg px-2.5 py-1.5 text-sm font-medium transition active:scale-95 ${
                          isPrimary
                            ? "bg-indigo-600 text-white"
                            : isRelated
                              ? "bg-indigo-100 text-indigo-700 ring-1 ring-inset ring-indigo-300"
                              : "bg-slate-100 text-slate-600 active:bg-slate-200"
                        }`}
                      >
                        {d.label.replace("周", "")}
                      </button>
                    );
                  })}
                </div>
                {form.weekdays.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">请至少选择一天</p>
                )}
              </Field>

              {showTimeAndLocation && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="开始">
                    <TimePickerField
                      value={form.start_time}
                      onChange={(start_time) => setForm({ ...form, start_time })}
                      title="开始时间"
                    />
                  </Field>
                  <Field label="结束">
                    <TimePickerField
                      value={form.end_time}
                      onChange={(end_time) => setForm({ ...form, end_time })}
                      title="结束时间"
                    />
                  </Field>
                </div>
              )}

              <Field label="类型">
                <SelectMenu
                  value={form.slot_type}
                  options={[
                    { value: "class" as const, label: "培训班（仅课表，无需详细计划）" },
                    { value: "self_study" as const, label: "自安排（需每日详细计划）" },
                  ]}
                  onChange={(slot_type) => {
                    setForm((prev) => {
                      const course_id =
                        slot_type === "class" ? prev.course_id || courses[0]?.id || 0 : 0;
                      const subject_activity =
                        slot_type === "self_study"
                          ? prev.subject_activity !== "自安排"
                            ? prev.subject_activity
                            : subjects[0]?.name || "自安排"
                          : "自安排";
                      const activity =
                        slot_type === "class"
                          ? courses.find((c) => c.id === course_id)?.name || ""
                          : subject_activity;
                      return {
                        ...prev,
                        slot_type,
                        course_id,
                        subject_activity,
                        location_id: defaultLocationForActivity(activity, courses, prev.location_id),
                      };
                    });
                  }}
                />
              </Field>

              {form.slot_type === "class" ? (
                <Field label="培训班课程">
                  {courses.length === 0 ? (
                    <p className="text-sm text-amber-600">请先在「我的 → 课程管理」添加培训班课程</p>
                  ) : (
                    <SelectMenu
                      value={form.course_id}
                      options={courses.map((c) => ({ value: c.id, label: c.name }))}
                      onChange={(course_id) => {
                        const course = courses.find((c) => c.id === course_id);
                        setForm((prev) => ({
                          ...prev,
                          course_id,
                          location_id: course?.default_location_id || prev.location_id,
                        }));
                      }}
                    />
                  )}
                </Field>
              ) : (
                <>
                  <Field label="作业安排">
                    <SelectMenu
                      value={form.subject_activity}
                      options={[
                        { value: "自安排", label: "自安排（通用）" },
                        ...subjects.map((s) => ({ value: s.name, label: s.name })),
                      ]}
                      onChange={(subject_activity) => {
                        const filtered = tasksForSubject(tasks, subject_activity);
                        setForm((prev) => ({
                          ...prev,
                          subject_activity,
                          default_task_id: filtered.some((t) => t.id === prev.default_task_id)
                            ? prev.default_task_id
                            : 0,
                          location_id: defaultLocationForActivity(
                            subject_activity,
                            courses,
                            prev.location_id,
                          ),
                        }));
                      }}
                      placeholder="选择作业安排"
                    />
                    {subjects.length === 0 && (
                      <p className="mt-1.5 text-xs text-amber-600">
                        可到「我的 → 作业安排」添加数学、语文等
                      </p>
                    )}
                  </Field>
                  <Field label="默认任务（可选）">
                    {tasksForSubject(tasks, form.subject_activity).length === 0 ? (
                      <p className="text-sm text-slate-400">该科目下暂无任务，可不选</p>
                    ) : (
                      <TaskPicker
                        variant="dropdown"
                        allowNone
                        tasks={tasksForSubject(tasks, form.subject_activity)}
                        value={form.default_task_id}
                        onChange={(id) => setForm((prev) => ({ ...prev, default_task_id: id }))}
                        placeholder="不指定"
                      />
                    )}
                    <p className="mt-1.5 text-xs text-slate-400">
                      选定后，每日页该时段将自动显示此任务；也可留空，当日再选
                    </p>
                  </Field>
                </>
              )}

              {showTimeAndLocation && (
                <Field label="地点">
                  <LocationField
                    planId={planId}
                    locations={locations}
                    value={form.location_id}
                    onChange={(id) => setForm({ ...form, location_id: id })}
                    onLocationsChange={setLocations}
                  />
                </Field>
              )}
            </div>
            <div className="mt-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={closeForm} className="btn-secondary" disabled={saving}>
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-primary"
                  disabled={
                    saving ||
                    form.weekdays.length === 0 ||
                    (form.slot_type === "class" && !form.course_id)
                  }
                >
                  {saving
                    ? "保存中..."
                    : editingSlot
                      ? "保存"
                      : form.weekdays.length > 1
                        ? `添加 ${form.weekdays.length} 天`
                        : "确定"}
                </button>
              </div>
              {editingSlot && (
                <button
                  type="button"
                  className="btn-secondary w-full text-red-500"
                  disabled={saving}
                  onClick={() => handleDelete(editingSlot.id)}
                >
                  删除此时段
                </button>
              )}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-slate-600">{label}</label>
      {children}
    </div>
  );
}
