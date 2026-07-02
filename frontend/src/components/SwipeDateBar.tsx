import { useEffect, useRef, useState } from "react";
import { addDaysToDateStr, formatDisplayDate } from "../api";
import DatePickerSheet from "./DatePickerSheet";

const ITEM_WIDTH = 112;
const STRIP_RANGE = 45;
const SAMPLE_MS = 100;
const MAX_FLING_VELOCITY = 1.2;
const SNAP_MS = 220;

const STRIP_OFFSETS = Array.from({ length: STRIP_RANGE * 2 + 1 }, (_, i) => i - STRIP_RANGE);
/** offset=0 的格子中心，相对整条左缘的像素距离 */
const STRIP_CENTER_PX = STRIP_RANGE * ITEM_WIDTH + ITEM_WIDTH / 2;

const COLOR_CENTER = { r: 15, g: 23, b: 42 };
const COLOR_SIDE = { r: 203, g: 213, b: 225 };
const WEIGHT_CENTER = 600;
const WEIGHT_SIDE = 400;

function velocityPxPerMs(samples: { t: number; x: number }[]): number {
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  const v = (last.x - first.x) / dt;
  return Math.max(-MAX_FLING_VELOCITY, Math.min(MAX_FLING_VELOCITY, v));
}

/** 与中心距离连续渐变：中间 semibold 深色，两侧 normal 更淡 */
function itemStyle(scrollPx: number, offset: number): { color: string; fontWeight: number } {
  const dist = Math.abs(offset - scrollPx / ITEM_WIDTH);
  const t = Math.min(1, dist * 0.55);
  const r = Math.round(COLOR_CENTER.r + (COLOR_SIDE.r - COLOR_CENTER.r) * t);
  const g = Math.round(COLOR_CENTER.g + (COLOR_SIDE.g - COLOR_CENTER.g) * t);
  const b = Math.round(COLOR_CENTER.b + (COLOR_SIDE.b - COLOR_CENTER.b) * t);
  const fontWeight = Math.round(WEIGHT_CENTER + (WEIGHT_SIDE - WEIGHT_CENTER) * t);
  return { color: `rgb(${r}, ${g}, ${b})`, fontWeight };
}

type Props = {
  value: string;
  onChange: (date: string) => void;
  className?: string;
};

