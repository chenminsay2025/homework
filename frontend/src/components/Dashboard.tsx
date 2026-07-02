import { useEffect, useState } from "react";
import { api, formatDisplayDate, percent } from "../api";
import { usePlan } from "../context/PlanContext";
import type { Dashboard } from "../types";
import DayScheduleView from "./DayScheduleView";

export default function DashboardView({ onGoDaily }: { onGoDaily: () => void }) {
  const { currentPlanId } = usePlan();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentPlanId) return;
    setLoading(true);
    api.getDashboard(currentPlanId).then(setData).finally(() => setLoading(false));
  }, [currentPlanId]);

  if (!currentPlanId) return <div className="p-8 text-center text-slate-500">请先选择或创建计划</div>;
  if (loading) return <div className="p-8 text-center text-slate-500">加载中...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">加载失败</div>;

  const doneToday = data.today_entries.filter((e) => e.status === "completed").length;
  const totalToday = data.today_entries.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="card p-6">
          <p className="text-sm text-slate-500">总体进度</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{percent(data.overall_progress)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${data.overall_progress * 100}%` }} />
          </div>
        </div>
        <div className="card p-6">
          <p className="text-sm text-slate-500">今日作业</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">
            {doneToday} <span className="text-lg font-normal text-slate-400">/ {totalToday}</span>
          </p>
          <button onClick={onGoDaily} className="btn-primary mt-3 w-full">去安排今日</button>
        </div>
        <div className="card p-6">
          <p className="text-sm text-slate-500">距离截止</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">
            {data.days_remaining !== null ? (
              <>{data.days_remaining}<span className="text-lg font-normal text-slate-400"> 天</span></>
            ) : "未设置"}
          </p>
          {data.deadline && (
            <p className="mt-2 text-sm text-slate-500">截止 {formatDisplayDate(data.deadline)}</p>
          )}
        </div>
      </div>

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold">今日课表 · {formatDisplayDate(data.today)}</h2>
        {currentPlanId && (
          <DayScheduleView
            slots={data.today_schedule}
            date={data.today}
            planId={currentPlanId}
          />
        )}
      </div>

      {data.subject_progress.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold">各科进度</h2>
          <div className="space-y-4">
            {data.subject_progress.map((sp) => (
              <div key={sp.subject.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: sp.subject.color }} />
                    {sp.subject.name}
                  </span>
                  <span className="text-slate-600">
                    {sp.completed_units}/{sp.total_units} · {percent(sp.progress_ratio)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${sp.progress_ratio * 100}%`, backgroundColor: sp.subject.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>

      {data.today_entries.length > 0 && (
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">今日作业</h2>
            <button onClick={onGoDaily} className="btn-secondary text-xs">编辑</button>
          </div>
          <div className="divide-y divide-slate-100">
            {data.today_entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 py-3">
                <span className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.task?.subject?.color || "#94a3b8" }} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{entry.task?.title}</p>
                  <p className="truncate text-sm text-slate-500">{entry.planned_description || "—"}</p>
                </div>
                <span className={`badge ${entry.status === "completed" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {entry.status === "completed" ? "已完成" : "待完成"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
