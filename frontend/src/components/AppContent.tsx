import { useEffect, useState, type ComponentType } from "react";
import { usePlan } from "../context/PlanContext";
import {
  NavDailyIcon,
  NavDashboardIcon,
  NavMineIcon,
  NavScheduleIcon,
  NavTasksIcon,
} from "./BottomNavIcons";
import DashboardView from "./Dashboard";
import DailyPlanView from "./DailyPlan";
import MineView, { type MineSubPage } from "./MineView";
import PlanSelect from "./PlanSelect";
import TasksView from "./Tasks";
import WeeklyScheduleView from "./WeeklySchedule";

type Tab = "dashboard" | "daily" | "schedule" | "tasks" | "mine";

type NavIconProps = { className?: string; active?: boolean };

const navItems: {
  key: Tab;
  label: string;
  Icon: ComponentType<NavIconProps>;
}[] = [
  { key: "dashboard", label: "总览", Icon: NavDashboardIcon },
  { key: "daily", label: "每日", Icon: NavDailyIcon },
  { key: "schedule", label: "课表", Icon: NavScheduleIcon },
  { key: "tasks", label: "任务", Icon: NavTasksIcon },
  { key: "mine", label: "我的", Icon: NavMineIcon },
];

function NavButton({
  item,
  active,
  onClick,
  layout,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  onClick: () => void;
  layout: "bottom" | "side";
}) {
  const { Icon } = item;
  if (layout === "side") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition active:scale-[0.98] lg:py-3 ${
          active
            ? "bg-indigo-50 text-indigo-600"
            : "text-slate-600 hover:bg-slate-50 active:bg-slate-100"
        }`}
      >
        <Icon className="h-6 w-6 shrink-0" active={active} />
        <span className="truncate">{item.label}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium transition active:scale-95 ${
        active ? "text-indigo-600" : "text-slate-500"
      }`}
    >
      <Icon className="h-6 w-6 shrink-0" active={active} />
      <span>{item.label}</span>
    </button>
  );
}

function AppShell({
  tab,
  setTab,
  mineSubPage,
  setMineSubPage,
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  mineSubPage: MineSubPage;
  setMineSubPage: (page: MineSubPage) => void;
}) {
  return (
    <div className="app-shell min-h-dvh bg-slate-100 md:pl-[9.5rem] lg:pl-52">
      <aside className="app-sidebar hidden md:flex">
        <div className="flex h-full w-full flex-col border-r border-slate-200/80 bg-white/95 px-2 py-4 backdrop-blur">
          <div className="mb-4 hidden px-2 md:block">
            <p className="text-sm font-bold text-slate-800">作业计划表</p>
            <p className="text-xs text-slate-400">平板 / 桌面版</p>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {navItems.map((item) => (
              <NavButton
                key={item.key}
                item={item}
                active={tab === item.key}
                onClick={() => setTab(item.key)}
                layout="side"
              />
            ))}
          </nav>
        </div>
      </aside>

      <header className="app-header sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-3 py-2 md:px-6">
          <PlanSelect />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
        {tab === "dashboard" && <DashboardView onGoDaily={() => setTab("daily")} />}
        {tab === "daily" && <DailyPlanView />}
        {tab === "schedule" && <WeeklyScheduleView />}
        {tab === "tasks" && <TasksView />}
        {tab === "mine" && <MineView subPage={mineSubPage} onSubPageChange={setMineSubPage} />}
      </main>

      <nav className="bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {navItems.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={tab === item.key}
              onClick={() => setTab(item.key)}
              layout="bottom"
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function AppContent() {
  const [tab, setTab] = useState<Tab>("daily");
  const [mineSubPage, setMineSubPage] = useState<MineSubPage>("hub");
  const { plans, loading } = usePlan();

  useEffect(() => {
    if (tab !== "mine") setMineSubPage("hub");
  }, [tab]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 text-slate-500">
        加载中...
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="app-shell min-h-dvh bg-slate-100">
        <header className="app-header sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
          <h1 className="mx-auto max-w-3xl text-lg font-bold text-slate-800">作业计划表</h1>
          <p className="mx-auto max-w-3xl text-sm text-slate-500">先创建一个计划</p>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-4 pb-6 md:px-8 md:py-8">
          <MineView subPage={mineSubPage} onSubPageChange={setMineSubPage} />
        </main>
      </div>
    );
  }

  return (
    <AppShell
      tab={tab}
      setTab={setTab}
      mineSubPage={mineSubPage}
      setMineSubPage={setMineSubPage}
    />
  );
}