export default function SwipeDateBar({ value, onChange, className = "" }: Props) {
  const [scrollPx, setScrollPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [anchorDate, setAnchorDate] = useState(value);
  const [pickerOpen, setPickerOpen] = useState(false);

  const startXRef = useRef(0);
  const startScrollRef = useRef(0);
  const startYRef = useRef(0);
  const samplesRef = useRef<{ t: number; x: number }[]>([]);
  const draggingRef = useRef(false);
  const activeRef = useRef(false);
  const suppressClickRef = useRef(false);
  const committedRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const pickerClosingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const capturePointerIdRef = useRef<number | null>(null);

  onChangeRef.current = onChange;

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!dragging && !animating) {
      setAnchorDate(value);
      setScrollPx(0);
      committedRef.current = false;
    }
  }, [value, dragging, animating]);

  const stopAnim = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAnimating(false);
  };

  const commitIfNeeded = (px: number) => {
    if (committedRef.current) return;
    const dayDelta = Math.round(px / ITEM_WIDTH);
    if (dayDelta === 0) return;
    committedRef.current = true;
    onChangeRef.current(addDaysToDateStr(anchorDate, dayDelta));
  };

  const snapVisual = (fromPx: number) => {
    stopAnim();
    const target = Math.round(fromPx / ITEM_WIDTH) * ITEM_WIDTH;
    if (Math.abs(fromPx - target) < 0.5) {
      setScrollPx(0);
      return;
    }
    setAnimating(true);
    const start = fromPx;
    const startTime = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / SNAP_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setScrollPx(start + (target - start) * eased);
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
        setAnimating(false);
        setScrollPx(0);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  };

  const settleGesture = (px: number, velocity: number) => {
    if (Math.abs(velocity) >= 0.05) {
      stopAnim();
      setAnimating(true);
      let pos = px;
      let v = -velocity;
      let last = performance.now();

      const tick = (now: number) => {
        const dt = Math.min(32, now - last);
        last = now;
        pos += v * dt;
        v *= Math.pow(0.88, dt / 16);
        setScrollPx(pos);
        if (Math.abs(v) > 0.035) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          animFrameRef.current = null;
          commitIfNeeded(pos);
          snapVisual(pos);
        }
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } else {
      commitIfNeeded(px);
      snapVisual(px);
    }
  };

  const finishDrag = (clientX: number) => {
    if (!draggingRef.current) return;
    const dx = startXRef.current - clientX;
    const px = startScrollRef.current + dx;
    const velocity = velocityPxPerMs(samplesRef.current);

    draggingRef.current = false;
    setDragging(false);
    samplesRef.current = [];

    if (Math.abs(dx) >= 8) suppressClickRef.current = true;

    settleGesture(px, velocity);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (pickerOpen || e.button !== 0) return;
    stopAnim();
    activeRef.current = true;
    capturePointerIdRef.current = e.pointerId;
    setAnchorDate(value);
    committedRef.current = false;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startScrollRef.current = scrollPx;
    samplesRef.current = [{ t: Date.now(), x: e.clientX }];
    draggingRef.current = false;
    suppressClickRef.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pickerOpen || !activeRef.current) return;
    const dx = startXRef.current - e.clientX;
    const dy = e.clientY - startYRef.current;
    if (!draggingRef.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        activeRef.current = false;
        return;
      }
      draggingRef.current = true;
      setDragging(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(capturePointerIdRef.current ?? e.pointerId);
      } catch {
        /* ignore */
      }
    }
    e.preventDefault();
    const now = Date.now();
    samplesRef.current.push({ t: now, x: e.clientX });
    samplesRef.current = samplesRef.current.filter((s) => now - s.t <= SAMPLE_MS);
    setScrollPx(startScrollRef.current + dx);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!activeRef.current) return;
    const wasDragging = draggingRef.current;
    activeRef.current = false;
    if (wasDragging) {
      finishDrag(e.clientX);
    } else {
      handleTap(e.clientX);
    }
    capturePointerIdRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const moving = dragging || animating;
  const labelBaseDate = dragging || animating ? anchorDate : value;

  const isCenterOffset = (offset: number) =>
    Math.abs(offset - scrollPx / ITEM_WIDTH) < 0.35;

  const handleItemClick = (offset: number) => {
    if (pickerOpen || pickerClosingRef.current || moving) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (isCenterOffset(offset)) {
      setPickerOpen(true);
      return;
    }
    const date = addDaysToDateStr(labelBaseDate, offset);
    stopAnim();
    setAnchorDate(date);
    committedRef.current = true;
    setScrollPx(0);
    onChange(date);
  };

  const offsetFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const relativeX = clientX - (rect.left + rect.width / 2);
    const offset = Math.round((relativeX + scrollPx) / ITEM_WIDTH);
    return Math.max(-STRIP_RANGE, Math.min(STRIP_RANGE, offset));
  };

  const handleTap = (clientX: number) => {
    handleItemClick(offsetFromClientX(clientX));
  };

  const closePicker = () => {
    pickerClosingRef.current = true;
    setPickerOpen(false);
    window.setTimeout(() => {
      pickerClosingRef.current = false;
    }, 300);
  };

  return (
    <>
      <div
        ref={containerRef}
        className={`relative block min-w-0 flex-1 cursor-pointer touch-pan-y ${pickerOpen ? "pointer-events-none" : ""} ${className}`.trim()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="relative z-0 h-9 overflow-hidden">
          <div
            className="absolute inset-y-0 left-1/2 flex items-center will-change-transform"
            style={{
              transform: `translate3d(calc(-${STRIP_CENTER_PX}px - ${scrollPx}px), 0, 0)`,
              transition: moving ? "none" : undefined,
            }}
          >
            {STRIP_OFFSETS.map((offset) => {
              const dateStr = addDaysToDateStr(labelBaseDate, offset);
              const style = itemStyle(scrollPx, offset);
              return (
                <div
                  key={offset}
                  className="shrink-0 text-center"
                  style={{ width: ITEM_WIDTH }}
                >
                  <span
                    className="inline-block whitespace-nowrap text-sm"
                    style={{ color: style.color, fontWeight: style.fontWeight }}
                  >
                    {formatDisplayDate(dateStr)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <DatePickerSheet
        open={pickerOpen}
        value={value}
        onClose={closePicker}
        onConfirm={(date) => {
          stopAnim();
          setAnchorDate(date);
          committedRef.current = true;
          setScrollPx(0);
          onChange(date);
        }}
        title="选择日期"
      />
    </>
  );
}
