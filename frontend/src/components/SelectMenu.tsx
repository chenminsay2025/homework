import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface SelectMenuOption<T extends string | number = string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SelectMenuProps<T extends string | number> {
  value: T;
  options: SelectMenuOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  align?: "left" | "right";
  size?: "sm" | "md";
  "aria-label"?: string;
  renderValue?: (option: SelectMenuOption<T> | undefined) => ReactNode;
  footer?: ReactNode;
}

const triggerSize: Record<"sm" | "md", string> = {
  sm: "flex min-h-[2.25rem] w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800",
  md: "input flex w-full items-center justify-between gap-2 text-left",
};

const itemSize: Record<"sm" | "md", string> = {
  sm: "px-2.5 py-2 text-sm",
  md: "px-3 py-2.5 text-sm",
};

const MENU_GAP = 4;
const VIEWPORT_PADDING = 8;
const PREFERRED_MAX_HEIGHT = 224;

const SHADOW_DOWN =
  "0 10px 15px -3px rgb(15 23 42 / 0.12), 0 4px 6px -4px rgb(15 23 42 / 0.08)";
const SHADOW_UP =
  "0 -10px 15px -3px rgb(15 23 42 / 0.12), 0 -4px 6px -4px rgb(15 23 42 / 0.08)";

function computeMenuLayout(
  trigger: HTMLButtonElement,
  list: HTMLUListElement | null,
  align: "left" | "right",
): { shellStyle: React.CSSProperties; listStyle: React.CSSProperties; opensUp: boolean } {
  const rect = trigger.getBoundingClientRect();
  const contentHeight = list?.scrollHeight ?? PREFERRED_MAX_HEIGHT;
  const idealHeight = Math.min(contentHeight, PREFERRED_MAX_HEIGHT);
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING - MENU_GAP;
  const spaceAbove = rect.top - VIEWPORT_PADDING - MENU_GAP;
  const opensUp = spaceBelow < idealHeight && spaceAbove > spaceBelow;
  const available = opensUp ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(96, Math.min(idealHeight, available));

  const horizontal: React.CSSProperties =
    align === "right"
      ? { right: window.innerWidth - rect.right, width: rect.width }
      : { left: rect.left, width: rect.width };

  const boxShadow = opensUp ? SHADOW_UP : SHADOW_DOWN;

  if (opensUp) {
    return {
      opensUp,
      shellStyle: {
        position: "fixed",
        ...horizontal,
        bottom: window.innerHeight - rect.top + MENU_GAP,
        boxShadow,
        overflow: "hidden",
        borderRadius: "0.75rem",
      },
      listStyle: { maxHeight },
    };
  }

  return {
    opensUp,
    shellStyle: {
      position: "fixed",
      ...horizontal,
      top: rect.bottom + MENU_GAP,
      boxShadow,
      overflow: "hidden",
      borderRadius: "0.75rem",
    },
    listStyle: { maxHeight },
  };
}

export default function SelectMenu<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = "请选择",
  disabled = false,
  className = "",
  triggerClassName = "",
  align = "left",
  size = "md",
  "aria-label": ariaLabel,
  renderValue,
  footer,
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [menuShellStyle, setMenuShellStyle] = useState<React.CSSProperties>({});
  const [menuListStyle, setMenuListStyle] = useState<React.CSSProperties>({});
  const [opensUp, setOpensUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const updateMenuPosition = () => {
    if (!triggerRef.current) return;
    const layout = computeMenuLayout(triggerRef.current, listRef.current, align);
    setOpensUp(layout.opensUp);
    setMenuShellStyle(layout.shellStyle);
    setMenuListStyle(layout.listStyle);
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const raf = requestAnimationFrame(updateMenuPosition);
    return () => cancelAnimationFrame(raf);
  }, [open, options.length, align, footer]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const reposition = () => updateMenuPosition();
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
  }, [open, align]);

  const pick = (option: SelectMenuOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${triggerSize[size]} ${disabled ? "cursor-not-allowed opacity-50" : "active:bg-slate-50"} ${triggerClassName}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-slate-800" : "text-slate-400"}`}>
          {renderValue ? renderValue(selected) : selected?.label ?? placeholder}
        </span>
        <span className={`shrink-0 text-xs text-slate-400 transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div
          style={menuShellStyle}
          data-placement={opensUp ? "top" : "bottom"}
          className="scroll-inset z-[60] border border-slate-200 bg-white"
        >
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            style={menuListStyle}
            className="scroll-inset-y py-1"
          >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={String(option.value)} role="option" aria-selected={active}>
                <button
                  type="button"
                  disabled={option.disabled}
                  onClick={() => pick(option)}
                  className={`flex w-full items-center justify-between text-left ${itemSize[size]} ${
                    option.disabled
                      ? "cursor-not-allowed text-slate-300"
                      : active
                        ? "bg-indigo-50 font-medium text-indigo-700"
                        : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {active && <span className="ml-2 shrink-0 text-indigo-600">✓</span>}
                </button>
              </li>
            );
          })}
          {footer && (
            <li className="border-t border-slate-100" onClick={() => setOpen(false)}>
              {footer}
            </li>
          )}
          </ul>
        </div>
      )}
    </div>
  );
}
