import { Link, useLocation } from "react-router-dom";
import UserMenu from "../components/UserMenu";

const nav = [
  { to: "/admin", label: "概览", end: true },
  { to: "/admin/users", label: "用户" },
  { to: "/admin/plans", label: "计划" },
  { to: "/admin/trash", label: "删除记录" },
  { to: "/admin/settings", label: "设置" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex min-h-dvh min-w-[1024px] bg-slate-100">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
        <h1 className="text-lg font-bold text-slate-800">运营后台</h1>
        <p className="mt-0.5 text-xs text-slate-400">PC 管理端</p>
        <nav className="mt-6 flex-1 space-y-1">
          {nav.map((item) => {
            const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 pt-4">
          <UserMenu mode="admin" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
