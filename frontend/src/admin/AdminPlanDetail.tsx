import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  formatDisplayDate,
  formatTimeRange,
  percent,
  statusLabel,
  weekdayLabel,
} from "../api";
import type { AdminPlanDetail } from "../types";

export default function AdminPlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const id = Number(planId);
  const [data, setData] = useState<AdminPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setData(await api.adminGetPlanDetail(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="text-slate-500">加载中...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!data) return <div className="text-slate-500">计划不存在</div>;

  const { user, plan, locations, courses, tasks, schedule, dashboard } = data;
  const scheduleByDay = schedule.reduce<Record<number, typeof schedule>>((acc, slot) => {
    (acc[slot.weekday] ||= []).push(slot);
    return acc;
  }, {});

  return (
    <div>
      <Link to={`/admin/users/${user.id}`} className="text-sm text-indigo-600 hover:underline">
        ← 返回用户 {user.display_name}
      </Link>
      <h2 className="mt-3 text-xl font-bold text-slate-800">{plan.name}</h2>
      <p className="mt-1 text-sm text-slate-500">
        所属用户：{user.display_name} (@{user.username})
      </p>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-sm text-slate-500">总体进度</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{percent(dashboard.overall_progress)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">今日作业</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {dashboard.today_entries.filter((e) => e.status === "completed").length}
            <span className="text-base font-normal text-slate-400"> / {dashboard.today_entries.length}</span>
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">课表时段</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{plan.slot_count}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">任务数</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{plan.task_count}</p>
        </div>
      </div>

      {plan.description && (
        <div className="card mt-4 p-4 text-sm text-slate-600">
          <span className="font-medium text-slate-800">描述：</span>
          {plan.description}
        </div>
      )}

      <section className="mt-6">
        <h3 className="text-lg font-semibold text-slate-800">周课表</h3>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5, 6].map((wd) => (
            <div key={wd} className="card p-4">
              <h4 className="font-medium text-slate-800">{weekdayLabel(wd)}</h4>
              {(scheduleByDay[wd] || []).length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">无安排</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {(scheduleByDay[wd] || [])
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((s) => (
                      <li key={s.id} className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="font-medium">{s.activity}</p>
                        <p className="text-slate-500">
                          {formatTimeRange(s.start_time, s.end_time, s.is_all_day)}
                          {s.location ? ` · ${s.location.name}` : ""}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-lg font-semibold text-slate-800">任务列表</h3>
        {tasks.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">暂无任务</p>
        ) : (
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-100 text-slate-500">
                <tr>
                  <th className="p-3">科目</th>
                  <th className="p-3">任务</th>
                  <th className="p-3">进度</th>
                  <th className="p-3">状态</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="p-3">{t.subject?.name || "—"}</td>
                    <td className="p-3 font-medium">{t.title}</td>
                    <td className="p-3">
                      {t.completed_units}/{t.total_units} {t.unit_label} ({percent(t.progress_ratio)})
                    </td>
                    <td className="p-3">{t.is_active ? "进行中" : "已归档"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-lg font-semibold text-slate-800">课程 / 地点</h3>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="card p-4">
            <h4 className="font-medium text-slate-700">课程 ({courses.length})</h4>
            {courses.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">无</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {courses.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.name}</span>
                    {c.teacher ? <span className="text-slate-500"> · {c.teacher}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-4">
            <h4 className="font-medium text-slate-700">地点 ({locations.length})</h4>
            {locations.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">无</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {locations.map((l) => (
                  <li key={l.id}>
                    {l.name}
                    {l.address ? <span className="text-slate-500"> · {l.address}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-lg font-semibold text-slate-800">
          今日安排 ({formatDisplayDate(dashboard.today)})
        </h3>
        {dashboard.today_entries.length === 0 && dashboard.today_schedule.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">今日无安排</p>
        ) : (
          <div className="mt-3 space-y-3">
            {dashboard.today_schedule.map((s) => (
              <div key={s.id} className="card p-4 text-sm">
                <p className="font-medium">{s.activity}</p>
                <p className="text-slate-500">
                  {formatTimeRange(s.start_time, s.end_time, s.is_all_day)}
                </p>
              </div>
            ))}
            {dashboard.today_entries.map((e) => (
              <div key={e.id} className="card p-4 text-sm">
                <p className="font-medium">{e.task?.title || "作业"}</p>
                <p className="text-slate-500">
                  {e.planned_units} 单位 · {statusLabel[e.status] || e.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
