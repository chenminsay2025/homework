import { useCallback, useEffect, useState } from "react";
import { api, formatLocationName } from "../api";
import { usePlan } from "../context/PlanContext";
import type { Location } from "../types";

const emptyForm = { name: "", address: "" };

export default function LocationsView({ hideHeader = false }: { hideHeader?: boolean }) {
  const { currentPlanId } = usePlan();
  const planId = currentPlanId!;
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    const list = await api.getLocations(planId);
    setLocations(list);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (loc: Location) => {
    setEditing(loc);
    setForm({ name: loc.name, address: loc.address || "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !planId) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
      };
      if (editing) {
        await api.updateLocation(planId, editing.id, payload);
      } else {
        await api.createLocation(planId, {
          name: payload.name,
          address: payload.address || undefined,
        });
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (loc: Location) => {
    if (!confirm(`删除地点「${loc.name}」？课表中引用该地点的时段将变为未指定。`)) return;
    await api.deleteLocation(planId, loc.id);
    load();
  };

  if (!planId) return null;

  return (
    <div id="plan-locations" className="space-y-4">
      <div className="flex flex-col gap-3">
        {!hideHeader ? (
          <div>
            <h2 className="text-lg font-semibold">上课地点</h2>
            <p className="mt-1 text-sm text-slate-500">
              在此统一管理本计划的所有上课地址，课程和课表会从这里选用
            </p>
          </div>
        ) : null}
        <button onClick={openCreate} className={hideHeader ? "btn-secondary w-full text-sm" : "btn-primary w-full"}>
          + 添加地点
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500">加载中...</div>
      ) : locations.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          <p>还没有上课地点</p>
          <p className="mt-1 text-sm">如：少年宫、培训机构、家</p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div key={loc.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">📍</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-800">{loc.name}</h3>
                  {loc.address ? (
                    <p className="mt-1 text-sm text-slate-600">{loc.address}</p>
                  ) : (
                    <p className="mt-1 text-sm text-amber-600">未填写地址，点编辑补充</p>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => openEdit(loc)} className="btn-secondary text-sm">
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(loc)}
                  className="btn-secondary text-sm text-red-500"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="sheet-backdrop" onClick={() => setShowForm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-scroll">
            <div className="sheet-handle" />
            <h3 className="mb-4 text-lg font-semibold">
              {editing ? "编辑地点" : "添加地点"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-600">地点名称</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：少年宫、XX英语培训"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">详细地址</label>
                <input
                  className="input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="如：XX路123号 301教室"
                />
              </div>
              {editing && (
                <p className="text-xs text-slate-400">
                  预览：{formatLocationName({ name: form.name || "地点", address: form.address || null })}
                </p>
              )}
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
