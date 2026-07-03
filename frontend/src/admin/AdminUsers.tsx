import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { AdminUser } from "../types";

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setUsers(await api.adminGetUsers());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (u: AdminUser) => {
    await api.adminUpdateUser(u.id, { is_active: !u.is_active });
    load();
  };

  if (loading) return <div className="text-slate-500">加载中...</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800">用户管理</h2>
      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-100 text-slate-500">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">用户名</th>
              <th className="p-3">名称</th>
              <th className="p-3">角色</th>
              <th className="p-3">计划数</th>
              <th className="p-3">状态</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-50">
                <td className="p-3">{u.id}</td>
                <td className="p-3">{u.username}</td>
                <td className="p-3">{u.display_name}</td>
                <td className="p-3">{u.role === "admin" ? "管理员" : "用户"}</td>
                <td className="p-3">{u.plan_count}</td>
                <td className="p-3">
                  <span className={u.is_active ? "text-green-600" : "text-red-500"}>
                    {u.is_active ? "正常" : "已禁用"}
                  </span>
                </td>
                <td className="p-3 space-x-3">
                  <Link to={`/admin/users/${u.id}`} className="text-indigo-600 hover:underline">
                    详情 / 账号安全
                  </Link>
                  {u.role !== "admin" && (
                    <button type="button" className="text-slate-600" onClick={() => toggleActive(u)}>
                      {u.is_active ? "禁用" : "启用"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
