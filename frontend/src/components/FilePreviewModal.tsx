import { useEffect, useState } from "react";
import { api } from "../api";
import { previewKind } from "../utils/filePreview";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { pdfPreviewHint } from "../utils/pdfPreviewEnv";
import OfficePreview from "./OfficePreview";
import PdfPreview from "./PdfPreview";
import PinchPanViewer from "./PinchPanViewer";

type Props = {
  open: boolean;
  fileUrl: string;
  fileName: string;
  onClose: () => void;
};

export default function FilePreviewModal({ open, fileUrl, fileName, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const kind = previewKind(fileName);

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      setBlob(null);
      setBlobUrl(null);

      try {
        const fileBlob = await api.fetchPlanFile(fileUrl);
        if (cancelled) return;
        setBlob(fileBlob);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "预览失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, fileUrl]);

  useEffect(() => {
    if (!blob) {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  useEffect(() => {
    if (!open || loading || !blob) return;
    const fileKind = previewKind(fileName);
    if (fileKind === "office" || fileKind === "unsupported") {
      setError("该格式暂不支持在线预览，请下载后查看");
    }
  }, [open, blob, fileName, loading]);

  if (!open) return null;

  const unsupported = kind === "office" || kind === "unsupported";

  function previewHint() {
    if (kind === "audio" || kind === "video") return "在线播放";
    if (kind === "pdf") return pdfPreviewHint();
    if (kind === "docx" || kind === "xlsx") return "滚轮/双指缩放 · 拖动查看";
    return "滚轮/双指缩放 · 拖动查看";
  }

  function renderPreview() {
    if (kind === "pdf" && blobUrl && blob) {
      return <PdfPreview url={blobUrl} blob={blob} fileName={fileName} />;
    }
    if ((kind === "docx" || kind === "xlsx") && blob) {
      return <OfficePreview kind={kind} blob={blob} />;
    }
    if (kind === "image" && blobUrl) {
      return (
        <PinchPanViewer>
          <img src={blobUrl} alt={fileName} className="block max-w-none bg-white" draggable={false} />
        </PinchPanViewer>
      );
    }
    if (kind === "audio" && blobUrl) {
      return (
        <div className="flex h-full items-center justify-center px-6">
          <audio controls src={blobUrl} className="w-full max-w-md">
            您的浏览器不支持音频播放
          </audio>
        </div>
      );
    }
    if (kind === "video" && blobUrl) {
      return (
        <div className="flex h-full items-center justify-center bg-black px-2">
          <video controls playsInline src={blobUrl} className="max-h-full max-w-full">
            您的浏览器不支持视频播放
          </video>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="sheet-backdrop z-[70]" onClick={onClose}>
      <div
        className="sheet flex h-[94dvh] max-h-[94dvh] flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pb-3 pt-5">
          <div className="sheet-handle" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold">{fileName}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {previewHint()}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {blobUrl && (
                <a href={blobUrl} download={fileName} className="btn-secondary text-sm">
                  下载
                </a>
              )}
              <button type="button" onClick={onClose} className="btn-secondary text-sm">
                关闭
              </button>
            </div>
          </div>
        </div>

        <div className="preview-native min-h-0 flex-1 px-0 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          {loading ? (
            <div className="py-16 text-center text-slate-500">加载预览中...</div>
          ) : error && unsupported ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <p className="text-sm text-slate-600">{error}</p>
              {blobUrl && (
                <a href={blobUrl} download={fileName} className="btn-primary mt-4 inline-flex text-sm">
                  下载文件
                </a>
              )}
            </div>
          ) : (
            renderPreview() ?? (error ? <div className="py-12 text-center text-sm text-red-500">{error}</div> : null)
          )}
        </div>
      </div>
    </div>
  );
}
