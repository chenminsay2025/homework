type Props = {
  url: string;
  fileName: string;
};

/** 使用浏览器内置 PDF 查看器，文字矢量渲染、原生缩放，非 canvas 位图 */
export default function NativePdfPreview({ url, fileName }: Props) {
  const src = `${url}#view=FitH&toolbar=1&navpanes=0`;

  return (
    <div className="h-full min-h-0 w-full bg-slate-100">
      <iframe
        src={src}
        title={fileName}
        className="h-full w-full border-0 bg-white"
      />
    </div>
  );
}
