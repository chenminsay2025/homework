import { useEffect, useMemo, useState } from "react";
import { formatDate, formatDisplayDate, parseLocalDate } from "../api";
import SheetModal from "./SheetModal";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;

function monthGrid(year: number, month: number): (Date | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

type Props = {
  open: boolean;
  value: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title?: string;
  allowClear?: boolean;
};

export default function DatePickerSheet({
  open,
  value,
  onClose,
  onConfirm,
  title = "选择日期",
  allowClear = false,
}: Props) {
  const [viewDate, setViewDate] = useState(() => parseLocalDate(value || formatDate(new Date())));
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!open) return;
    const base = value || formatDate(new Date());
    const d = parseLocalDate(base);
    setViewDate(d);
    setDraft(value);
  }, [open, value]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const todayStr = formatDate(new Date());
  const activeDateStr = draft || value || todayStr;

  const cells = useMemo(() => monthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const pick = (date: Date) => {
    const next = formatDate(date);
    setDraft(next);
    onConfirm(next);
    onClose();
  };

  const pickToday = () => {
    const d = parseLocalDate(todayStr);
    setViewDate(d);
    pick(d);
  };

  const clear = () => {
    onConfirm("");
    onClose();
  };

  return (
    <SheetModal open={open} onClose={onClose}>
      <div className="sheet-scroll !pb-4">
        <div className="sheet-handle" />
        <h3 className="text-center text-base font-semibold text-slate-800">{title}</h3>
        {activeDateStr ? (
          <p className="mt-1 text-center text-sm text-slate-500">{formatDisplayDate(activeDateStr)}</p>
        ) : (
          <p className="mt-1 text-center text-sm text-slate-400">未设置</p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-slate-500 active:bg-slate-100"
            onClick={(e) => {
              e.stopPropagation();
              shiftMonth(-1);
            }}
            aria-label="上个月"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-slate-800">
            {viewYear}年{viewMonth + 1}月
          </span>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-slate-500 active:bg-slate-100"
            onClick={(e) => {
              e.stopPropagation();
              shiftMonth(1);
            }}
            aria-label="下个月"
          >
            ›
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-y-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 text-center text-xs font-medium text-slate-400">
              {w}
            </div>
          ))}
          {cells.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="h-10" aria-hidden />;
            }
            const dateStr = formatDate(date);
            const selected = activeDateStr === dateStr;
            const isToday = dateStr === todayStr;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pick(date);
                }}
                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition active:scale-95 ${
                  selected
                    ? "bg-indigo-600 font-semibold text-white shadow-sm"
                    : isToday
                      ? "font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-200"
                      : "text-slate-700 active:bg-slate-100"
                }`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn-secondary flex-1 text-sm"
            onClick={(e) => {
              e.stopPropagation();
              pickToday();
            }}
          >
            今天
          </button>
          {allowClear && (
            <button
              type="button"
              className="btn-secondary flex-1 text-sm"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
            >
              清除
            </button>
          )}
          <button
            type="button"
            className="btn-secondary flex-1 text-sm"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            取消
          </button>
        </div>
      </div>
    </SheetModal>
  );
}

/** 设置页等场景：按钮展示当前值，点击打开统一日期弹窗 */
export function DatePickerField({
  value,
  onChange,
  placeholder = "选择日期",
  title,
  allowClear = false,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  allowClear?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`min-h-[2.75rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm outline-none transition active:bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
          value ? "text-slate-800" : "text-slate-400"
        } ${className}`.trim()}
      >
        {value ? formatDisplayDate(value) : placeholder}
      </button>
      <DatePickerSheet
        open={open}
        value={value}
        onClose={() => setOpen(false)}
        onConfirm={onChange}
        title={title}
        allowClear={allowClear}
      />
    </>
  );
}
