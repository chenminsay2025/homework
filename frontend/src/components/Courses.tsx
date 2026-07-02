import { useCallback, useEffect, useState } from "react";
import { api, COURSE_COLORS, formatLocationName } from "../api";
import { usePlan } from "../context/PlanContext";
import type { Course, Location } from "../types";
import LocationField from "./LocationField";
import SortableList from "./SortableList";
import SwipeActionRow from "./SwipeActionRow";

const emptyForm = {
  name: "",
  teacher: "",
  phone: "",
  description: "",
  color: COURSE_COLORS[0],
  default_location_id: 0,
  notes: "",
};

export default function CoursesView({ hideHeader = false }: { hideHeader?: boolean }) {
  const { currentPlanId } = usePlan();
  const planId = currentPlanId!;
  const [courses, setCourses] = useState<Course[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [swipeOpenId, setSwipeOpenId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    const [courseList, locList] = await Promise.all([
      api.getCourses(planId),
      api.getLocations(planId),
    ]);
    setCourses(courseList);
    setLocations(locList);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (course: Course) => {
    setEditing(course);
    setForm({
      name: course.name,
      teacher: course.teacher || "",
      phone: course.phone || "",
      description: course.description || "",
      color: course.color,
      default_location_id: course.default_location_id || 0,
      notes: course.notes || "",
    });
    setShowForm(true);
    setSwipeOpenId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !planId) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        teacher: form.teacher.trim() || undefined,
        phone: form.phone.trim() || undefined,
        description: form.description.trim() || undefined,
        color: form.color,
        default_location_id: form.default_location_id || null,
        notes: form.notes.trim() || undefined,
      };
      if (editing) {
        await api.updateCourse(planId, editing.id, payload);
      } else {
        await api.createCourse(planId, payload);
      }
      setShowForm(false);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (course: Course) => {
    if (!confirm(`删除课程「${course.name}」？课表中对应时段将保留名称但解除关联。`)) return;
    await api.deleteCourse(planId, course.id);
    setSwipeOpenId(null);
    load();
  };

  const handleReorder = async (ordered: Course[]) => {
    const prev = courses;
    setCourses(ordered);
    setReordering(true);
    setSwipeOpenId(null);
    try {
      setCourses(await api.reorderCourses(planId, ordered.map((c) => c.id)));
    } catch (e) {
      setCourses(prev);
      alert(e instanceof Error ? e.message : "排序保存失败");
    } finally {
      setReordering(false);
    }
  };

  if (!planId) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        {!hideHeader ? (
          <div>
            <h2 className="text-lg font-semibold">课程管理</h2>
            <p className="mt-1 text-sm text-slate-500">
              设置培训班课程；默认地点需先在「上课地点」或下方添加
            </p>
          </div>
        ) : null}
        <p className="text-xs text-slate-400">按住左侧 ⋮⋮ 可拖动排序</p>
        <button onClick={openCreate} className={hideHeader ? "btn-secondary w-full text-sm" : "btn-primary w-full"}>
          + 添加课程
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">加载中...</div>
      ) : courses.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          <p>还没有课程</p>
          <p className="mt-1 text-sm">先添加数学、英语等培训班课程</p>
        </div>
      ) : (
        <SortableList
          items={courses}
          onReorder={handleReorder}
          disabled={reordering}
          className="space-y-2"
          renderItem={(course, dragHandle) => (
            <SwipeActionRow
              className="border border-slate-200/80 bg-white shadow-sm"
              swipeOpen={swipeOpenId === course.id}
              onSwipeOpenChange={(open) => setSwipeOpenId(open ? course.id : null)}
              actions={[
                { label: "修改", onClick: () => openEdit(course) },
                {
                  label: "删除",
                  className: "bg-red-500 active:bg-red-600",
                  onClick: () => handleDelete(course),
                },
              ]}
            >
              <div className="min-h-[2.75rem] w-full bg-white p-4 pl-2 sm:pl-4">
                <div className="flex items-start gap-2">
                  {dragHandle}
                  <span
                    className="mt-1 h-10 w-10 shrink-0 rounded-xl"
                    style={{ backgroundColor: course.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{course.name}</h3>
                      {course.slot_count > 0 && (
                        <span className="badge bg-slate-100 text-slate-500">
                          {course.slot_count} 个时段
                        </span>
                      )}
                    </div>
                    {course.teacher && (
                      <p className="mt-1 text-sm text-slate-600">老师：{course.teacher}</p>
                    )}
                    {course.phone && (
                      <p className="text-sm text-slate-500">{course.phone}</p>
                    )}
                    {course.default_location && (
                      <p className="mt-1 text-sm text-slate-500">
                        默认地点：{formatLocationName(course.default_location)}
                      </p>
                    )}
                    {course.description && (
                      <p className="mt-1 text-sm text-slate-400">{course.description}</p>
                    )}
                  </div>
                </div>
              </div>
            </SwipeActionRow>
          )}
        />
      )}

      {showForm && (
        <div className="sheet-backdrop" onClick={() => setShowForm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-scroll">
            <div className="sheet-handle" />
            <h3 className="mb-4 text-lg font-semibold">
              {editing ? "编辑课程" : "添加课程"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-600">课程名称</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：数学提高班"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">任课老师</label>
                <input
                  className="input"
                  value={form.teacher}
                  onChange={(e) => setForm({ ...form, teacher: e.target.value })}
                  placeholder="选填"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">联系电话</label>
                <input
                  className="input"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="选填"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">默认上课地点</label>
                <LocationField
                  planId={planId}
                  locations={locations}
                  value={form.default_location_id}
                  onChange={(id) => setForm({ ...form, default_location_id: id })}
                  onLocationsChange={setLocations}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-600">标识颜色</label>
                <div className="flex flex-wrap gap-2">
                  {COURSE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`h-9 w-9 rounded-full border-2 transition ${
                        form.color === c ? "border-slate-800 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">课程说明</label>
                <input
                  className="input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="如：暑假一期班"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">备注</label>
                <input
                  className="input"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="选填"
                />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary" disabled={saving}>
                取消
              </button>
              <button
                onClick={handleSave}
                className="btn-primary"
                disabled={saving || !form.name.trim()}
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
