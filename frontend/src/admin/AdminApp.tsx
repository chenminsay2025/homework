import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminDashboard from "./AdminDashboard";
import AdminDesktopOnly from "./AdminDesktopOnly";
import AdminLayout from "./AdminLayout";
import AdminLogin from "./AdminLogin";
import AdminPlanDetail from "./AdminPlanDetail";
import AdminPlans from "./AdminPlans";
import AdminSettings from "./AdminSettings";
import AdminTrash from "./AdminTrash";
import AdminUserDetail from "./AdminUserDetail";
import AdminUsers from "./AdminUsers";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-slate-500">加载中...</div>;
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== "admin") return <Navigate to="/admin/login" replace state={{ reason: "not_admin" }} />;
  return <>{children}</>;
}

export default function AdminApp() {
  return (
    <AdminDesktopOnly>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route
          path="*"
          element={
            <RequireAdmin>
              <AdminLayout>
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="users/:userId" element={<AdminUserDetail />} />
                  <Route path="plans" element={<AdminPlans />} />
                  <Route path="plans/:planId" element={<AdminPlanDetail />} />
                  <Route path="trash" element={<AdminTrash />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Routes>
              </AdminLayout>
            </RequireAdmin>
          }
        />
      </Routes>
    </AdminDesktopOnly>
  );
}
