import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { DeletedRecord } from "../types";

const ENTITY_FILTERS = [
  { value: "", label: "全部类型" },
  { value: "plan", label: "计划" },
  { value: "task", label: "任务" },
  { value: "schedule_slot", label: "课表时段" },
  { value: "location", label: "地点" },
  { value: "course", label: "课程" },
  { value: "subject", label: "作业安排" },
  { value: "slot_daily_plan", label: "时段计划" },
  { value: "schedule_exception", label: "调课记录" },
  { value: "daily_entry", label: "每日记录" },
  { value: "day_manual_item", label: "补充安排" },
];

function formatDateTime(value: string) {
  const d = new Date(value);
  return d.toLocaleString("zh-CN", { hour12: false });
}

function daysLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default function AdminTrash() {
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [retentionDays, setRetentionDays] = useState(15);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, settings] = await Promise.all([
        api.adminGetDeleted(filter || undefined),
        api.adminGetSettings(),
      ]);
      setRecords(rows);
      setRetentionDays(settings.delete_retention_days);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      alert(
        msg.includes("Not Found")
          ? "删除记录 API 不可用：请重启后端（scripts\\kill-backend.bat 8002 后重新 start.bat），并确认 http://localhost:8002/api/health 的 features 含 deleted-records。"
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRestore = async (row: DeletedRecord) => {
    if (!confirm(`恢复「${row.display_title}」（${row.entity_type_label}）？`)) return;
    try {
      await api.adminRestoreDeleted(row.id);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "恢复失败");
    }
  };

  const handlePurge = async (row: DeletedRecord) => {
    if (!confirm(`永久清除「${row.display_title}」的删除记录？清除后无法恢复。`)) return;
    await api.adminPurgeDeleted(row.id);
    load();
  };

  if (loading) return <div className="text-slate-500">加载中...</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800">删除记录</h2>
      <p className="mt-1 text-sm text-slate-500">
        用户每次删除操作单独留存，默认保留 {retentionDays} 天，可在
        <Link to="/admin/settings" className="mx-1 text-indigo-600 hover:underline">
          系统设置
        </Link>
        中调整。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          className="input max-w-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {ENTITY_FILTERS.map((item) => (
            <option key={item.value || "all"} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn-secondary" onClick={load}>
          刷新
        </button>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-slate-100 text-slate-500">
            <tr>
              <th className="p-3">类型</th>
              <th className="p-3">名称</th>
              <th className="p-3">用户</th>
              <th className="p-3">计划 ID</th>
              <th className="p-3">删除时间</th>
              <th className="p-3">操作人</th>
              <th className="p-3">剩余天数</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-400">
                  暂无未过期的删除记录
                </td>
              </tr>
            ) : (
              records.map((row) => (
                <tr key={row.id} className="border-b border-slate-50">
                  <td className="p-3">{row.entity_type_label}</td>
                  <td className="p-3 font-medium">{row.display_title}</td>
                  <td className="p-3">
                    {row.display_name}
                    <Link to={`/admin/users/${row.user_id}`} className="ml-1 text-indigo-600 hover:underline">
                      @{row.username}
                    </Link>
                  </td>
                  <td className="p-3">{row.plan_id ?? "—"}</td>
                  <td className="p-3">{formatDateTime(row.deleted_at)}</td>
                  <td className="p-3">{row.deleted_by_username ? `@${row.deleted_by_username}` : "—"}</td>
                  <td className="p-3">{daysLeft(row.expires_at)} 天</td>
                  <td className="p-3 space-x-3 whitespace-nowrap">
                    <button type="button" className="text-indigo-600" onClick={() => handleRestore(row)}>
                      恢复
                    </button>
                    <button type="button" className="text-red-600" onClick={() => handlePurge(row)}>
                      清除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
