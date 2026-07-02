import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface UserMenuProps {
  mode?: "admin";
}

export default function UserMenu({ mode }: UserMenuProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const close = () => setOpen(false);

  const handleLogout = () => {
    close();
    logout();
    navigate(mode === "admin" ? "/admin/login" : "/login");
  };

  const initial = (user.display_name || user.username).slice(0, 1).toUpperCase();

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[9rem] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-2.5 text-left active:bg-slate-100"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
          {initial}
        </span>
        <span className="truncate text-xs font-medium text-slate-700">{user.display_name}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="关闭菜单"
            onClick={close}
          />
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-800">{user.display_name}</p>
              <p className="truncate text-xs text-slate-500">@{user.username}</p>
            </div>
            {mode === "admin" && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  close();
                  navigate("/");
                }}
              >
                前往用户端
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="block w-full border-t border-slate-100 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
              onClick={handleLogout}
            >
              退出登录
            </button>
          </div>
        </>
      )}
    </div>
  );
}
