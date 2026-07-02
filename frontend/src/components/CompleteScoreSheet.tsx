import { useState } from "react";

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export default function CompleteScoreSheet({
  open,
  onClose,
  title,
  subtitle,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  onConfirm: (score: number | null) => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  if (!open) return null;

  const handleConfirm = async (score: number | null) => {
    setLoading(true);
    try {
      await onConfirm(score);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    } finally {
      setLoading(false);
      setSelected(null);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={loading ? undefined : onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-scroll">
          <div className="sheet-handle" />
          <h3 className="mb-1 text-lg font-semibold">{title}</h3>
          {subtitle && <p className="mb-4 text-sm text-slate-500">{subtitle}</p>}
          {!subtitle && <div className="mb-4" />}
          <p className="mb-3 text-sm text-slate-600">点击分数完成（0–10 分）</p>
          <div className="grid grid-cols-6 gap-2">
            {SCORES.map((score) => (
              <button
                key={score}
                type="button"
                disabled={loading}
                onClick={() => {
                  setSelected(score);
                  void handleConfirm(score);
                }}
                className={`flex h-11 items-center justify-center rounded-xl text-base font-semibold transition active:scale-[0.97] ${
                  selected === score
                    ? "bg-indigo-600 text-white ring-2 ring-indigo-300"
                    : "border border-slate-200 bg-white text-slate-700 active:bg-indigo-50"
                }`}
              >
                {score}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleConfirm(null)}
            className="btn-secondary mt-4 w-full"
          >
            不评分，直接完成
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="mt-3 w-full py-2 text-sm text-slate-500 active:text-slate-700"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
