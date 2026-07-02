import { useState } from "react";
import { api, locationOptionLabel } from "../api";
import type { Location } from "../types";
import SelectMenu from "./SelectMenu";

type Props = {
  planId: number;
  locations: Location[];
  value: number;
  onChange: (locationId: number) => void;
  onLocationsChange: (locations: Location[]) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

export default function LocationField({
  planId,
  locations,
  value,
  onChange,
  onLocationsChange,
  allowEmpty = true,
  emptyLabel = "不指定",
}: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const loc = await api.createLocation(planId, {
        name: name.trim(),
        address: address.trim() || undefined,
      });
      onLocationsChange([...locations, loc]);
      onChange(loc.id);
      setName("");
      setAddress("");
      setAdding(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "添加失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <SelectMenu
        value={value}
        options={[
          ...(allowEmpty ? [{ value: 0, label: emptyLabel }] : []),
          ...locations.map((l) => ({ value: l.id, label: locationOptionLabel(l) })),
        ]}
        onChange={onChange}
        placeholder={emptyLabel}
        footer={
          <button
            type="button"
            className="block w-full px-3 py-2.5 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            onClick={() => setAdding(true)}
          >
            + 添加地点
          </button>
        }
      />

      {locations.length === 0 && !adding && (
        <p className="text-sm text-amber-600">
          当前计划还没有上课地点，可在上方列表底部添加，或到「我的 → 上课地点」统一管理。
        </p>
      )}

      {adding && (
        <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
          <input
            className="input"
            placeholder="地点名称，如：少年宫"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="详细地址，如：XX路123号"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={saving}
              onClick={() => {
                setAdding(false);
                setName("");
                setAddress("");
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={saving || !name.trim()}
              onClick={handleAdd}
            >
              {saving ? "保存中..." : "保存地点"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
