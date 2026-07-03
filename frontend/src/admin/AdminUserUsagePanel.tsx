import { Link } from "react-router-dom";
import { normalizeAdminUserUsage, type AdminUserUsage } from "../types";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN");
}

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-800">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function AdminUserUsagePanel({ usage }: { usage?: AdminUserUsage | null }) {
  const stats = normalizeAdminUserUsage(usage);
  const activityTotal =
    stats.daily_entry_count + stats.slot_daily_plan_count + stats.day_manual_item_count;
  const activityDone =
    stats.daily_entry_completed +
    stats.slot_daily_plan_completed +
    stats.day_manual_item_completed;

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold text-slate-800">使用情况</h3>
      <p className="mt-1 text-sm text-slate-500">汇总该账号下全部计划的数据与活跃程度。</p>

      <div className="card mt-4 p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <StatCard label="注册天数" value={`${stats.registered_days} 天`} />
          <StatCard label="最近活跃" value={formatDateTime(stats.last_activity_at)} />
          <StatCard
            label="计划"
            value={stats.total_plan_count}
            hint={`${stats.active_plan_count} 个启用中`}
          />
          <StatCard label="课程 / 地点" value={`${stats.course_count} / ${stats.location_count}`} />
          <StatCard label="课表时段" value={stats.schedule_slot_count} />
          <StatCard
            label="任务"
            value={stats.task_count}
            hint={`${stats.active_task_count} 个进行中`}
          />
          <StatCard
            label="每日记录"
            value={stats.daily_entry_count}
            hint={`已完成 ${stats.daily_entry_completed}`}
          />
          <StatCard
            label="时段安排"
            value={stats.slot_daily_plan_count}
            hint={`已完成 ${stats.slot_daily_plan_completed}`}
          />
          <StatCard
            label="自安排项"
            value={stats.day_manual_item_count}
            hint={`已完成 ${stats.day_manual_item_completed}`}
          />
          <StatCard
            label="完成率"
            value={formatRate(stats.completion_rate)}
            hint={`${activityDone} / ${activityTotal} 条记录`}
          />
          <StatCard
            label="附件"
            value={stats.attachment_count}
            hint={formatBytes(stats.attachment_bytes)}
          />
          <StatCard
            label="调课 / 删除"
            value={`${stats.schedule_exception_count} / ${stats.deleted_record_count}`}
            hint="调课次数 / 回收站记录"
          />
        </div>
      </div>

      {stats.plan_usages.length > 0 && (
        <>
          <h4 className="mt-6 text-base font-semibold text-slate-800">各计划明细</h4>
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-slate-100 text-slate-500">
                <tr>
                  <th className="p-3">计划</th>
                  <th className="p-3">状态</th>
                  <th className="p-3">课程</th>
                  <th className="p-3">地点</th>
                  <th className="p-3">时段</th>
                  <th className="p-3">任务</th>
                  <th className="p-3">每日记录</th>
                  <th className="p-3">时段安排</th>
                  <th className="p-3">自安排</th>
                  <th className="p-3">附件</th>
                  <th className="p-3">最近活跃</th>
                  <th className="p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {stats.plan_usages.map((p) => {
                  const planDone =
                    p.daily_entry_completed + p.slot_daily_plan_completed + p.day_manual_item_completed;
                  const planTotal =
                    p.daily_entry_count + p.slot_daily_plan_count + p.day_manual_item_count;
                  return (
                    <tr key={p.plan_id} className="border-b border-slate-50">
                      <td className="p-3">
                        <p className="font-medium text-slate-800">{p.plan_name}</p>
                        <p className="text-xs text-slate-400">ID {p.plan_id}</p>
                      </td>
                      <td className="p-3">
                        <span className={p.is_active ? "text-green-600" : "text-slate-400"}>
                          {p.is_active ? "启用" : "停用"}
                        </span>
                      </td>
                      <td className="p-3">{p.course_count}</td>
                      <td className="p-3">{p.location_count}</td>
                      <td className="p-3">{p.schedule_slot_count}</td>
                      <td className="p-3">{p.active_task_count}/{p.task_count}</td>
                      <td className="p-3">{p.daily_entry_completed}/{p.daily_entry_count}</td>
                      <td className="p-3">{p.slot_daily_plan_completed}/{p.slot_daily_plan_count}</td>
                      <td className="p-3">{p.day_manual_item_completed}/{p.day_manual_item_count}</td>
                      <td className="p-3">
                        {p.attachment_count}
                        {p.attachment_bytes > 0 && (
                          <span className="ml-1 text-xs text-slate-400">({formatBytes(p.attachment_bytes)})</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-slate-600">{formatDateTime(p.last_activity_at)}</td>
                      <td className="p-3">
                        <Link to={`/admin/plans/${p.plan_id}`} className="text-indigo-600 hover:underline">
                          详情
                        </Link>
                        {planTotal > 0 && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            完成 {planDone}/{planTotal}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
