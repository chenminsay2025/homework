import type { Plan, ScheduleSlot } from "./types";

const BASE = "/api";
const TOKEN_KEY = "homework_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function parseError(text: string): string {
  try {
    const j = JSON.parse(text) as { detail?: string | { msg?: string }[] };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) return j.detail.map((d) => d.msg || "").join("; ") || text;
  } catch {
    /* ignore */
  }
  return text || "请求失败";
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${url}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseError(text));
  }
  return res.json();
}

function planPath(planId: number, path: string) {
  return `/plans/${planId}${path}`;
}

const TEMPLATE_RAW: Array<{
  weekday: number;
  start?: string;
  end?: string;
  activity: string;
  location?: string;
  all_day?: boolean;
  order: number;
}> = [
  { weekday: 0, start: "08:30", end: "10:00", activity: "自安排", location: "地点C", order: 1 },
  { weekday: 0, start: "10:10", end: "12:10", activity: "绘画", location: "地点B", order: 2 },
  { weekday: 0, start: "13:30", end: "15:00", activity: "自安排", location: "地点C", order: 3 },
  { weekday: 0, start: "15:10", end: "17:10", activity: "英语", location: "地点A", order: 4 },
  { weekday: 1, start: "08:30", end: "10:00", activity: "数学", location: "地点A", order: 1 },
  { weekday: 1, start: "10:10", end: "12:10", activity: "自安排", location: "地点C", order: 2 },
  { weekday: 1, start: "13:30", end: "15:00", activity: "自安排", location: "地点C", order: 3 },
  { weekday: 1, start: "15:10", end: "17:10", activity: "语文", location: "地点A", order: 4 },
  { weekday: 2, start: "08:30", end: "10:00", activity: "数学", location: "地点A", order: 1 },
  { weekday: 2, start: "10:10", end: "12:10", activity: "绘画", location: "地点B", order: 2 },
  { weekday: 2, start: "13:30", end: "15:00", activity: "自安排", location: "地点C", order: 3 },
  { weekday: 2, start: "15:10", end: "17:10", activity: "英语", location: "地点A", order: 4 },
  { weekday: 3, start: "08:30", end: "10:00", activity: "数学", location: "地点A", order: 1 },
  { weekday: 3, start: "10:10", end: "12:10", activity: "自安排", location: "地点C", order: 2 },
  { weekday: 3, start: "13:30", end: "15:00", activity: "自安排", location: "地点C", order: 3 },
  { weekday: 3, start: "15:10", end: "17:10", activity: "语文", location: "地点A", order: 4 },
  { weekday: 4, start: "08:30", end: "10:00", activity: "自安排", location: "地点C", order: 1 },
  { weekday: 4, start: "10:10", end: "12:10", activity: "绘画", location: "地点B", order: 2 },
  { weekday: 4, start: "13:30", end: "15:00", activity: "自安排", location: "地点C", order: 3 },
  { weekday: 4, start: "15:10", end: "17:10", activity: "英语", location: "地点A", order: 4 },
  { weekday: 5, start: "08:30", end: "10:00", activity: "数学", location: "地点A", order: 1 },
  { weekday: 5, start: "10:10", end: "12:10", activity: "自安排", location: "地点C", order: 2 },
  { weekday: 5, start: "13:30", end: "15:00", activity: "自安排", location: "地点C", order: 3 },
  { weekday: 5, start: "15:10", end: "17:10", activity: "语文", location: "地点A", order: 4 },
  { weekday: 6, activity: "自安排", all_day: true, order: 1 },
];

export function buildWeeklyTemplatePayload(name: string, description?: string) {
  return {
    name,
    description,
    locations: ["地点A", "地点B", "地点C"],
    slots: TEMPLATE_RAW.map((s) => ({
      weekday: s.weekday,
      start_time: s.start ?? null,
      end_time: s.end ?? null,
      activity: s.activity,
      location_name: s.location ?? null,
      is_all_day: s.all_day ?? false,
      sort_order: s.order,
      slot_type: s.activity === "自安排" ? "self_study" : "class",
    })),
  };
}

