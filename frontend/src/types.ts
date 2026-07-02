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
