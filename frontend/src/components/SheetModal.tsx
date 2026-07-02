import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  sheetClassName?: string;
};

/** 挂载到 body，避免父级 transform 导致 fixed 错位与事件穿透 */
export default function SheetModal({
  open,
  onClose,
  children,
  sheetClassName = "sheet mx-auto w-full max-w-sm",
}: Props) {
  useLockBodyScroll(open);

  if (!open) return null;

  return createPortal(
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={sheetClassName}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
