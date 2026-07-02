import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";
import CoursesView from "./Courses";
import LocationsView from "./Locations";
import PlansView from "./Plans";
import SettingsView from "./Settings";
import SubjectsView from "./Subjects";

export type MineSubPage = "hub" | "account" | "locations" | "courses" | "plans" | "subjects";

interface MineViewProps {
  subPage: MineSubPage;
  onSubPageChange: (page: MineSubPage) => void;
}

const pageTitles: Record<Exclude<MineSubPage, "hub">, string> = {
  account: "账号",
  locations: "上课地点",
  subjects: "作业安排",
  courses: "课程管理",
  plans: "我的计划",
};

function SubPageShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-slate-600 active:bg-white"
          aria-label="返回"
        >
          ‹
        </button>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function MineView({ subPage, onSubPageChange }: MineViewProps) {
  const { user } = useAuth();
  const { currentPlanId, plans } = usePlan();

  if (subPage !== "hub") {
    const title = pageTitles[subPage];
    return (
      <SubPageShell title={title} onBack={() => onSubPageChange("hub")}>
        {subPage === "account" && <SettingsView />}
        {subPage === "locations" && <LocationsView hideHeader />}
        {subPage === "subjects" && <SubjectsView hideHeader />}
        {subPage === "courses" && <CoursesView hideHeader />}
        {subPage === "plans" && <PlansView hideHeader />}
      </SubPageShell>
    );
  }

  const menuItems: {
    key: Exclude<MineSubPage, "hub">;
    icon: string;
    label: string;
    desc?: string;
    disabled?: boolean;
  }[] = [
    {
      key: "account",
      icon: "👤",
      label: "账号",
      desc: user?.display_name || "登录信息",
    },
    {
      key: "plans",
      icon: "📋",
      label: "我的计划",
      desc: plans.length ? `${plans.length} 个计划` : "创建第一个计划",
    },
    {
      key: "locations",
      icon: "📍",
      label: "上课地点",
      desc: currentPlanId ? "管理本计划地址" : "需先选择计划",
      disabled: !currentPlanId,
    },
    {
      key: "subjects",
      icon: "📚",
      label: "作业安排",
      desc: currentPlanId ? "自修作业分类" : "需先选择计划",
      disabled: !currentPlanId,
    },
    {
      key: "courses",
      icon: "🏫",
      label: "课程管理",
      desc: currentPlanId ? "培训班课程设置" : "需先选择计划",
      disabled: !currentPlanId,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {menuItems.map((item) => (
        <button
          key={item.key}
          type="button"
          disabled={item.disabled}
          onClick={() => onSubPageChange(item.key)}
          className={`card flex items-center gap-3 px-3.5 py-3 text-left active:bg-slate-50 ${
            item.disabled ? "cursor-not-allowed opacity-45" : ""
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">
            {item.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-800">{item.label}</span>
            <span className="block truncate text-xs text-slate-400">{item.desc}</span>
          </span>
          <span className="shrink-0 text-slate-300">›</span>
        </button>
      ))}
    </div>
  );
}
