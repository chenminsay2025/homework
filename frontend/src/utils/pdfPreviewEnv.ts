/** 移动端 / 内置浏览器 iframe 无法正常预览 blob PDF，需 canvas 回退 */
export function preferCanvasPdfPreview(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent;

  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;

  if (/MicroMessenger|Feishu|DingTalk|QQ\//i.test(ua)) return true;

  if (window.matchMedia("(max-width: 767px)").matches) return true;

  return false;
}

export function pdfPreviewHint(): string {
  return preferCanvasPdfPreview()
    ? "双指缩放 · 单指拖动"
    : "浏览器原生预览 · 支持缩放";
}
