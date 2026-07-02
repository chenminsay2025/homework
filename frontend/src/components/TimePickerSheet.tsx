import { useEffect, useRef, useState } from "react";
import SheetModal from "./SheetModal";

const ROW_H = 44;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function parseTimeValue(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map(Number);
  const hour = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9;
  let minute = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0;
  minute = Math.round(minute / 5) * 5;
  if (minute === 60) minute = 0;
  return { hour, minute };
}

export function formatTimeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function TimeScrollColumn({
  values,
  selected,
  onSelect,
  format,
}: {
  values: number[];
  selected: number;
  onSelect: (v: number) => void;
  format: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = values.indexOf(selected);
    if (idx >= 0) el.scrollTop = idx * ROW_H;
  }, [selected, values]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const idx = Math.round(el.scrollTop / ROW_H);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      el.scrollTop = clamped * ROW_H;
      const next = values[clamped];
      if (next !== selected) onSelect(next);
    }, 80);
  };

  return (
    <div className="relative h-[220px] flex-1">
      <div className="pointer-events-none absolute inset-x-1 top-1/2 z-0 h-11 -translate-y-1/2 rounded-xl border border-indigo-100 bg-indigo-50/90" />
      <div
        ref={ref}
        className="relative z-10 h-full overflow-y-auto overscroll-y-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory" }}
        onScroll={handleScroll}
      >
        <div style={{ height: ROW_H * 2 }} aria-hidden />
        {values.map((v) => {
          const active = v === selected;
          return (
            <button
              key={v}
              type="button"
              className={`flex h-11 w-full snap-center items-center justify-center text-lg tabular-nums transition ${
                active ? "font-semibold text-indigo-700" : "text-slate-400"
              }`}
              style={{ scrollSnapAlign: "center" }}
              onClick={() => {
                const el = ref.current;
                if (!el) return;
                const idx = values.indexOf(v);
                el.scrollTop = idx * ROW_H;
                onSelect(v);
              }}
            >
              {format(v)}
            </button>
          );
        })}
        <div style={{ height: ROW_H * 2 }} aria-hidden />
      </div>
    </div>
  );
}

type SheetProps = {
  open: boolean;
  value: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title?: string;
};

export default function TimePickerSheet({
  open,
  value,
  onClose,
  onConfirm,
  title = "选择时间",
}: SheetProps) {
  const parsed = parseTimeValue(value || "09:00");
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);

  useEffect(() => {
    if (!open) return;
    const next = parseTimeValue(value || "09:00");
    setHour(next.hour);
    setMinute(next.minute);
  }, [open, value]);

  if (!open) return null;

  const draft = formatTimeValue(hour, minute);

  const confirm = () => {
    onConfirm(draft);
    onClose();
  };

  return (
    <SheetModal open={open} onClose={onClose}>
      <div className="sheet-scroll !pb-4">
        <div className="sheet-handle" />
        <h3 className="text-center text-base font-semibold text-slate-800">{title}</h3>
        <p className="mt-2 text-center text-3xl font-semibold tabular-nums tracking-wider text-slate-800">
          {draft}
        </p>

        <div className="mt-4 flex items-center gap-2 px-2">
          <TimeScrollColumn
            values={HOURS}
            selected={hour}
            onSelect={setHour}
            format={(v) => String(v).padStart(2, "0")}
          />
          <span className="pb-1 text-2xl font-light text-slate-300">:</span>
          <TimeScrollColumn
            values={MINUTES}
            selected={minute}
            onSelect={setMinute}
            format={(v) => String(v).padStart(2, "0")}
          />
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">滑动选择 · 每 5 分钟一档</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-primary text-sm" onClick={confirm}>
            确定
          </button>
        </div>
      </div>
    </SheetModal>
  );
}

export function TimePickerField({
  value,
  onChange,
  placeholder = "选择时间",
  title,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`input min-h-[2.75rem] text-left tabular-nums ${value ? "text-slate-800" : "text-slate-400"} ${className}`.trim()}
      >
        {value ? value.slice(0, 5) : placeholder}
      </button>
      <TimePickerSheet
        open={open}
        value={value || "09:00"}
        onClose={() => setOpen(false)}
        onConfirm={onChange}
        title={title}
      />
    </>
  );
}
