import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import type { AdminUser } from "../types";

interface AdminAccountSecurityProps {
  user: Pick<AdminUser, "id" | "username" | "display_name" | "role" | "is_active">;
  isSelf?: boolean;
  onUpdated?: () => void;
}

export default function AdminAccountSecurity({ user, isSelf = false, onUpdated }: AdminAccountSecurityProps) {
  const { updateProfile, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user.display_name);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    setDisplayName(user.display_name);
  }, [user.display_name]);

  const nameDirty = displayName.trim() !== user.display_name;

  const handleSaveProfile = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setProfileMsg("显示名不能为空");
      return;
    }
    setProfileSaving(true);
    setProfileMsg("");
    try {
      if (isSelf) {
        await updateProfile(trimmed);
      } else {
        await api.adminUpdateUser(user.id, { display_name: trimmed });
        onUpdated?.();
      }
      setProfileMsg("已保存");
    } catch (e) {
      setProfileMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (user.role === "admin") return;
    try {
      await api.adminUpdateUser(user.id, { is_active: !user.is_active });
      onUpdated?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  };

  const handlePasswordSubmit = async () => {
    setPwdMsg("");
    if (newPwd.length < 6) {
      setPwdMsg("新密码至少 6 位");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg("两次输入的新密码不一致");
      return;
    }
    setPwdSaving(true);
    try {
      if (isSelf) {
        if (!oldPwd) {
          setPwdMsg("请输入原密码");
          return;
        }
        await api.changePassword(oldPwd, newPwd);
      } else {
        await api.adminResetUserPassword(user.id, newPwd);
      }
      setPwdMsg(isSelf ? "密码已更新" : "已重置密码");
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
      if (isSelf) await refreshUser();
    } catch (e) {
      setPwdMsg(e instanceof Error ? e.message : "操作失败");
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="card mt-4 p-5">
      <h3 className="text-lg font-semibold text-slate-800">账号安全</h3>
      <p className="mt-1 text-sm text-slate-500">
        {isSelf ? "管理当前登录管理员的账号信息。" : `管理用户 @${user.username} 的账号与安全设置。`}
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">显示名</label>
          <div className="flex max-w-md items-center gap-2">
            <input
              className="input flex-1"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setProfileMsg("");
              }}
            />
            <button
              type="button"
              className="btn-primary shrink-0 px-4"
              disabled={!nameDirty || profileSaving}
              onClick={handleSaveProfile}
            >
              {profileSaving ? "保存中..." : "保存"}
            </button>
          </div>
          {profileMsg && (
            <p className={`mt-1 text-sm ${profileMsg === "已保存" ? "text-green-600" : "text-red-500"}`}>
              {profileMsg}
            </p>
          )}
        </div>

        {!isSelf && user.role !== "admin" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">账号状态</label>
            <div className="flex items-center gap-3">
              <span className={user.is_active ? "text-green-600" : "text-red-500"}>
                {user.is_active ? "正常" : "已禁用"}
              </span>
              <button type="button" className="text-sm text-indigo-600 hover:underline" onClick={handleToggleActive}>
                {user.is_active ? "禁用账号" : "启用账号"}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">禁用后该用户将无法登录。</p>
          </div>
        )}

        <div className="border-t border-slate-100 pt-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            {isSelf ? "修改密码" : "重置密码"}
          </label>
          <div className="max-w-md space-y-2">
            {isSelf && (
              <input
                type="password"
                className="input w-full"
                placeholder="原密码"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
              />
            )}
            <input
              type="password"
              className="input w-full"
              placeholder="新密码（至少 6 位）"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
            <input
              type="password"
              className="input w-full"
              placeholder="确认新密码"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
            />
            {!isSelf && (
              <p className="text-xs text-amber-600">管理员重置密码无需原密码，请妥善告知用户。</p>
            )}
            {pwdMsg && (
              <p className={`text-sm ${pwdMsg.includes("已") ? "text-green-600" : "text-red-500"}`}>{pwdMsg}</p>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={pwdSaving || !newPwd || !confirmPwd || (isSelf && !oldPwd)}
              onClick={handlePasswordSubmit}
            >
              {pwdSaving ? "提交中..." : isSelf ? "确认修改密码" : "重置密码"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
