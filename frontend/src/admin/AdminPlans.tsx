import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { AdminPlan } from "../types";

export default function AdminPlans() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setPlans(await api.adminGetPlans());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (p: AdminPlan) => {
    if (!confirm(`删除计划「${p.name}」（用户：${p.display_name}）？可在删除记录中恢复（默认保留 15 天）。`)) return;
    await api.adminDeletePlan(p.id);
    load();
  };

  if (loading) return <div className="text-slate-500">加载中...</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800">全站计划</h2>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-100 text-slate-500">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">计划名</th>
              <th className="p-3">用户</th>
              <th className="p-3">时段</th>
              <th className="p-3">任务</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="p-3">{p.id}</td>
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">
                  {p.display_name}
                  <Link to={`/admin/users/${p.user_id}`} className="ml-1 text-indigo-600 hover:underline">
                    @{p.username}
                  </Link>
                </td>
                <td className="p-3">{p.slot_count}</td>
                <td className="p-3">{p.task_count}</td>
                <td className="p-3 space-x-3">
                  <Link to={`/admin/plans/${p.id}`} className="text-indigo-600 hover:underline">
                    查看
                  </Link>
                  <button type="button" className="text-red-600" onClick={() => handleDelete(p)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
