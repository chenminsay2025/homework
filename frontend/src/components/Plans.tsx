import { useEffect, useRef, useState } from "react";
import { api, buildWeeklyTemplatePayload } from "../api";
import { usePlan } from "../context/PlanContext";
import type { Plan } from "../types";

function PlanMoreMenu({
  plan,
  isCurrent,
  onSwitch,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  plan: Plan;
  isCurrent: boolean;
  onSwitch: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={`${plan.name} 更多操作`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-slate-500 active:bg-slate-100"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[8.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {!isCurrent && (
            <button
              type="button"
              className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 active:bg-slate-50"
              onClick={() => run(onSwitch)}
            >
              切换为当前
            </button>
          )}
          <button
            type="button"
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 active:bg-slate-50"
            onClick={() => run(onEdit)}
          >
            编辑
          </button>
          <button
            type="button"
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 active:bg-slate-50"
            onClick={() => run(onDuplicate)}
          >
            复制
          </button>
          <button
            type="button"
            className="block w-full px-4 py-2.5 text-left text-sm text-red-600 active:bg-red-50"
            onClick={() => run(onDelete)}
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
}

export default function PlansView({ hideHeader = false }: { hideHeader?: boolean }) {
  const { plans, currentPlanId, setCurrentPlanId, refreshPlans } = usePlan();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCreateBlank = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const plan = await api.createPlan({ name, description: description || undefined });
      await refreshPlans();
      setCurrentPlanId(plan.id);
      setShowCreate(false);
      setName("");
      setDescription("");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFromTemplate = async () => {
    const planName = name.trim() || "暑假周课表";
    setCreating(true);
    try {
      const plan = await api.createPlanFromTemplate(
        buildWeeklyTemplatePayload(planName, description || "周一至周六分时段，周日全天自安排")
      );
      await refreshPlans();
      setCurrentPlanId(plan.id);
      setShowCreate(false);
      setName("");
      setDescription("");
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    const plan = await api.duplicatePlan(id);
    await refreshPlans();
    setCurrentPlanId(plan.id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("删除计划将清除所有课表和作业数据，确定？")) return;
    await api.deletePlan(id);
    await refreshPlans();
  };

  const openEdit = (plan: (typeof plans)[0]) => {
    setEditingPlanId(plan.id);
    setName(plan.name);
    setDescription(plan.description || "");
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPlanId || !name.trim()) return;
    setSaving(true);
    try {
      await api.updatePlan(editingPlanId, {
        name: name.trim(),
        description: description.trim() || null,
      });
      await refreshPlans();
      setShowEdit(false);
      setEditingPlanId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        {!hideHeader ? (
          <div>
            <h2 className="text-lg font-semibold">我的计划</h2>
            <p className="mt-1 text-sm text-slate-500">可创建多个独立计划</p>
          </div>
        ) : null}
        <button onClick={() => setShowCreate(true)} className={hideHeader ? "btn-secondary w-full text-sm" : "btn-primary w-full"}>
          + 新建计划
        </button>
      </div>

      <div className="space-y-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`card p-4 transition ${
              plan.id === currentPlanId ? "ring-2 ring-indigo-400" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{plan.name}</h3>
                  {plan.id === currentPlanId && (
                    <span className="badge bg-indigo-50 text-indigo-700">当前</span>
                  )}
                </div>
                {plan.description && (
                  <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  {plan.slot_count} 个时段 · {plan.task_count} 项作业
                  {plan.deadline && ` · 截止 ${plan.deadline}`}
                </p>
              </div>
              <PlanMoreMenu
                plan={plan}
                isCurrent={plan.id === currentPlanId}
                onSwitch={() => setCurrentPlanId(plan.id)}
                onEdit={() => openEdit(plan)}
                onDuplicate={() => handleDuplicate(plan.id)}
                onDelete={() => handleDelete(plan.id)}
              />
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="sheet-backdrop" onClick={() => setShowCreate(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-scroll">
            <div className="sheet-handle" />
            <h3 className="mb-4 text-lg font-semibold">新建计划</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-600">计划名称</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="如：暑假周课表" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">说明（可选）</label>
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 space-y-2">
              <button
                onClick={handleCreateFromTemplate}
                disabled={creating}
                className="btn-primary w-full"
              >
                从周课表模板创建
              </button>
              <p className="text-center text-xs text-slate-400">
                自动填入你提供的周一~周日时段安排
              </p>
              <button
                onClick={handleCreateBlank}
                disabled={creating || !name.trim()}
                className="btn-secondary w-full"
              >
                创建空白计划
              </button>
              <button onClick={() => setShowCreate(false)} className="btn-secondary w-full">
                取消
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="sheet-backdrop" onClick={() => setShowEdit(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-scroll">
            <div className="sheet-handle" />
            <h3 className="mb-4 text-lg font-semibold">编辑计划</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-600">计划名称</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">说明（可选）</label>
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setShowEdit(false)} className="btn-secondary" disabled={saving}>
                取消
              </button>
              <button onClick={handleSaveEdit} className="btn-primary" disabled={saving || !name.trim()}>
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
