import { useEffect, useRef, useState } from "react";
import jsPreviewDocx from "@js-preview/docx";
import jsPreviewExcel from "@js-preview/excel";
import "@js-preview/docx/lib/index.css";
import "@js-preview/excel/lib/index.css";
import PinchPanViewer from "./PinchPanViewer";

type OfficeKind = "docx" | "xlsx";

type Previewer = {
  preview: (src: string | ArrayBuffer | Blob) => Promise<unknown> | void;
  destroy: () => void;
};

const INITERS: Record<OfficeKind, { init: (container: HTMLElement, options?: object) => Previewer }> = {
  docx: jsPreviewDocx,
  xlsx: jsPreviewExcel,
};

const BASE_OPTIONS: Record<OfficeKind, Record<string, unknown>> = {
  docx: { inWrapper: true, className: "docx-preview", ignoreWidth: false, breakPages: true },
  xlsx: { minColLength: 0, showContextmenu: false },
};

type Props = {
  kind: OfficeKind;
  blob: Blob;
};

export default function OfficePreview({ kind, blob }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    const previewer = INITERS[kind].init(container, BASE_OPTIONS[kind]);

    Promise.resolve(previewer.preview(blob))
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "预览失败");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      previewer.destroy();
    };
  }, [blob, kind]);

  return (
    <div className="relative h-full min-h-0 w-full">
      {loading && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 text-sm text-slate-500">
          正在渲染文档...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-red-500">
          {error}
        </div>
      )}
      <PinchPanViewer>
        <div ref={containerRef} className="office-preview-host w-full bg-white" />
      </PinchPanViewer>
    </div>
  );
}
