import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  activityColor,
  formatLocationName,
  formatTimeRange,
  WEEKDAYS,
} from "../api";
import type { ScheduleSlot } from "../types";

const ACTION_WIDTH = 128;
const LONG_PRESS_MS = 500;

const WEEKDAY_SHORT = ["一", "二", "三", "四", "五", "六", "日"];

export function getTodayWeekday(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function timeKey(slot: ScheduleSlot): string {
  if (slot.is_all_day) return "all_day";
  return `${slot.start_time || ""}|${slot.end_time || ""}`;
}

function RowTimeLabel({ rowKey, large = false }: { rowKey: string; large?: boolean }) {
  if (rowKey === "all_day") {
    return <span className={large ? "text-sm" : ""}>全天</span>;
  }
  const [start, end] = rowKey.split("|");
  const startLabel = start?.slice(0, 5) || "";
  const endLabel = end?.slice(0, 5) || "";
  if (!startLabel || !endLabel) return null;
  return (
    <span className={large ? "text-sm leading-tight" : "leading-tight"}>
      {startLabel}
      <br />
      {endLabel}
    </span>
  );
}

function buildTimeRows(slots: ScheduleSlot[]): string[] {
  const keys = new Set(slots.map(timeKey));
  return [...keys].sort((a, b) => {
    if (a === "all_day") return 1;
    if (b === "all_day") return -1;
    return a.localeCompare(b);
  });
}

function GridCell({
  slot,
  onEdit,
  expanded = false,
}: {
  slot: ScheduleSlot;
  onEdit: (slot: ScheduleSlot) => void;
  expanded?: boolean;
}) {
  const color = activityColor(slot.activity, slot.course);

  return (
    <button
      type="button"
      onClick={() => onEdit(slot)}
      className="schedule-lesson-block w-full"
    >
      <span className="schedule-lesson-dot" style={{ backgroundColor: color }} />
      <div className="schedule-lesson-body">
        <div className={`schedule-lesson-title truncate${expanded ? " text-sm" : ""}`}>
          {slot.activity}
        </div>
        {!slot.is_all_day && slot.location && (
          <div className="schedule-lesson-location">{slot.location.name}</div>
        )}
      </div>
    </button>
  );
}

function ScheduleGridTable({
  slots,
  onEdit,
  expanded = false,
}: {
  slots: ScheduleSlot[];
  onEdit: (slot: ScheduleSlot) => void;
  expanded?: boolean;
}) {
  const timeRows = buildTimeRows(slots);
  const today = getTodayWeekday();
  const gridClass = expanded
    ? "schedule-grid schedule-grid-expanded landscape-schedule-table"
    : "schedule-grid schedule-grid-compact";

  const headTimeClass = "schedule-grid-cell schedule-grid-time schedule-grid-head";
  const headDayClass = "schedule-grid-cell schedule-grid-head";
  const bodyTimeClass = "schedule-grid-cell schedule-grid-time";

  return (
    <div className="schedule-grid-outer">
      <div
        className={gridClass}
        style={{ gridTemplateRows: `auto repeat(${timeRows.length}, auto)` }}
      >
        <div className={headTimeClass} style={{ gridColumn: 1, gridRow: 1 }}>
          时间
        </div>
        {WEEKDAYS.map((day, i) => (
          <div
            key={`head-${day.value}`}
            className={`${headDayClass}${day.value === today ? " schedule-grid-today-head" : ""}`}
            style={{ gridColumn: i + 2, gridRow: 1 }}
          >
            {WEEKDAY_SHORT[i]}
          </div>
        ))}

        {timeRows.map((key, rowIdx) => {
          const gridRow = rowIdx + 2;
          return (
            <Fragment key={key}>
              <div
                className={`${bodyTimeClass}${expanded ? " landscape-grid-row" : ""}`}
                style={{
                  gridColumn: 1,
                  gridRow,
                  ...(expanded ? { animationDelay: `${(rowIdx + 1) * 0.04}s` } : {}),
                }}
              >
                <RowTimeLabel rowKey={key} large={expanded} />
              </div>
              {WEEKDAYS.map((day, dayIdx) => {
                const cellSlots = slots
                  .filter((s) => s.weekday === day.value && timeKey(s) === key)
                  .sort((a, b) => a.sort_order - b.sort_order);
                const isToday = day.value === today;
                return (
                  <div
                    key={`${key}-${day.value}`}
                    className={`schedule-grid-cell${isToday ? " schedule-grid-today-cell" : ""}`}
                    style={{ gridColumn: dayIdx + 2, gridRow }}
                  >
                    {cellSlots.length === 0 ? (
                      <span className="schedule-empty-dot">·</span>
                    ) : (
                      <div className="flex w-full flex-col gap-1">
                        {cellSlots.map((s) => (
                          <GridCell key={s.id} slot={s} onEdit={onEdit} expanded={expanded} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function LandscapeScheduleOverlay({
  slots,
  onEdit,
  onClose,
}: {
  slots: ScheduleSlot[];
  onEdit: (slot: ScheduleSlot) => void;
  onClose: () => void;
}) {
  const [portrait, setPortrait] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(orientation: portrait)").matches : true,
  );

  useEffect(() => {
    const media = window.matchMedia("(orientation: portrait)");
    const update = () => setPortrait(media.matches);
    update();
    media.addEventListener("change", update);
    window.addEventListener("orientationchange", update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const lock = async () => {
      try {
        await (screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> })?.lock?.("landscape");
      } catch {
        /* 浏览器可能不支持，使用 CSS 旋转兜底 */
      }
    };
    void lock();
    return () => {
      document.body.style.overflow = prev;
      try {
        screen.orientation?.unlock?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const content = (
    <div className="landscape-schedule-frame">
      <header className="landscape-schedule-header flex shrink-0 items-center justify-between gap-3 rounded-2xl px-5 py-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <span className="landscape-schedule-icon" aria-hidden>
              📅
            </span>
            周课表
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-normal">横屏</span>
          </h3>
          <p className="mt-0.5 text-xs text-indigo-100">点击课程编辑</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="landscape-schedule-close shrink-0 rounded-xl bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur active:bg-white/25"
        >
          ✕ 关闭
        </button>
      </header>
      <div className="landscape-schedule-body">
        {slots.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">暂无课表</div>
        ) : (
          <div className="schedule-card landscape-schedule-panel overflow-hidden">
            <div className="schedule-grid-scroll">
              <ScheduleGridTable slots={slots} onEdit={onEdit} expanded />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="landscape-schedule-shell">
      <div className={portrait ? "landscape-schedule-rotated" : "h-full w-full min-h-0"}>{content}</div>
    </div>
  );
}

export default function WeeklyScheduleGrid({
  slots,
  onEdit,
  onLandscapeOpen,
  onAdd,
}: {
  slots: ScheduleSlot[];
  onEdit: (slot: ScheduleSlot) => void;
  onLandscapeOpen?: () => void;
  onAdd?: () => void;
}) {
  if (slots.length === 0) {
    return (
      <div className="schedule-card">
        <div className="py-12 text-center text-sm text-slate-400">暂无课表，先添加时段</div>
        {onAdd && (
          <div className="schedule-toolbar justify-end">
            <button type="button" onClick={onAdd} className="schedule-btn-primary-dark">
              <span>＋</span> 添加时段
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="schedule-card">
      <div className="schedule-grid-scroll">
        <ScheduleGridTable slots={slots} onEdit={onEdit} />
      </div>
      <div className="schedule-toolbar">
        {onLandscapeOpen ? (
          <button type="button" onClick={onLandscapeOpen} className="schedule-btn-outline">
            <span>🔄</span> 横屏查看
          </button>
        ) : (
          <span />
        )}
        {onAdd && (
          <button type="button" onClick={onAdd} className="schedule-btn-primary-dark">
            <span>＋</span> 添加时段
          </button>
        )}
      </div>
    </div>
  );
}

function SlotRowContent({ slot }: { slot: ScheduleSlot }) {
  return (
    <>
      <span
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: activityColor(slot.activity, slot.course) }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{slot.activity}</span>
          {slot.course?.teacher && (
            <span className="text-xs text-slate-400">{slot.course.teacher}</span>
          )}
          <span className="badge bg-slate-100 text-xs text-slate-600">
            {slot.slot_type === "class" ? "培训班" : "自安排"}
          </span>
          <span className="text-sm text-slate-500">
            {formatTimeRange(slot.start_time, slot.end_time, slot.is_all_day)}
          </span>
        </div>
        {!slot.is_all_day && (
          <p className="text-sm text-slate-500">📍 {formatLocationName(slot.location)}</p>
        )}
      </div>
    </>
  );
}

export function ScheduleSlotRow({
  slot,
  onEdit,
  onDelete,
  swipeOpen = false,
  onSwipeOpenChange,
  highlightToday = false,
}: {
  slot: ScheduleSlot;
  onEdit: (slot: ScheduleSlot) => void;
  onDelete: (id: number, options?: { skipConfirm?: boolean }) => void;
  swipeOpen?: boolean;
  onSwipeOpenChange?: (open: boolean) => void;
  highlightToday?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const startRef = useRef({ x: 0, y: 0, base: 0 });
  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);

  const updateOffset = useCallback((value: number) => {
    offsetRef.current = value;
    setOffset(value);
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  const setOpen = useCallback(
    (open: boolean) => {
      onSwipeOpenChange?.(open);
      updateOffset(open ? ACTION_WIDTH : 0);
    },
    [onSwipeOpenChange, updateOffset],
  );

  useEffect(() => {
    if (swipeOpen) updateOffset(ACTION_WIDTH);
    else if (!dragging) updateOffset(0);
  }, [swipeOpen, dragging, updateOffset]);

  const beginLongPress = () => {
    clearLongPress();
    longPressRef.current = setTimeout(() => {
      suppressClickRef.current = true;
      navigator.vibrate?.(10);
      setShowActionSheet(true);
    }, LONG_PRESS_MS);
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    startRef.current = { x: clientX, y: clientY, base: swipeOpen ? ACTION_WIDTH : offsetRef.current };
    suppressClickRef.current = false;
    draggingRef.current = false;
    setDragging(false);
    beginLongPress();
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    clearLongPress();
    const dx = clientX - startRef.current.x;
    const dy = clientY - startRef.current.y;
    if (!draggingRef.current && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (!draggingRef.current && Math.abs(dy) > Math.abs(dx)) return;
    draggingRef.current = true;
    setDragging(true);
    const next = Math.max(0, Math.min(ACTION_WIDTH, startRef.current.base - dx));
    updateOffset(next);
  };

  const handleDragEnd = () => {
    clearLongPress();
    if (draggingRef.current) {
      suppressClickRef.current = true;
      if (offsetRef.current > ACTION_WIDTH / 2) setOpen(true);
      else setOpen(false);
      draggingRef.current = false;
      setDragging(false);
    }
  };

  const handleContentClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (swipeOpen || offsetRef.current > 0) setOpen(false);
  };

  const slideX = dragging ? offset : swipeOpen ? ACTION_WIDTH : offset;

  return (
    <>
      <div className="relative overflow-hidden" data-swipe-row>
        <div
          className="absolute inset-y-0 right-0 flex text-sm font-medium text-white"
          style={{ width: ACTION_WIDTH }}
        >
          <button
            type="button"
            className="flex flex-1 items-center justify-center bg-indigo-500 active:bg-indigo-600"
            onClick={() => {
              setOpen(false);
              onEdit(slot);
            }}
          >
            编辑
          </button>
          <button
            type="button"
            className="flex flex-1 items-center justify-center bg-red-500 active:bg-red-600"
            onClick={() => {
              setOpen(false);
              onDelete(slot.id);
            }}
          >
            删除
          </button>
        </div>
        <div
          className={`relative ${highlightToday ? "schedule-grid-today-cell" : "bg-white"} ${dragging ? "" : "transition-transform duration-200 ease-out"}`}
          style={{ transform: `translateX(-${slideX}px)`, touchAction: "pan-y" }}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          onTouchCancel={handleDragEnd}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            handleDragStart(e.clientX, e.clientY);
            const onMove = (ev: MouseEvent) => handleDragMove(ev.clientX, ev.clientY);
            const onUp = () => {
              handleDragEnd();
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={handleContentClick}
            className="flex w-full cursor-default items-center gap-3 px-4 py-3 text-left"
          >
            <SlotRowContent slot={slot} />
          </div>
        </div>
      </div>

      {showActionSheet && (
        <div className="sheet-backdrop z-[60]" onClick={() => setShowActionSheet(false)}>
          <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="action-sheet-title">
              <p>{slot.activity}</p>
              <p className="action-sheet-subtitle">
                {slot.slot_type === "class" ? "培训班" : "自安排"}
                {" · "}
                {formatTimeRange(slot.start_time, slot.end_time, slot.is_all_day)}
                {!slot.is_all_day && slot.location && ` · ${formatLocationName(slot.location)}`}
              </p>
            </div>
            <div className="action-sheet-group">
              <button
                type="button"
                className="action-sheet-item text-indigo-600"
                onClick={() => {
                  setShowActionSheet(false);
                  onEdit(slot);
                }}
              >
                编辑
              </button>
              <button
                type="button"
                className="action-sheet-item text-red-600"
                onClick={() => {
                  setShowActionSheet(false);
                  onDelete(slot.id);
                }}
              >
                删除
              </button>
            </div>
            <div className="action-sheet-cancel">
              <button
                type="button"
                className="action-sheet-item"
                onClick={() => setShowActionSheet(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
