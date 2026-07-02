import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { PlanProvider } from "./context/PlanContext";
import AdminApp from "./admin/AdminApp";
import AppContent from "./components/AppContent";
import LoginPage from "./components/Login";
import RegisterPage from "./components/Register";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 text-slate-500">
        加载中...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <PlanProvider>
              <AppContent />
            </PlanProvider>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
