import { useCallback, useEffect, useState } from "react";
import { api, COURSE_COLORS } from "../api";
import { usePlan } from "../context/PlanContext";
import type { Subject } from "../types";
import SortableList from "./SortableList";
import SwipeActionRow from "./SwipeActionRow";

export default function SubjectsView({ hideHeader = false }: { hideHeader?: boolean }) {
  const { currentPlanId } = usePlan();
  const planId = currentPlanId!;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [swipeOpenId, setSwipeOpenId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setSubjects(await api.getSubjects(planId));
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
    setName("");
    setColor(COURSE_COLORS[0]);
    setShowForm(true);
  };

  const openEdit = (subject: Subject) => {
    setEditing(subject);
    setName(subject.name);
    setColor(subject.color);
    setShowForm(true);
    setSwipeOpenId(null);
  };

  const handleSave = async () => {
    if (!name.trim() || !planId) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), color };
      if (editing) {
        await api.updateSubject(planId, editing.id, payload);
      } else {
        await api.createSubject(planId, payload);
      }
      setShowForm(false);
      setEditing(null);
      setName("");
      setColor(COURSE_COLORS[0]);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (subject: Subject) => {
    if (
      !confirm(
        `删除作业安排「${subject.name}」？其下所有任务也会一并删除，可在运营后台恢复。`,
      )
    ) {
      return;
    }
    try {
      await api.deleteSubject(planId, subject.id);
      setSwipeOpenId(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleReorder = async (ordered: Subject[]) => {
    const prev = subjects;
    setSubjects(ordered);
    setReordering(true);
    setSwipeOpenId(null);
    try {
      setSubjects(await api.reorderSubjects(planId, ordered.map((s) => s.id)));
    } catch (e) {
      setSubjects(prev);
      alert(e instanceof Error ? e.message : "排序保存失败");
    } finally {
      setReordering(false);
    }
  };

  if (!planId) return null;

  return (
    <div id="plan-subjects" className="space-y-4">
      <div className="flex flex-col gap-3">
        {!hideHeader ? (
          <div>
            <h2 className="text-lg font-semibold">作业安排</h2>
            <p className="mt-1 text-sm text-slate-500">
              自修作业分类；添加课表「自安排」时也会自动创建
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">自修作业分类；添加课表「自安排」时也会自动创建</p>
        )}
        <p className="text-xs text-slate-400">按住左侧 ⋮⋮ 可拖动排序</p>
        <button onClick={openCreate} className={hideHeader ? "btn-secondary w-full text-sm" : "btn-primary w-full"}>
          + 添加作业安排
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">加载中...</div>
      ) : subjects.length === 0 ? (
        <div className="card p-6 text-center text-slate-400">
          <p>还没有作业安排</p>
          <p className="mt-1 text-sm">如：数学、语文、英语</p>
        </div>
      ) : (
        <SortableList
          items={subjects}
          onReorder={handleReorder}
          disabled={reordering}
          className="space-y-2"
          renderItem={(s, dragHandle) => (
            <SwipeActionRow
              className="border border-slate-200/80 bg-white shadow-sm"
              swipeOpen={swipeOpenId === s.id}
              onSwipeOpenChange={(open) => setSwipeOpenId(open ? s.id : null)}
              actions={[
                { label: "修改", onClick: () => openEdit(s) },
                {
                  label: "删除",
                  className: "bg-red-500 active:bg-red-600",
                  onClick: () => handleDelete(s),
                },
              ]}
            >
              <div className="flex w-full min-h-[2.75rem] items-center gap-2 bg-white px-2 py-3 sm:px-4">
                {dragHandle}
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-medium text-slate-800">{s.name}</span>
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
              <h3 className="mb-4 text-lg font-semibold">{editing ? "修改作业安排" : "添加作业安排"}</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">名称</label>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="如：数学、语文"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-600">标识颜色</label>
                  <div className="flex flex-wrap gap-2">
                    {COURSE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-slate-800" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                        aria-label={`颜色 ${c}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button onClick={() => setShowForm(false)} className="btn-secondary" disabled={saving}>
                  取消
                </button>
                <button onClick={handleSave} className="btn-primary" disabled={saving || !name.trim()}>
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
