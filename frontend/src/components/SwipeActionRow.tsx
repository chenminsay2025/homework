import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type SwipeAction = {
  label: string;
  className?: string;
  onClick: () => void;
};

const ACTION_BTN_WIDTH = 72;
const ROW_RADIUS = "rounded-2xl";

export function swipeActionWidth(count: number) {
  return Math.max(ACTION_BTN_WIDTH, count * ACTION_BTN_WIDTH);
}

export default function SwipeActionRow({
  actions,
  children,
  swipeOpen = false,
  onSwipeOpenChange,
  className = "",
}: {
  actions: SwipeAction[];
  children: ReactNode;
  swipeOpen?: boolean;
  onSwipeOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const actionWidth = swipeActionWidth(actions.length);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, base: 0 });
  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);

  const updateOffset = useCallback((value: number) => {
    offsetRef.current = value;
    setOffset(value);
  }, []);

  const setOpen = useCallback(
    (open: boolean) => {
      onSwipeOpenChange?.(open);
      updateOffset(open ? actionWidth : 0);
    },
    [actionWidth, onSwipeOpenChange, updateOffset],
  );

  useEffect(() => {
    if (swipeOpen) updateOffset(actionWidth);
    else if (!dragging) updateOffset(0);
  }, [swipeOpen, dragging, actionWidth, updateOffset]);

  const handleDragStart = (clientX: number, clientY: number) => {
    startRef.current = { x: clientX, y: clientY, base: swipeOpen ? actionWidth : offsetRef.current };
    draggingRef.current = false;
    suppressClickRef.current = false;
    setDragging(false);
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    const dx = clientX - startRef.current.x;
    const dy = clientY - startRef.current.y;
    if (!draggingRef.current && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (!draggingRef.current && Math.abs(dy) > Math.abs(dx)) return;
    draggingRef.current = true;
    setDragging(true);
    const next = Math.max(0, Math.min(actionWidth, startRef.current.base - dx));
    updateOffset(next);
  };

  const handleDragEnd = () => {
    if (draggingRef.current) {
      suppressClickRef.current = true;
      if (offsetRef.current > actionWidth / 2) setOpen(true);
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

  const slideX = dragging ? offset : swipeOpen ? actionWidth : offset;

  if (actions.length === 0) {
    return <>{children}</>;
  }

  return (
    <div
      className={`relative isolate overflow-hidden ${ROW_RADIUS} ${className}`.trim()}
      data-swipe-row
    >
      <div
        className={`absolute inset-0 flex justify-end ${slideX === 0 ? "pointer-events-none" : ""}`}
        aria-hidden={slideX === 0}
      >
        <div className="flex h-full min-h-full" style={{ width: actionWidth }}>
          {actions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              className={`flex h-full min-h-full min-w-0 flex-1 items-center justify-center text-sm font-medium text-white ${
                action.className || "bg-indigo-500 active:bg-indigo-600"
              } ${index === actions.length - 1 ? "rounded-r-2xl" : ""}`}
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className={`relative z-10 w-full min-h-[2.75rem] bg-inherit ${dragging ? "" : "transition-transform duration-200 ease-out"}`}
        style={{ transform: `translateX(-${slideX}px)`, touchAction: "pan-y" }}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={handleDragEnd}
        onTouchCancel={handleDragEnd}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          handleDragStart(e.clientX, e.clientY);
          const onMove = (ev: MouseEvent) => {
            handleDragMove(ev.clientX, ev.clientY);
            if (draggingRef.current) ev.preventDefault();
          };
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
          role="presentation"
          className="w-full min-h-[inherit] bg-inherit [&>*]:min-h-[inherit] [&>*]:w-full"
          onClick={handleContentClick}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
