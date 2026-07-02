import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminLogin() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const notAdminHint = (location.state as { reason?: string } | null)?.reason === "not_admin";

  if (user?.role === "admin") return <Navigate to="/admin" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(username.trim(), password);
      if (u.role !== "admin") {
        logout();
        setError("该账号不是管理员");
        return;
      }
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        <h1 className="text-xl font-bold text-slate-800">运营后台</h1>
        <p className="mt-1 text-sm text-slate-500">管理员登录</p>
        {notAdminHint && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            当前不是管理员身份，请使用管理员账号登录（默认 admin / admin123）。
          </p>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input className="input" placeholder="管理员用户名" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input type="password" className="input" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-indigo-600">
            返回用户端
          </Link>
        </p>
      </div>
    </div>
  );
}
