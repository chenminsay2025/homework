import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearToken, getToken, setToken } from "../api";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  devMode: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, password: string, displayName: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [devMode, setDevMode] = useState(false);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    const onAdminPath =
      typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

    if (token) {
      try {
        const me = await api.getMe();
        setUser(me);
        return;
      } catch {
        clearToken();
      }
    }

    // 后台路径不使用开发模式自动登录，避免普通用户/dev 用户被误判后跳回用户端
    if (onAdminPath) {
      setDevMode(false);
      setUser(null);
      return;
    }

    try {
      const info = await api.getDevInfo();
      setDevMode(info.dev_mode);
      setUser(info.dev_mode ? info.user : null);
    } catch {
      setDevMode(false);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    setToken(res.access_token);
    setUser(res.user);
    setDevMode(false);
    return res.user;
  };

  const register = async (username: string, password: string, displayName: string) => {
    const res = await api.register(username, password, displayName);
    setToken(res.access_token);
    setUser(res.user);
    setDevMode(false);
    return res.user;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const updateProfile = async (displayName: string) => {
    const updated = await api.updateMe({ display_name: displayName });
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, devMode, login, register, logout, refreshUser, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
