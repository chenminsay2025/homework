import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { TaskAttachment } from "../types";
import { ACCEPTED_TASK_FILE_LABEL, ACCEPTED_TASK_FILE_TYPES, normalizeAttachmentName } from "../utils/filePreview";
import FilePreviewModal from "./FilePreviewModal";
import FileTypeIcon from "./FileTypeIcon";

type Props = {
  planId: number;
  attachments: TaskAttachment[];
  onChange: (attachments: TaskAttachment[]) => void;
};

export default function TaskAttachmentField({ planId, attachments, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [maxMb, setMaxMb] = useState(100);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; percent: number } | null>(null);
  const [previewFile, setPreviewFile] = useState<TaskAttachment | null>(null);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingIndex !== null) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingIndex]);

  useEffect(() => {
    api.getUploadSettings().then((s) => setMaxMb(s.max_mb)).catch(() => {});
  }, []);

  const handlePick = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const uploaded: TaskAttachment[] = [];
    const maxBytes = maxMb * 1024 * 1024;

    try {
      for (const file of Array.from(files)) {
        if (file.size > maxBytes) {
          alert(`「${file.name}」超过 ${maxMb}MB 限制，已跳过`);
          continue;
        }
        setUploadProgress({ name: file.name, percent: 0 });
        const result = await api.uploadTaskFile(planId, file, (ratio) => {
          setUploadProgress({ name: file.name, percent: Math.min(100, Math.round(ratio * 100)) });
        });
        uploaded.push({
          file_url: result.file_url,
          file_name: result.file_name,
          file_size: result.size,
          content_type: result.content_type,
          sort_order: attachments.length + uploaded.length,
        });
      }
      if (uploaded.length > 0) {
        onChange([...attachments, ...uploaded]);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (index: number) => {
    onChange(attachments.filter((_, i) => i !== index));
    if (renamingIndex === index) setRenamingIndex(null);
  };

  const startRename = (index: number) => {
    setRenamingIndex(index);
    setRenameDraft(attachments[index].file_name);
  };

  const cancelRename = () => {
    setRenamingIndex(null);
    setRenameDraft("");
  };

  const commitRename = (index: number) => {
    const original = attachments[index].file_name;
    const file_name = normalizeAttachmentName(original, renameDraft);
    if (file_name !== original) {
      onChange(attachments.map((att, i) => (i === index ? { ...att, file_name } : att)));
    }
    cancelRename();
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TASK_FILE_TYPES}
        className="hidden"
        onChange={(e) => handlePick(e.target.files)}
      />

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att, index) => (
            <div
              key={`${att.file_url}-${index}`}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
            >
              <FileTypeIcon fileName={att.file_name} size="sm" />
              {renamingIndex === index ? (
                <input
                  ref={renameInputRef}
                  className="input min-w-0 flex-1 py-1.5 text-sm"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename(index);
                    } else if (e.key === "Escape") {
                      cancelRename();
                    }
                  }}
                  onBlur={() => commitRename(index)}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{att.file_name}</span>
              )}
              {renamingIndex === index ? (
                <button
                  type="button"
                  className="shrink-0 text-sm text-slate-500 active:text-slate-700"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={cancelRename}
                >
                  取消
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="shrink-0 text-sm text-slate-600 active:text-slate-800"
                    onClick={() => startRename(index)}
                  >
                    重命名
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-sm text-indigo-600 active:text-indigo-800"
                    onClick={() => setPreviewFile(att)}
                  >
                    预览
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-sm text-red-500 active:text-red-700"
                    onClick={() => removeAt(index)}
                  >
                    移除
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {uploadProgress && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-slate-700">正在上传 {uploadProgress.name}</span>
            <span className="shrink-0 font-medium text-indigo-600">{uploadProgress.percent}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-150"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn-secondary w-full text-sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "上传中..." : attachments.length > 0 ? "+ 继续添加附件" : "+ 添加附件"}
      </button>

      <p className="text-xs text-slate-400">
        支持 {ACCEPTED_TASK_FILE_LABEL}，最大 {maxMb}MB，可多选一次性上传
      </p>

      {previewFile && (
        <FilePreviewModal
          open
          fileUrl={previewFile.file_url}
          fileName={previewFile.file_name}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
