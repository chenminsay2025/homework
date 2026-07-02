import { fileTypeIconMeta } from "../utils/filePreview";

type Props = {
  fileName: string;
  size?: "sm" | "md";
};

export default function FileTypeIcon({ fileName, size = "md" }: Props) {
  const { label, bgClass } = fileTypeIconMeta(fileName);
  const sizeClass = size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg font-bold text-white ${bgClass} ${sizeClass}`}
      aria-hidden
    >
      {label}
    </span>
  );
}
