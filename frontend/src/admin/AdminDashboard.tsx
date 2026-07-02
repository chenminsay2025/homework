import { useEffect, useState } from "react";
import { api } from "../api";
import type { AdminStats } from "../types";

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    api.adminGetStats().then(setStats);
  }, []);

  if (!stats) return <div className="text-slate-500">加载中...</div>;

  const cards = [
    { label: "注册用户", value: stats.user_count },
    { label: "活跃用户", value: stats.active_user_count },
    { label: "计划总数", value: stats.plan_count },
    { label: "任务总数", value: stats.task_count },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800">数据概览</h2>
      <div className="mt-4 grid grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-indigo-600">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
