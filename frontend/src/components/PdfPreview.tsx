import { lazy, Suspense } from "react";
import { preferCanvasPdfPreview } from "../utils/pdfPreviewEnv";
import NativePdfPreview from "./NativePdfPreview";

const CanvasPdfPreview = lazy(() => import("./CanvasPdfPreview"));

type Props = {
  url: string;
  blob: Blob;
  fileName: string;
};

export default function PdfPreview({ url, blob, fileName }: Props) {
  if (preferCanvasPdfPreview()) {
    return (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-slate-500">正在加载 PDF...</div>
        }
      >
        <CanvasPdfPreview blob={blob} />
      </Suspense>
    );
  }
  return <NativePdfPreview url={url} fileName={fileName} />;
}