export const api = {
  register: (username: string, password: string, display_name: string) =>
    request<{ access_token: string; user: import("./types").User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, display_name }),
    }),
  login: (username: string, password: string) =>
    request<{ access_token: string; user: import("./types").User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => request<import("./types").User>("/auth/me"),
  updateMe: (data: { display_name?: string }) =>
    request<import("./types").User>("/auth/me", { method: "PUT", body: JSON.stringify(data) }),
  changePassword: (old_password: string, new_password: string) =>
    request<{ ok: boolean }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ old_password, new_password }),
    }),

  adminGetStats: () => request<import("./types").AdminStats>("/admin/stats"),
  adminGetUsers: () => request<import("./types").AdminUser[]>("/admin/users"),
  adminGetUser: (id: number) => request<import("./types").AdminUserDetail>(`/admin/users/${id}`),
  adminUpdateUser: (id: number, data: { is_active?: boolean; role?: string; display_name?: string }) =>
    request<import("./types").AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  adminGetPlans: () => request<import("./types").AdminPlan[]>("/admin/plans"),
  adminGetPlanDetail: (id: number) => request<import("./types").AdminPlanDetail>(`/admin/plans/${id}`),
  adminDeletePlan: (id: number) => request<{ ok: boolean }>(`/admin/plans/${id}`, { method: "DELETE" }),
  adminGetSettings: () => request<import("./types").AdminSettings>("/admin/settings"),
  adminUpdateSettings: (data: { upload_max_mb?: number; delete_retention_days?: number }) =>
    request<import("./types").AdminSettings>("/admin/settings", { method: "PATCH", body: JSON.stringify(data) }),
  adminGetDeleted: (entityType?: string) =>
    request<import("./types").DeletedRecord[]>(
      `/admin/deleted${entityType ? `?entity_type=${encodeURIComponent(entityType)}` : ""}`,
    ),
  adminRestoreDeleted: (recordId: number) =>
    request<import("./types").DeletedRecord>(`/admin/deleted/${recordId}/restore`, { method: "POST" }),
  adminPurgeDeleted: (recordId: number) =>
    request<{ ok: boolean }>(`/admin/deleted/${recordId}`, { method: "DELETE" }),

  getUploadSettings: () => request<{ max_mb: number }>("/settings/upload"),

  getDevInfo: () => request<import("./types").DevInfo>("/dev-info"),
  getPlans: () => request<Plan[]>("/plans"),
  createPlan: (data: { name: string; description?: string; deadline?: string }) =>
    request<Plan>("/plans", { method: "POST", body: JSON.stringify(data) }),
  createPlanFromTemplate: (data: ReturnType<typeof buildWeeklyTemplatePayload>) =>
    request<Plan>("/plans/from-template", { method: "POST", body: JSON.stringify(data) }),
  updatePlan: (id: number, data: Partial<Plan>) =>
    request<Plan>(`/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePlan: (id: number) => request<{ ok: boolean }>(`/plans/${id}`, { method: "DELETE" }),
  duplicatePlan: (id: number, newName?: string) =>
    request<Plan>(`/plans/${id}/duplicate${newName ? `?new_name=${encodeURIComponent(newName)}` : ""}`, { method: "POST" }),

  getDashboard: (planId: number) => request<import("./types").Dashboard>(planPath(planId, "/dashboard")),
  getLocations: (planId: number) => request<import("./types").Location[]>(planPath(planId, "/locations")),
  createLocation: (planId: number, data: { name: string; address?: string }) =>
    request<import("./types").Location>(planPath(planId, "/locations"), { method: "POST", body: JSON.stringify(data) }),
  updateLocation: (planId: number, locationId: number, data: { name?: string; address?: string | null }) =>
    request<import("./types").Location>(planPath(planId, `/locations/${locationId}`), { method: "PUT", body: JSON.stringify(data) }),
  deleteLocation: (planId: number, locationId: number) =>
    request<{ ok: boolean }>(planPath(planId, `/locations/${locationId}`), { method: "DELETE" }),

  getCourses: (planId: number, activeOnly = false) =>
    request<import("./types").Course[]>(planPath(planId, `/courses?active_only=${activeOnly}`)),
  createCourse: (planId: number, data: {
    name: string;
    teacher?: string;
    phone?: string;
    description?: string;
    color?: string;
    default_location_id?: number | null;
    notes?: string;
  }) =>
    request<import("./types").Course>(planPath(planId, "/courses"), { method: "POST", body: JSON.stringify(data) }),
  updateCourse: (planId: number, courseId: number, data: Record<string, unknown>) =>
    request<import("./types").Course>(planPath(planId, `/courses/${courseId}`), { method: "PUT", body: JSON.stringify(data) }),
  reorderCourses: (planId: number, ids: number[]) =>
    request<import("./types").Course[]>(planPath(planId, "/courses/reorder"), {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  deleteCourse: (planId: number, courseId: number) =>
    request<{ ok: boolean }>(planPath(planId, `/courses/${courseId}`), { method: "DELETE" }),

  getSchedule: (planId: number, date?: string) =>
    request<ScheduleSlot[]>(planPath(planId, `/schedule${date ? `?date=${date}` : ""}`)),
  createScheduleSlot: (planId: number, data: Record<string, unknown>) =>
    request<ScheduleSlot>(planPath(planId, "/schedule"), { method: "POST", body: JSON.stringify(data) }),
  updateScheduleSlot: (planId: number, slotId: number, data: Record<string, unknown>) =>
    request<ScheduleSlot>(planPath(planId, `/schedule/${slotId}`), { method: "PUT", body: JSON.stringify(data) }),
  deleteScheduleSlot: (planId: number, slotId: number) =>
    request<{ ok: boolean }>(planPath(planId, `/schedule/${slotId}`), { method: "DELETE" }),

  getSlotPlans: (planId: number, date?: string) =>
    request<import("./types").SlotDailyPlan[]>(planPath(planId, `/slot-plans${date ? `?date=${date}` : ""}`)),
  createSlotPlan: (planId: number, data: {
    slot_id: number;
    date: string;
    task_id: number;
    planned_units?: number;
    description?: string;
    notes?: string;
  }) =>
    request<import("./types").SlotDailyPlan>(planPath(planId, "/slot-plans"), { method: "POST", body: JSON.stringify(data) }),
  updateSlotPlan: (planId: number, id: number, data: Record<string, unknown>) =>
    request<import("./types").SlotDailyPlan>(planPath(planId, `/slot-plans/${id}`), { method: "PUT", body: JSON.stringify(data) }),
  completeSlotPlan: (planId: number, id: number, score?: number) => {
    const params = score !== undefined ? `?score=${score}` : "";
    return request<import("./types").SlotDailyPlan>(planPath(planId, `/slot-plans/${id}/complete${params}`), { method: "POST" });
  },
  deleteSlotPlan: (planId: number, id: number) =>
    request<{ ok: boolean }>(planPath(planId, `/slot-plans/${id}`), { method: "DELETE" }),

  createScheduleException: (planId: number, data: {
    slot_id: number;
    date: string;
    exception_type: "cancelled" | "rescheduled";
    reason: string;
    start_time?: string | null;
    end_time?: string | null;
    location_id?: number | null;
    notes?: string;
  }) =>
    request<import("./types").ScheduleException>(planPath(planId, "/schedule-exceptions"), {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteScheduleException: (planId: number, id: number) =>
    request<{ ok: boolean }>(planPath(planId, `/schedule-exceptions/${id}`), { method: "DELETE" }),

  getSubjects: (planId: number) => request<import("./types").Subject[]>(planPath(planId, "/subjects")),
  createSubject: (planId: number, data: { name: string; color?: string }) =>
    request<import("./types").Subject>(planPath(planId, "/subjects"), { method: "POST", body: JSON.stringify(data) }),
  updateSubject: (planId: number, subjectId: number, data: { name?: string; color?: string }) =>
    request<import("./types").Subject>(planPath(planId, `/subjects/${subjectId}`), { method: "PUT", body: JSON.stringify(data) }),
  reorderSubjects: (planId: number, ids: number[]) =>
    request<import("./types").Subject[]>(planPath(planId, "/subjects/reorder"), {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  deleteSubject: (planId: number, subjectId: number) =>
    request<{ ok: boolean }>(planPath(planId, `/subjects/${subjectId}`), { method: "DELETE" }),
  getPlanTaskGuide: (planId: number) =>
    request<import("./types").TaskAttachment[]>(planPath(planId, "/task-guide")),
  updatePlanTaskGuide: (planId: number, attachments: import("./types").TaskAttachment[]) =>
    request<import("./types").TaskAttachment[]>(planPath(planId, "/task-guide"), {
      method: "PUT",
      body: JSON.stringify({
        attachments: attachments.map((att, index) => ({
          file_url: att.file_url,
          file_name: att.file_name,
          file_size: att.file_size ?? undefined,
          content_type: att.content_type ?? undefined,
          sort_order: att.sort_order ?? index,
        })),
      }),
    }),
  getTasks: (planId: number, activeOnly = true) =>
    request<import("./types").Task[]>(planPath(planId, `/tasks?active_only=${activeOnly}`)),
  getTaskLastActivity: (
    planId: number,
    taskId: number,
    params?: { beforeDate?: string; excludeItemId?: number },
  ) => {
    const q = new URLSearchParams();
    if (params?.beforeDate) q.set("before_date", params.beforeDate);
    if (params?.excludeItemId) q.set("exclude_item_id", String(params.excludeItemId));
    const suffix = q.toString() ? `?${q}` : "";
    return request<import("./types").TaskLastActivity | null>(
      planPath(planId, `/tasks/${taskId}/last-activity${suffix}`),
    );
  },
  createTask: (planId: number, data: Record<string, unknown>) =>
    request<import("./types").Task>(planPath(planId, "/tasks"), { method: "POST", body: JSON.stringify(data) }),
  updateTask: (planId: number, taskId: number, data: Record<string, unknown>) =>
    request<import("./types").Task>(planPath(planId, `/tasks/${taskId}`), { method: "PUT", body: JSON.stringify(data) }),
  deleteTask: (planId: number, id: number) =>
    request<{ ok: boolean }>(planPath(planId, `/tasks/${id}`), { method: "DELETE" }),
  uploadTaskFile: (planId: number, file: File, onProgress?: (ratio: number) => void) => {
    const token = getToken();
    const url = `${BASE}${planPath(planId, "/files/upload")}`;
    return new Promise<{
      file_url: string;
      file_name: string;
      size: number;
      content_type: string;
    }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(event.loaded / event.total);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("上传响应无效"));
          }
          return;
        }
        reject(new Error(parseError(xhr.responseText || xhr.statusText)));
      };
      xhr.onerror = () => reject(new Error("上传失败，请检查网络"));
      xhr.onabort = () => reject(new Error("上传已取消"));
      const body = new FormData();
      body.append("file", file);
      xhr.send(body);
    });
  },
  fetchPlanFile: async (fileUrl: string) => {
    const token = getToken();
    const res = await fetch(fileUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("无法加载附件");
    return res.blob();
  },

  getDaily: (planId: number, date?: string) =>
    request<import("./types").DailyEntry[]>(planPath(planId, `/daily${date ? `?date=${date}` : ""}`)),
  createDaily: (planId: number, data: Record<string, unknown>) =>
    request<import("./types").DailyEntry>(planPath(planId, "/daily"), { method: "POST", body: JSON.stringify(data) }),
  updateDaily: (planId: number, entryId: number, data: Record<string, unknown>) =>
    request<import("./types").DailyEntry>(planPath(planId, `/daily/${entryId}`), { method: "PUT", body: JSON.stringify(data) }),
  completeDaily: (planId: number, id: number, completed_units: number, score?: number) => {
    const params = new URLSearchParams({ completed_units: String(completed_units) });
    if (score !== undefined) params.set("score", String(score));
    return request<import("./types").DailyEntry>(planPath(planId, `/daily/${id}/complete?${params}`), { method: "POST" });
  },
  deleteDaily: (planId: number, id: number) =>
    request<{ ok: boolean }>(planPath(planId, `/daily/${id}`), { method: "DELETE" }),

  getDayItems: (planId: number, date?: string) =>
    request<import("./types").DayManualItem[]>(planPath(planId, `/day-items${date ? `?date=${date}` : ""}`)),
  createDayItem: (planId: number, data: {
    date: string;
    task_id?: number | null;
    title: string;
    start_time?: string | null;
    end_time?: string | null;
    is_all_day?: boolean;
    location_id?: number | null;
    description?: string | null;
    planned_units?: number | null;
    notes?: string | null;
  }) =>
    request<import("./types").DayManualItem>(planPath(planId, "/day-items"), {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDayItem: (planId: number, id: number, data: Record<string, unknown>) =>
    request<import("./types").DayManualItem>(planPath(planId, `/day-items/${id}`), {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  completeDayItem: (planId: number, id: number, score?: number) => {
    const params = score !== undefined ? `?score=${score}` : "";
    return request<import("./types").DayManualItem>(planPath(planId, `/day-items/${id}/complete${params}`), {
      method: "POST",
    });
  },
  deleteDayItem: (planId: number, id: number) =>
    request<{ ok: boolean }>(planPath(planId, `/day-items/${id}`), { method: "DELETE" }),
};

/** 本地日历日期 YYYY-MM-DD（勿用 toISOString，避免 UTC 时区导致加减一天失效） */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, day] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function formatDisplayDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekdays[d.getDay()]}`;
}

