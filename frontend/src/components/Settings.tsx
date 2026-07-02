import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";
import { DatePickerField } from "./DatePickerSheet";

const fieldInput =
  "min-h-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100";

const actionBtn =
  "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 active:bg-indigo-50 disabled:opacity-40";

export default function SettingsView() {
  const { user, devMode, logout, updateProfile } = useAuth();
  const { currentPlan, currentPlanId, refreshPlans } = usePlan();
  const navigate = useNavigate();
  const [deadline, setDeadline] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [deadlineSaved, setDeadlineSaved] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");

  useEffect(() => {
    setDeadline(currentPlan?.deadline || "");
  }, [currentPlan]);

  useEffect(() => {
    setDisplayName(user?.display_name || "");
  }, [user]);

  const initial = (user?.display_name || user?.username || "?").slice(0, 1).toUpperCase();
  const nameDirty = displayName.trim() !== (user?.display_name || "");

  const handleSaveDeadline = async () => {
    if (!currentPlanId) return;
    await api.updatePlan(currentPlanId, { deadline: deadline || null });
    await refreshPlans();
    setDeadlineSaved(true);
    setTimeout(() => setDeadlineSaved(false), 1500);
  };

  const handleSaveProfile = async () => {
    setProfileMsg("");
    try {
      await updateProfile(displayName.trim());
      setProfileMsg("已保存");
      setTimeout(() => setProfileMsg(""), 1500);
    } catch (e) {
      setProfileMsg(e instanceof Error ? e.message : "保存失败");
    }
  };

  const handleChangePassword = async () => {
    setPwdMsg("");
    try {
      await api.changePassword(oldPwd, newPwd);
      setPwdMsg("密码已更新");
      setOldPwd("");
      setNewPwd("");
      setShowPwd(false);
    } catch (e) {
      setPwdMsg(e instanceof Error ? e.message : "修改失败");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div id="account-settings" className="space-y-3">
      <section className="card overflow-hidden">
        <div className="flex items-center gap-3 px-3.5 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{user?.display_name}</p>
            <p className="truncate text-xs text-slate-400">@{user?.username}</p>
          </div>
          {devMode && (
            <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              开发模式
            </span>
          )}
        </div>

        {!devMode && (
          <>
            <div className="border-t border-slate-100 px-3.5 py-2">
              <div className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-xs text-slate-500">昵称</span>
                <input
                  className={fieldInput}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <button
                  type="button"
                  className={actionBtn}
                  disabled={!nameDirty}
                  onClick={handleSaveProfile}
                >
                  {profileMsg === "已保存" ? "✓" : "保存"}
                </button>
              </div>
              {profileMsg && profileMsg !== "已保存" && (
                <p className="mt-1 pl-12 text-xs text-red-500">{profileMsg}</p>
              )}
            </div>

            <div className="border-t border-slate-100">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm text-slate-700 active:bg-slate-50"
                onClick={() => setShowPwd((v) => !v)}
              >
                <span>修改密码</span>
                <span className={`text-xs text-slate-400 transition ${showPwd ? "rotate-90" : ""}`}>›</span>
              </button>
              {showPwd && (
                <div className="space-y-2 border-t border-slate-50 bg-slate-50/60 px-3.5 py-2.5">
                  <input
                    type="password"
                    className={`${fieldInput} w-full`}
                    placeholder="原密码"
                    value={oldPwd}
                    onChange={(e) => setOldPwd(e.target.value)}
                  />
                  <input
                    type="password"
                    className={`${fieldInput} w-full`}
                    placeholder="新密码（至少 6 位）"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                  />
                  {pwdMsg && (
                    <p className={`text-xs ${pwdMsg === "密码已更新" ? "text-green-600" : "text-red-500"}`}>
                      {pwdMsg}
                    </p>
                  )}
                  <button
                    type="button"
                    className="text-xs font-medium text-indigo-600 active:text-indigo-800"
                    onClick={handleChangePassword}
                  >
                    确认修改
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full border-t border-slate-100 py-2.5 text-xs text-red-500 active:bg-red-50"
        >
          退出登录
        </button>
      </section>

      {currentPlanId && (
        <section className="card px-3.5 py-2.5">
          <p className="mb-1.5 text-xs font-medium text-slate-500">当前计划 · {currentPlan?.name}</p>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-slate-500">截止</span>
            <DatePickerField
              className="min-h-0 flex-1 py-1.5"
              value={deadline}
              onChange={setDeadline}
              placeholder="选择截止日期"
              title="截止日期"
              allowClear
            />
            <button type="button" className={actionBtn} onClick={handleSaveDeadline}>
              {deadlineSaved ? "✓" : "保存"}
            </button>
          </div>
        </section>
      )}

      <details className="card group px-3.5 py-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-slate-600 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between">
            使用说明
            <span className="text-slate-400 transition group-open:rotate-90">›</span>
          </span>
        </summary>
        <ol className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500">
          <li>1. 「作业安排」添加数学、语文等自修分类</li>
          <li>2. 「上课地点」添加地点并填写地址</li>
          <li>3. 「课程管理」添加培训班课程</li>
          <li>4. 创建计划，或用周课表模板一键生成</li>
          <li>5. 「每日」记录作业与临时调课</li>
        </ol>
      </details>
    </div>
  );
}
