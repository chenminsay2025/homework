import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type View = { scale: number; x: number; y: number };

const MIN_FIT_RATIO = 0.5;
const MAX_ZOOM_RATIO = 5;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function touchDist(touches: TouchList) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function touchMid(touches: TouchList) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

/** 跨平台预览缩放：默认适配宽度；移动端双指缩放/拖动，桌面滚轮缩放/鼠标拖动 */
export default function PinchPanViewer({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const fitScaleRef = useRef(1);
  const minScaleRef = useRef(MIN_FIT_RATIO);
  const maxScaleRef = useRef(MAX_ZOOM_RATIO);
  const fittedRef = useRef(false);
  const userAdjustedRef = useRef(false);

  const pinchRef = useRef<{
    dist: number;
    scale: number;
    contentX: number;
    contentY: number;
  } | null>(null);

  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const measure = useCallback(() => {
    const viewport = rootRef.current;
    const inner = innerRef.current;
    if (!viewport || !inner) return null;

    const cw = inner.scrollWidth;
    const ch = inner.scrollHeight;
    if (cw < 4 || ch < 4) return null;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const fit = Math.min(vw / cw, 1);

    fitScaleRef.current = fit;
    minScaleRef.current = fit * MIN_FIT_RATIO;
    maxScaleRef.current = Math.max(fit * MAX_ZOOM_RATIO, fit + 0.5);

    const scaledW = cw * fit;
    const scaledH = ch * fit;
    const x = scaledW <= vw ? (vw - scaledW) / 2 : 0;
    const y = scaledH <= vh ? (vh - scaledH) / 2 : 0;

    return { scale: fit, x, y };
  }, []);

  const clampScale = useCallback((scale: number) => {
    return clamp(scale, minScaleRef.current, maxScaleRef.current);
  }, []);

  const clampPan = useCallback((next: View): View => {
    const viewport = rootRef.current;
    const inner = innerRef.current;
    if (!viewport || !inner) return next;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const cw = inner.scrollWidth;
    const ch = inner.scrollHeight;
    const scaledW = cw * next.scale;
    const scaledH = ch * next.scale;

    let { x, y } = next;
    if (scaledW <= vw) {
      x = (vw - scaledW) / 2;
    } else {
      x = clamp(x, vw - scaledW, 0);
    }
    if (scaledH <= vh) {
      y = (vh - scaledH) / 2;
    } else {
      y = clamp(y, vh - scaledH, 0);
    }

    return { scale: next.scale, x, y };
  }, []);

  const localPoint = useCallback((clientX: number, clientY: number) => {
    const el = rootRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }, []);

  const paint = useCallback(
    (next: View) => {
      const normalized = clampPan({ ...next, scale: clampScale(next.scale) });
      viewRef.current = normalized;
      const el = innerRef.current;
      if (el) {
        el.style.transform = `translate3d(${normalized.x}px, ${normalized.y}px, 0) scale(${normalized.scale})`;
      }
    },
    [clampPan, clampScale],
  );

  const commit = useCallback(
    (next: View, fromUser = false) => {
      if (fromUser) userAdjustedRef.current = true;
      const normalized = clampPan({ ...next, scale: clampScale(next.scale) });
      paint(normalized);
      setView(normalized);
    },
    [clampPan, clampScale, paint],
  );

  const applyFit = useCallback(
    (force = false) => {
      const fitView = measure();
      if (!fitView) return;

      const prevFit = fitScaleRef.current;
      fitScaleRef.current = fitView.scale;
      minScaleRef.current = fitView.scale * MIN_FIT_RATIO;
      maxScaleRef.current = Math.max(fitView.scale * MAX_ZOOM_RATIO, fitView.scale + 0.5);

      if (!fittedRef.current || force) {
        fittedRef.current = true;
        userAdjustedRef.current = false;
        commit(fitView);
        return;
      }

      if (userAdjustedRef.current) return;

      // 内容尺寸变化（如 PDF 渲染完成）且仍处于适合大小时，重新适配
      if (Math.abs(viewRef.current.scale - prevFit) < 0.02) {
        commit(fitView);
      }
    },
    [commit, measure],
  );

  const zoomAt = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const p = localPoint(clientX, clientY);
      const { scale, x, y } = viewRef.current;
      const contentX = (p.x - x) / scale;
      const contentY = (p.y - y) / scale;
      const clamped = clampScale(nextScale);
      commit({
        scale: clamped,
        x: p.x - contentX * clamped,
        y: p.y - contentY * clamped,
      }, true);
    },
    [clampScale, commit, localPoint],
  );

  useEffect(() => {
    fittedRef.current = false;
    userAdjustedRef.current = false;
    applyFit(true);
  }, [children, applyFit]);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const ro = new ResizeObserver(() => applyFit(false));
    ro.observe(inner);
    applyFit(true);
    return () => ro.disconnect();
  }, [applyFit]);

  useEffect(() => {
    paint(view);
  }, [paint, view]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const mid = touchMid(e.touches);
        const p = localPoint(mid.x, mid.y);
        const { scale, x, y } = viewRef.current;
        pinchRef.current = {
          dist: touchDist(e.touches),
          scale,
          contentX: (p.x - x) / scale,
          contentY: (p.y - y) / scale,
        };
        panRef.current = null;
        return;
      }
      if (e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        panRef.current = {
          sx: t.clientX,
          sy: t.clientY,
          ox: viewRef.current.x,
          oy: viewRef.current.y,
        };
      }
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const pinch = pinchRef.current;
        const dist = touchDist(e.touches);
        if (dist <= 0 || pinch.dist <= 0) return;
        const mid = touchMid(e.touches);
        const p = localPoint(mid.x, mid.y);
        const nextScale = clampScale(pinch.scale * (dist / pinch.dist));
        userAdjustedRef.current = true;
        paint(
          clampPan({
            scale: nextScale,
            x: p.x - pinch.contentX * nextScale,
            y: p.y - pinch.contentY * nextScale,
          }),
        );
        return;
      }
      if (e.touches.length === 1 && panRef.current) {
        e.preventDefault();
        const pan = panRef.current;
        const t = e.touches[0];
        paint(
          clampPan({
            ...viewRef.current,
            x: pan.ox + t.clientX - pan.sx,
            y: pan.oy + t.clientY - pan.sy,
          }),
        );
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) {
        panRef.current = null;
        commit(viewRef.current, true);
        return;
      }
      if (e.touches.length === 1) {
        const t = e.touches[0];
        panRef.current = {
          sx: t.clientX,
          sy: t.clientY,
          ox: viewRef.current.x,
          oy: viewRef.current.y,
        };
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.deltaMode === 1 ? 0.25 : e.deltaMode === 2 ? 0.5 : 0.12;
      const delta = e.deltaY > 0 ? -step : step;
      zoomAt(e.clientX, e.clientY, viewRef.current.scale + delta);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      panRef.current = {
        sx: e.clientX,
        sy: e.clientY,
        ox: viewRef.current.x,
        oy: viewRef.current.y,
      };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!panRef.current) return;
      e.preventDefault();
      const pan = panRef.current;
      paint(
        clampPan({
          ...viewRef.current,
          x: pan.ox + e.clientX - pan.sx,
          y: pan.oy + e.clientY - pan.sy,
        }),
      );
    };

    const onMouseUp = () => {
      if (!panRef.current) return;
      panRef.current = null;
      commit(viewRef.current, true);
    };

    const touchOpts: AddEventListenerOptions = { passive: false, capture: true };
    el.addEventListener("touchstart", onStart, touchOpts);
    el.addEventListener("touchmove", onMove, touchOpts);
    el.addEventListener("touchend", onEnd, touchOpts);
    el.addEventListener("touchcancel", onEnd, touchOpts);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      el.removeEventListener("touchstart", onStart, touchOpts);
      el.removeEventListener("touchmove", onMove, touchOpts);
      el.removeEventListener("touchend", onEnd, touchOpts);
      el.removeEventListener("touchcancel", onEnd, touchOpts);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [clampPan, clampScale, commit, localPoint, paint, zoomAt]);

  return (
    <div
      ref={rootRef}
      className="h-full min-h-[40dvh] w-full cursor-grab overflow-hidden rounded-none bg-slate-50 active:cursor-grabbing"
      style={{ touchAction: "none" }}
    >
      <div
        ref={innerRef}
        className="inline-block min-w-full"
        style={{ transformOrigin: "0 0", willChange: "transform" }}
      >
        {children}
      </div>
    </div>
  );
}
