import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import type { AdminUserDetail } from "../types";
import AdminAccountSecurity from "./AdminAccountSecurity";
import AdminUserUsagePanel from "./AdminUserUsagePanel";

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const id = Number(userId);
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setUser(await api.adminGetUser(id));
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
  if (!user) return <div className="text-slate-500">用户不存在</div>;

  const isSelf = currentUser?.id === user.id;

  return (
    <div>
      <Link to="/admin/users" className="text-sm text-indigo-600 hover:underline">
        ← 返回用户列表
      </Link>
      <h2 className="mt-3 text-xl font-bold text-slate-800">
        {isSelf ? "我的账号" : "用户详情"}
      </h2>

      <div className="card mt-4 p-5">
        <dl className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">用户名</dt>
            <dd className="mt-1 font-medium">{user.username}</dd>
          </div>
          <div>
            <dt className="text-slate-500">显示名</dt>
            <dd className="mt-1 font-medium">{user.display_name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">角色</dt>
            <dd className="mt-1">{user.role === "admin" ? "管理员" : "用户"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">状态</dt>
            <dd className={`mt-1 ${user.is_active ? "text-green-600" : "text-red-500"}`}>
              {user.is_active ? "正常" : "已禁用"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">注册时间</dt>
            <dd className="mt-1">{new Date(user.created_at).toLocaleString("zh-CN")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">计划数</dt>
            <dd className="mt-1 font-medium">{user.plan_count}</dd>
          </div>
        </dl>
      </div>

      <AdminUserUsagePanel usage={user.usage} />

      <AdminAccountSecurity user={user} isSelf={isSelf} onUpdated={load} />

      <h3 className="mt-6 text-lg font-semibold text-slate-800">该用户的计划</h3>
      {user.plans.length === 0 ? (
        <p className="mt-3 text-slate-500">暂无计划</p>
      ) : (
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">计划名</th>
                <th className="p-3">描述</th>
                <th className="p-3">时段</th>
                <th className="p-3">任务</th>
                <th className="p-3">状态</th>
                <th className="p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {user.plans.map((p) => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="p-3">{p.id}</td>
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-slate-600">{p.description || "—"}</td>
                  <td className="p-3">{p.slot_count}</td>
                  <td className="p-3">{p.task_count}</td>
                  <td className="p-3">
                    <span className={p.is_active ? "text-green-600" : "text-slate-400"}>
                      {p.is_active ? "启用" : "停用"}
                    </span>
                  </td>
                  <td className="p-3">
                    <Link to={`/admin/plans/${p.id}`} className="text-indigo-600 hover:underline">
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
