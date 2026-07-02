export type PreviewKind = "pdf" | "image" | "docx" | "xlsx" | "office" | "audio" | "video" | "unsupported";

export type FileTypeIconMeta = {
  label: string;
  bgClass: string;
};

const EXT_KIND: Record<string, PreviewKind> = {
  pdf: "pdf",
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  doc: "docx",
  docx: "docx",
  xlsx: "xlsx",
  xls: "xlsx",
  ppt: "office",
  pptx: "office",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  aac: "audio",
  ogg: "audio",
  flac: "audio",
  mp4: "video",
  webm: "video",
  mov: "video",
  mkv: "video",
  avi: "video",
};

export function fileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

/** 重命名时保留原扩展名，避免用户去掉后缀导致预览/图标异常 */
export function normalizeAttachmentName(original: string, next: string): string {
  const trimmed = next.trim();
  if (!trimmed) return original;
  const ext = fileExtension(original);
  if (!ext) return trimmed.slice(0, 255);
  const lower = trimmed.toLowerCase();
  if (lower.endsWith(`.${ext}`)) return trimmed.slice(0, 255);
  if (!trimmed.includes(".")) return `${trimmed}.${ext}`.slice(0, 255);
  return trimmed.slice(0, 255);
}

export function previewKind(fileName: string): PreviewKind {
  return EXT_KIND[fileExtension(fileName)] || "unsupported";
}

export function fileTypeIconMeta(fileName: string): FileTypeIconMeta {
  const ext = fileExtension(fileName);
  switch (ext) {
    case "pdf":
      return { label: "PDF", bgClass: "bg-red-500" };
    case "doc":
    case "docx":
      return { label: "W", bgClass: "bg-blue-600" };
    case "xls":
    case "xlsx":
      return { label: "X", bgClass: "bg-green-600" };
    case "ppt":
    case "pptx":
      return { label: "P", bgClass: "bg-orange-500" };
    case "jpg":
    case "jpeg":
    case "png":
    case "webp":
      return { label: "IMG", bgClass: "bg-purple-500" };
    case "mp3":
    case "m4a":
    case "wav":
    case "aac":
    case "ogg":
    case "flac":
      return { label: "AUD", bgClass: "bg-pink-500" };
    case "mp4":
    case "webm":
    case "mov":
    case "mkv":
    case "avi":
      return { label: "VID", bgClass: "bg-rose-600" };
    default:
      return { label: (ext || "?").slice(0, 3).toUpperCase(), bgClass: "bg-slate-400" };
  }
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export const ACCEPTED_TASK_FILE_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.wav,.aac,.ogg,.flac,.mp4,.webm,.mov,.mkv,.avi";

export const ACCEPTED_TASK_FILE_LABEL = "PDF、Word、Excel、PPT、图片、音频、视频";

export function officeOnlinePreviewUrl(absoluteFileUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteFileUrl)}`;
}