export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export const statusLabel: Record<string, string> = {
  planned: "待完成",
  completed: "已完成",
  partial: "部分完成",
  skipped: "已跳过",
};

export const statusColor: Record<string, string> = {
  planned: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  partial: "bg-blue-50 text-blue-700",
  skipped: "bg-slate-100 text-slate-500",
};

export const WEEKDAYS = [
  { value: 0, label: "周一" },
  { value: 1, label: "周二" },
  { value: 2, label: "周三" },
  { value: 3, label: "周四" },
  { value: 4, label: "周五" },
  { value: 5, label: "周六" },
  { value: 6, label: "周日" },
];

export const ACTIVITY_COLORS: Record<string, string> = {
  数学: "#3b82f6",
  语文: "#ec4899",
  英语: "#22c55e",
  绘画: "#f59e0b",
  自安排: "#94a3b8",
};

export function activityColor(activity: string, course?: { color: string } | null): string {
  if (course?.color) return course.color;
  return ACTIVITY_COLORS[activity] || "#6366f1";
}

export const COURSE_COLORS = [
  "#3b82f6", "#ec4899", "#22c55e", "#f59e0b", "#6366f1", "#14b8a6", "#ef4444", "#8b5cf6",
];

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find((w) => w.value === weekday)?.label || "";
}

