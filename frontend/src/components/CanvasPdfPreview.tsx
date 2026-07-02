import { useEffect, useRef, useState } from "react";
import jsPreviewPdf from "@js-preview/pdf";
import PinchPanViewer from "./PinchPanViewer";

type Props = {
  blob: Blob;
};

/** canvas 渲染倍率：2 = 以 2 倍宽度绘制，PinchPanViewer 缩放回适配宽度，默认视图更清晰 */
const CANVAS_RENDER_SCALE = 2;

/** 移动端 PDF：canvas 渲染 + PinchPanViewer 局部缩放，避免整页缩放 */
export default function CanvasPdfPreview({ blob }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    const layoutWidth = Math.max(container.clientWidth - 16, 280);
    const width = Math.round(layoutWidth * CANVAS_RENDER_SCALE);
    const previewer = jsPreviewPdf.init(container, {
      gap: 8,
      width,
      onError: (e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "PDF 预览失败");
          setLoading(false);
        }
      },
      onRendered: () => {
        if (!cancelled) setLoading(false);
      },
    } as Parameters<typeof jsPreviewPdf.init>[1]);

    previewer.preview(blob);

    return () => {
      cancelled = true;
      previewer.destroy();
    };
  }, [blob]);

  return (
    <div className="canvas-pdf-preview relative h-full min-h-0 w-full bg-slate-100">
      {loading && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-500">
          正在加载 PDF...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-red-500">
          {error}
        </div>
      )}
      <PinchPanViewer>
        <div ref={containerRef} className="office-preview-host w-full p-2" />
      </PinchPanViewer>
    </div>
  );
}
