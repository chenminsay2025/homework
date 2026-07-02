import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { percent } from "../api";
import type { Subject, Task } from "../types";

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const orderA = a.subject?.sort_order ?? 999;
    const orderB = b.subject?.sort_order ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    const nameA = a.subject?.name ?? "未分类";
    const nameB = b.subject?.name ?? "未分类";
    if (nameA !== nameB) return nameA.localeCompare(nameB, "zh-CN");
    return a.sort_order - b.sort_order || a.id - b.id;
  });
}

function SubjectIcon({ subject }: { subject: Subject | null }) {
  const color = subject?.color ?? "#94a3b8";
  const letter = (subject?.name ?? "?").slice(0, 1);
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

function TaskPickerItem({
  task,
  selected,
  onSelect,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
}) {
  const ratio = Math.min(task.progress_ratio, 1);
  const color = task.subject?.color ?? "#6366f1";

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`relative mb-0.5 w-full overflow-hidden rounded-lg text-left last:mb-0 ${
        selected ? "ring-1 ring-indigo-200" : ""
      }`}
    >
      <div
        className="absolute inset-y-0 left-0"
        style={{ width: `${ratio * 100}%`, backgroundColor: `${color}20` }}
        aria-hidden
      />
      <div
        className={`relative flex items-center gap-2 px-2 py-2 ${
          selected ? "text-indigo-800" : "text-slate-700"
        }`}
      >
        <SubjectIcon subject={task.subject ?? null} />
        <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
        <span className="shrink-0 text-xs text-slate-500">
          {task.completed_units}/{task.total_units} {task.unit_label}
        </span>
        <span className="w-9 shrink-0 text-right text-xs text-slate-400">{percent(task.progress_ratio)}</span>
        {selected && <span className="shrink-0 text-indigo-600">✓</span>}
      </div>
    </button>
  );
}

function TaskPickerList({
  tasks,
  value,
  onChange,
  className = "",
  allowNone = false,
  noneLabel = "不指定",
}: {
  tasks: Task[];
  value: number;
  onChange: (taskId: number) => void;
  className?: string;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  return (
    <div className={className}>
      {allowNone && (
        <button
          type="button"
          role="option"
          aria-selected={value <= 0}
          onClick={() => onChange(0)}
          className={`mb-0.5 flex w-full items-center rounded-lg px-2 py-2 text-left text-sm ${
            value <= 0 ? "bg-indigo-50 font-medium text-indigo-800" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="flex-1">{noneLabel}</span>
          {value <= 0 && <span className="text-indigo-600">✓</span>}
        </button>
      )}
      {tasks.map((task) => (
        <TaskPickerItem
          key={task.id}
          task={task}
          selected={task.id === value}
          onSelect={() => onChange(task.id)}
        />
      ))}
    </div>
  );
}

const MENU_GAP = 4;
const VIEWPORT_PADDING = 8;
const PREFERRED_MAX_HEIGHT = 280;

interface TaskPickerProps {
  tasks: Task[];
  value: number;
  onChange: (taskId: number) => void;
  placeholder?: string;
  disabled?: boolean;
  variant?: "list" | "dropdown";
  className?: string;
  /** 允许不选任务（value 为 0） */
  allowNone?: boolean;
}

export default function TaskPicker({
  tasks,
  value,
  onChange,
  placeholder = "请选择任务",
  disabled = false,
  variant = "dropdown",
  className = "",
  allowNone = false,
}: TaskPickerProps) {
  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const selected = value > 0 ? tasks.find((t) => t.id === value) : undefined;

  if (variant === "list") {
    if (tasks.length === 0) {
      return <p className="text-sm text-amber-600">暂无任务，请先在「任务」页添加</p>;
    }
    return (
      <TaskPickerList
        tasks={sortedTasks}
        value={value}
        onChange={onChange}
        className={`max-h-[min(16rem,45vh)] overflow-y-auto rounded-lg border border-slate-100 p-1 ${className}`}
      />
    );
  }

  return (
      <TaskPickerDropdown
      tasks={sortedTasks}
      value={value}
      selected={selected}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      allowNone={allowNone}
    />
  );
}

function TaskPickerDropdown({
  tasks,
  value,
  selected,
  onChange,
  placeholder,
  disabled,
  className,
  allowNone,
}: {
  tasks: Task[];
  value: number;
  selected: Task | undefined;
  onChange: (taskId: number) => void;
  placeholder: string;
  disabled: boolean;
  className: string;
  allowNone: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [listStyle, setListStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const updatePosition = () => {
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const contentHeight = list?.scrollHeight ?? PREFERRED_MAX_HEIGHT;
    const idealHeight = Math.min(contentHeight, PREFERRED_MAX_HEIGHT);
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING - MENU_GAP;
    const spaceAbove = rect.top - VIEWPORT_PADDING - MENU_GAP;
    const opensUp = spaceBelow < idealHeight && spaceAbove > spaceBelow;
    const available = opensUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(idealHeight, available));

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      boxShadow: opensUp
        ? "0 -10px 15px -3px rgb(15 23 42 / 0.12), 0 -4px 6px -4px rgb(15 23 42 / 0.08)"
        : "0 10px 15px -3px rgb(15 23 42 / 0.12), 0 4px 6px -4px rgb(15 23 42 / 0.08)",
      overflow: "hidden",
      borderRadius: "0.75rem",
      ...(opensUp
        ? { bottom: window.innerHeight - rect.top + MENU_GAP }
        : { top: rect.bottom + MENU_GAP }),
    });
    setListStyle({ maxHeight });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(raf);
  }, [open, tasks.length]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const reposition = () => updatePosition();
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const pick = (taskId: number) => {
    onChange(taskId);
    setOpen(false);
  };

  if (tasks.length === 0) {
    return <p className="text-sm text-amber-600">暂无任务，请先在「任务」页添加</p>;
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`input flex w-full items-center justify-between gap-2 text-left ${
          disabled ? "cursor-not-allowed opacity-50" : "active:bg-slate-50"
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-slate-800" : "text-slate-400"}`}>
          {selected ? selected.title : placeholder}
        </span>
        <span className={`shrink-0 text-xs text-slate-400 transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div style={menuStyle} className="scroll-inset z-[70] border border-slate-200 bg-white">
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            style={listStyle}
            className="scroll-inset-y overflow-y-auto p-1"
          >
            <TaskPickerList tasks={tasks} value={value} onChange={pick} allowNone={allowNone} />
          </div>
        </div>
      )}
    </div>
  );
}

export { SubjectIcon };