export function formatTimeRange(start: string | null, end: string | null, allDay?: boolean): string {
  if (allDay) return "全天";
  if (!start || !end) return "";
  return `${start.slice(0, 5)} - ${end.slice(0, 5)}`;
}

export function formatLocationName(location?: { name: string; address?: string | null } | null): string {
  if (!location) return "未指定";
  return location.address ? `${location.name} · ${location.address}` : location.name;
}

export function locationOptionLabel(location: { name: string; address?: string | null }): string {
  return location.address ? `${location.name}（${location.address}）` : location.name;
}

export const SLOT_TYPE_LABEL: Record<string, string> = {
  class: "培训班",
  self_study: "自安排",
};

export function slotTypeLabel(type: string): string {
  return SLOT_TYPE_LABEL[type] || type;
}

export const DAY_STATUS_LABEL: Record<string, string> = {
  cancelled: "已取消",
  rescheduled: "已改期",
};

export const EXCEPTION_REASONS = ["请假", "老师有事", "课程取消", "其他"];

export function displayTimeRange(slot: import("./types").ScheduleSlot): string {
  const start = slot.day_status === "rescheduled" ? slot.effective_start_time : slot.start_time;
  const end = slot.day_status === "rescheduled" ? slot.effective_end_time : slot.end_time;
  return formatTimeRange(start, end, slot.is_all_day);
}

export function displayLocation(slot: import("./types").ScheduleSlot): string {
  const loc = slot.day_status === "rescheduled" && slot.effective_location
    ? slot.effective_location
    : slot.location;
  return formatLocationName(loc);
}
