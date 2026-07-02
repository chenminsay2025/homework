import { useEffect, useState } from "react";
import { api } from "../api";
import type { AdminSettings } from "../types";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [maxMb, setMaxMb] = useState(100);
  const [retentionDays, setRetentionDays] = useState(15);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.adminGetSettings().then((data) => {
      setSettings(data);
      setMaxMb(data.upload_max_mb);
      setRetentionDays(data.delete_retention_days);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const data = await api.adminUpdateSettings({
        upload_max_mb: maxMb,
        delete_retention_days: retentionDays,
      });
      setSettings(data);
      setMaxMb(data.upload_max_mb);
      setRetentionDays(data.delete_retention_days);
      setSaved(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="text-slate-500">加载中...</div>;

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold text-slate-800">系统设置</h2>
      <p className="mt-1 text-sm text-slate-500">配置全局参数，修改后立即对用户端生效。</p>

      <div className="card mt-6 space-y-4 p-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">附件上传大小限制（MB）</label>
          <input
            type="number"
            min={1}
            max={500}
            className="input max-w-xs"
            value={maxMb}
            onChange={(e) => {
              setMaxMb(Number(e.target.value));
              setSaved(false);
            }}
          />
          <p className="mt-2 text-xs text-slate-400">
            当前限制 {settings.upload_max_mb}MB，可设置 1–500MB，默认 100MB。
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">删除记录保留天数</label>
          <input
            type="number"
            min={1}
            max={365}
            className="input max-w-xs"
            value={retentionDays}
            onChange={(e) => {
              setRetentionDays(Number(e.target.value));
              setSaved(false);
            }}
          />
          <p className="mt-2 text-xs text-slate-400">
            当前保留 {settings.delete_retention_days} 天，可设置 1–365 天，默认 15 天。过期后自动清除，无法恢复。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={
              saving ||
              maxMb < 1 ||
              maxMb > 500 ||
              retentionDays < 1 ||
              retentionDays > 365
            }
          >
            {saving ? "保存中..." : "保存设置"}
          </button>
          {saved && <span className="text-sm text-green-600">已保存</span>}
        </div>
      </div>
    </div>
  );
}
