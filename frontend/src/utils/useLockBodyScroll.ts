import { useEffect } from "react";

/** 打开预览时锁定页面滚动，并禁止整页双指缩放（由预览组件自行处理） */
export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const meta = document.querySelector('meta[name="viewport"]');
    const prevOverflow = document.body.style.overflow;
    const prevBodyTouchAction = document.body.style.touchAction;
    const prevHtmlTouchAction = html.style.touchAction;
    const prevViewport = meta?.getAttribute("content") ?? "";
    const hadPreviewClass = html.classList.contains("preview-open");

    document.body.style.overflow = "hidden";
    html.classList.add("preview-open");
    document.body.style.touchAction = "none";
    html.style.touchAction = "none";
    meta?.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
    );

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
      html.style.touchAction = prevHtmlTouchAction;
      if (prevViewport) meta?.setAttribute("content", prevViewport);
      if (!hadPreviewClass) html.classList.remove("preview-open");
    };
  }, [locked]);
}
