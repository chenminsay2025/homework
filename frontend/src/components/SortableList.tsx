import { useEffect, useRef, useState, type ReactNode } from "react";

const ITEM_GAP = 8;

export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

type DragState = {
  id: number;
  fromIndex: number;
  toIndex: number;
  startY: number;
  offsetY: number;
  rowHeight: number;
};

function dropIndexAt<T extends { id: number }>(
  clientY: number,
  items: T[],
  activeId: number,
  refs: Map<number, HTMLDivElement>,
): number {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === activeId) continue;
    const el = refs.get(items[i].id);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return i;
  }
  return items.length - 1;
}

function itemShift(index: number, drag: DragState): number {
  const stride = drag.rowHeight + ITEM_GAP;
  const { fromIndex, toIndex } = drag;
  if (index === fromIndex) return drag.offsetY;
  if (fromIndex < toIndex) {
    if (index > fromIndex && index <= toIndex) return -stride;
  } else if (fromIndex > toIndex) {
    if (index >= toIndex && index < fromIndex) return stride;
  }
  return 0;
}

export function DragHandle({ onStart }: { onStart: (e: React.PointerEvent) => void }) {
  return (
    <button
      type="button"
      className="touch-none shrink-0 cursor-grab px-1 text-slate-300 active:cursor-grabbing active:text-slate-400"
      aria-label="拖动排序"
      onPointerDown={(e) => {
        e.stopPropagation();
        onStart(e);
      }}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <circle cx="9" cy="7" r="1.5" />
        <circle cx="15" cy="7" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="17" r="1.5" />
        <circle cx="15" cy="17" r="1.5" />
      </svg>
    </button>
  );
}

type SortableListProps<T extends { id: number }> = {
  items: T[];
  onReorder: (items: T[]) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  renderItem: (item: T, dragHandle: ReactNode, dragging: boolean) => ReactNode;
};

export default function SortableList<T extends { id: number }>({
  items,
  onReorder,
  disabled = false,
  className = "",
  renderItem,
}: SortableListProps<T>) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [settling, setSettling] = useState(false);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const onReorderRef = useRef(onReorder);
  const itemsRef = useRef(items);
  const dragRef = useRef<DragState | null>(null);

  onReorderRef.current = onReorder;
  itemsRef.current = items;
  dragRef.current = drag;

  useEffect(() => {
    if (drag === null) return;

    const onMove = (e: PointerEvent) => {
      setDrag((current) => {
        if (!current) return current;
        const list = itemsRef.current;
        const offsetY = e.clientY - current.startY;
        const toIndex = dropIndexAt(e.clientY, list, current.id, rowRefs.current);
        if (current.offsetY === offsetY && current.toIndex === toIndex) return current;
        return { ...current, offsetY, toIndex };
      });
    };

    const onUp = () => {
      const current = dragRef.current;
      if (!current) return;

      setDrag(null);
      dragRef.current = null;

      if (current.fromIndex === current.toIndex) return;

      const next = reorderItems(itemsRef.current, current.fromIndex, current.toIndex);
      setSettling(true);
      window.setTimeout(() => setSettling(false), 220);
      queueMicrotask(() => {
        void onReorderRef.current(next);
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag?.id]);

  const startDrag = (id: number) => (e: React.PointerEvent) => {
    if (disabled || drag) return;
    e.preventDefault();
    const fromIndex = items.findIndex((item) => item.id === id);
    const el = rowRefs.current.get(id);
    if (fromIndex < 0 || !el) return;
    const rect = el.getBoundingClientRect();
    setDrag({
      id,
      fromIndex,
      toIndex: fromIndex,
      startY: e.clientY,
      offsetY: 0,
      rowHeight: rect.height,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  return (
    <div className={className}>
      {items.map((item, index) => {
        const isDragging = drag?.id === item.id;
        const shift = drag ? itemShift(index, drag) : 0;
        const animate = !isDragging && (drag !== null || settling);
        return (
          <div
            key={item.id}
            ref={(el) => {
              if (el) rowRefs.current.set(item.id, el);
              else rowRefs.current.delete(item.id);
            }}
            className={isDragging ? "relative z-20" : ""}
            style={{
              transform: shift ? `translate3d(0, ${shift}px, 0)` : undefined,
              transition: animate ? "transform 200ms ease" : "none",
              willChange: drag ? "transform" : undefined,
            }}
          >
            <div
              className={
                isDragging ? "rounded-2xl bg-white shadow-lg ring-1 ring-slate-200/80" : ""
              }
            >
              {renderItem(item, <DragHandle onStart={startDrag(item.id)} />, isDragging)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
