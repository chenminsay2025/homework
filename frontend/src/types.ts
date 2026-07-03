export interface User {
  id: number;
  username: string;
  display_name: string;
  role?: string;
  is_active?: boolean;
}

export interface AdminStats {
  user_count: number;
  active_user_count: number;
  plan_count: number;
  task_count: number;
}

export interface AdminSettings {
  upload_max_mb: number;
  delete_retention_days: number;
}

export interface DeletedRecord {
  id: number;
  entity_type: string;
  entity_type_label: string;
  entity_id: number;
  plan_id: number | null;
  user_id: number;
  username: string;
  display_name: string;
  display_title: string;
  deleted_at: string;
  deleted_by_user_id: number | null;
  deleted_by_username: string | null;
  expires_at: string;
  restored_at: string | null;
}

export interface AdminUser extends User {
  role: string;
  is_active: boolean;
  created_at: string;
  plan_count: number;
}

export interface AdminUserDetail extends AdminUser {
  plans: Plan[];
  usage: AdminUserUsage;
}

export interface AdminUserPlanUsage {
  plan_id: number;
  plan_name: string;
  is_active: boolean;
  created_at: string;
  course_count: number;
  location_count: number;
  schedule_slot_count: number;
  task_count: number;
  active_task_count: number;
  daily_entry_count: number;
  daily_entry_completed: number;
  slot_daily_plan_count: number;
  slot_daily_plan_completed: number;
  day_manual_item_count: number;
  day_manual_item_completed: number;
  attachment_count: number;
  attachment_bytes: number;
  schedule_exception_count: number;
  last_activity_at: string | null;
}

export interface AdminUserUsage {
  registered_days: number;
  last_activity_at: string | null;
  active_plan_count: number;
  total_plan_count: number;
  course_count: number;
  location_count: number;
  schedule_slot_count: number;
  task_count: number;
  active_task_count: number;
  daily_entry_count: number;
  daily_entry_completed: number;
  slot_daily_plan_count: number;
  slot_daily_plan_completed: number;
  day_manual_item_count: number;
  day_manual_item_completed: number;
  attachment_count: number;
  attachment_bytes: number;
  schedule_exception_count: number;
  deleted_record_count: number;
  completion_rate: number;
  plan_usages: AdminUserPlanUsage[];
}

export const EMPTY_ADMIN_USER_USAGE: AdminUserUsage = {
  registered_days: 0,
  last_activity_at: null,
  active_plan_count: 0,
  total_plan_count: 0,
  course_count: 0,
  location_count: 0,
  schedule_slot_count: 0,
  task_count: 0,
  active_task_count: 0,
  daily_entry_count: 0,
  daily_entry_completed: 0,
  slot_daily_plan_count: 0,
  slot_daily_plan_completed: 0,
  day_manual_item_count: 0,
  day_manual_item_completed: 0,
  attachment_count: 0,
  attachment_bytes: 0,
  schedule_exception_count: 0,
  deleted_record_count: 0,
  completion_rate: 0,
  plan_usages: [],
};

export function normalizeAdminUserUsage(
  usage: Partial<AdminUserUsage> | null | undefined,
): AdminUserUsage {
  if (!usage) return { ...EMPTY_ADMIN_USER_USAGE };
  return {
    ...EMPTY_ADMIN_USER_USAGE,
    ...usage,
    plan_usages: usage.plan_usages ?? [],
  };
}

export interface AdminPlanDetail {
  user: { id: number; username: string; display_name: string };
  plan: Plan;
  locations: Location[];
  courses: Course[];
  tasks: Task[];
  schedule: ScheduleSlot[];
  dashboard: Dashboard;
}

export interface AdminPlan {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  name: string;
  is_active: boolean;
  created_at: string;
  slot_count: number;
  task_count: number;
}

export interface Plan {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  deadline: string | null;
  is_active: boolean;
  created_at: string;
  slot_count: number;
  task_count: number;
}

export interface Location {
  id: number;
  plan_id: number;
  name: string;
  address: string | null;
}

export interface Course {
  id: number;
  plan_id: number;
  name: string;
  teacher: string | null;
  phone: string | null;
  description: string | null;
  color: string;
  default_location_id: number | null;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  slot_count: number;
  default_location?: Location;
}

export interface ScheduleSlot {
  id: number;
  plan_id: number;
  weekday: number;
  start_time: string | null;
  end_time: string | null;
  activity: string;
  location_id: number | null;
  is_all_day: boolean;
  sort_order: number;
  notes: string | null;
  slot_type: "class" | "self_study";
  course_id: number | null;
  default_task_id: number | null;
  location?: Location;
  course?: Course;
  default_task?: Task | null;
  daily_plan?: SlotDailyPlan | null;
  day_status: "normal" | "cancelled" | "rescheduled";
  exception?: ScheduleException | null;
  effective_start_time: string | null;
  effective_end_time: string | null;
  effective_location?: Location | null;
}

export interface ScheduleException {
  id: number;
  plan_id: number;
  slot_id: number;
  date: string;
  exception_type: "cancelled" | "rescheduled";
  reason: string;
  start_time: string | null;
  end_time: string | null;
  location_id: number | null;
  notes: string | null;
  created_at: string;
  location?: Location;
}

export interface SlotDailyPlan {
  id: number;
  slot_id: number;
  date: string;
  task_id: number | null;
  description: string;
  planned_units: number;
  status: "planned" | "completed" | "skipped";
  score: number | null;
  notes: string | null;
  created_at: string;
  slot?: ScheduleSlot;
  task?: Task;
}

export interface Subject {
  id: number;
  plan_id: number;
  name: string;
  color: string;
  sort_order: number;
}

export interface TaskAttachment {
  id?: number;
  file_url: string;
  file_name: string;
  file_size?: number | null;
  content_type?: string | null;
  sort_order?: number;
}

export interface Task {
  id: number;
  plan_id: number;
  subject_id: number;
  title: string;
  description: string | null;
  total_units: number;
  unit_label: string;
  file_url: string | null;
  file_name?: string | null;
  attachments?: TaskAttachment[];
  sort_order: number;
  is_active: boolean;
  completed_units: number;
  progress_ratio: number;
  subject?: Subject;
}

export interface TaskLastActivity {
  date: string;
  source: "daily" | "manual";
  content: string | null;
  planned_units: number | null;
  completed_units: number | null;
  unit_label: string | null;
  status: string | null;
}

export interface DailyEntry {
  id: number;
  task_id: number;
  date: string;
  planned_description: string | null;
  planned_units: number;
  completed_units: number;
  score: number | null;
  status: "planned" | "completed" | "partial" | "skipped";
  notes: string | null;
  created_at: string;
  task?: Task;
}

export interface DayManualItem {
  id: number;
  plan_id: number;
  date: string;
  task_id: number | null;
  title: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  location_id: number | null;
  description: string | null;
  planned_units: number | null;
  status: "planned" | "completed" | "skipped";
  score: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  location?: Location;
  task?: Task;
}

export interface SubjectProgress {
  subject: Subject;
  total_units: number;
  completed_units: number;
  progress_ratio: number;
  task_count: number;
}

export interface Dashboard {
  plan: Plan;
  deadline: string | null;
  days_remaining: number | null;
  today: string;
  today_schedule: ScheduleSlot[];
  today_slot_plans: SlotDailyPlan[];
  today_entries: DailyEntry[];
  subject_progress: SubjectProgress[];
  overall_progress: number;
}

export interface DevInfo {
  dev_mode: boolean;
  user: User | null;
  auth_enabled: boolean;
}
