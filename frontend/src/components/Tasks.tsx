import { useCallback, useEffect, useRef, useState } from "react";
import { api, percent } from "../api";
import { usePlan } from "../context/PlanContext";
import type { Subject, Task, TaskAttachment } from "../types";
import { showAppError } from "../utils/appMessage";
import { normalizeAttachmentName } from "../utils/filePreview";
import SelectMenu from "./SelectMenu";
import TaskAttachmentField from "./TaskAttachmentField";
import FilePreviewModal from "./FilePreviewModal";
import FileTypeIcon from "./FileTypeIcon";
import SwipeActionRow from "./SwipeActionRow";

function taskAttachments(task: Task): TaskAttachment[] {
  if (task.attachments?.length) return task.attachments;
  if (task.file_url) {
    return [{ file_url: task.file_url, file_name: task.file_name || "附件" }];
  }
  return [];
}

function PaperclipIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function TasksView() {
  const { currentPlanId } = usePlan();
  const planId = currentPlanId!;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({
    subject_id: 0,
    title: "",
    description: "",
    total_units: 1,
    unit_label: "节",
    attachments: [] as TaskAttachment[],
  });
  const [previewFile, setPreviewFile] = useState<TaskAttachment | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<number | null>(null);
  const [expandedAttachmentsId, setExpandedAttachmentsId] = useState<number | null>(null);
  const [guideAttachments, setGuideAttachments] = useState<TaskAttachment[]>([]);
  const [showGuideForm, setShowGuideForm] = useState(false);
  const [guideDraft, setGuideDraft] = useState<TaskAttachment[]>([]);
  const [guideSaving, setGuideSaving] = useState(false);
  const [expandedGuide, setExpandedGuide] = useState(false);
  const [guideSwipeOpenIndex, setGuideSwipeOpenIndex] = useState<number | null>(null);
  const [guideRenamingIndex, setGuideRenamingIndex] = useState<number | null>(null);
  const [guideRenameDraft, setGuideRenameDraft] = useState("");
  const guideRenameInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    const [taskList, subjectList, guideList] = await Promise.all([
      api.getTasks(planId, false),
      api.getSubjects(planId),
      api.getPlanTaskGuide(planId),
    ]);
    setTasks(taskList);
    setSubjects(subjectList);
    setGuideAttachments(guideList);
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (swipeOpenId === null && guideSwipeOpenIndex === null) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest("[data-swipe-row]")) {
        setSwipeOpenId(null);
        setGuideSwipeOpenIndex(null);
      }
    };
    document.addEventListener("touchstart", close);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("touchstart", close);
      document.removeEventListener("mousedown", close);
    };
  }, [swipeOpenId, guideSwipeOpenIndex]);

  useEffect(() => {
    if (guideRenamingIndex !== null) {
      guideRenameInputRef.current?.focus();
      guideRenameInputRef.current?.select();
    }
  }, [guideRenamingIndex]);

  useEffect(() => {
    if (subjects.length > 0 && form.subject_id === 0) {
      setForm((f) => ({ ...f, subject_id: subjects[0].id }));
    }
  }, [subjects, form.subject_id]);

  const resetForm = (subjectId?: number) => {
    setForm({
      subject_id: subjectId ?? subjects[0]?.id ?? 0,
      title: "",
      description: "",
      total_units: 1,
      unit_label: "节",
      attachments: [],
    });
  };

  const openCreate = (subjectId?: number) => {
    setEditing(null);
    resetForm(subjectId);
    setShowForm(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({
      subject_id: task.subject_id,
      title: task.title,
      description: task.description || "",
      total_units: task.total_units,
      unit_label: task.unit_label,
      attachments: taskAttachments(task).map((att, index) => ({
        ...att,
        sort_order: att.sort_order ?? index,
      })),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !planId) return;
    const payload = {
      subject_id: form.subject_id,
      title: form.title,
      description: form.description || undefined,
      total_units: form.total_units,
      unit_label: form.unit_label,
      attachments: form.attachments.map((att, index) => ({
        file_url: att.file_url,
        file_name: att.file_name,
        file_size: att.file_size ?? undefined,
        content_type: att.content_type ?? undefined,
        sort_order: index,
      })),
    };
    try {
      if (editing) {
        await api.updateTask(planId, editing.id, payload);
      } else {
        await api.createTask(planId, payload);
      }
      setShowForm(false);
      setEditing(null);
      resetForm();
      load();
    } catch (e) {
      showAppError(e, editing ? "保存失败" : "创建失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除？") || !planId) return;
    try {
      await api.deleteTask(planId, id);
      load();
    } catch (e) {
      showAppError(e, "删除失败");
    }
  };

  const openGuideEdit = () => {
    setGuideDraft(
      guideAttachments.map((att, index) => ({
        ...att,
        sort_order: att.sort_order ?? index,
      })),
    );
    setShowGuideForm(true);
  };

  const handleGuideIconClick = () => {
    if (guideAttachments.length === 0) {
      openGuideEdit();
      return;
    }
    setExpandedGuide((prev) => !prev);
  };

  const handleGuideSave = async () => {
    if (!planId) return;
    setGuideSaving(true);
    try {
      const saved = await api.updatePlanTaskGuide(planId, guideDraft);
      setGuideAttachments(saved);
      setShowGuideForm(false);
    } catch (e) {
      showAppError(e, "保存失败");
    } finally {
      setGuideSaving(false);
    }
  };

  const persistGuideAttachments = async (attachments: TaskAttachment[]) => {
    if (!planId) return;
    const saved = await api.updatePlanTaskGuide(planId, attachments);
    setGuideAttachments(saved);
    if (saved.length === 0) setExpandedGuide(false);
  };

  const startGuideRename = (index: number) => {
    setGuideRenamingIndex(index);
    setGuideRenameDraft(guideAttachments[index].file_name);
    setGuideSwipeOpenIndex(null);
  };

  const cancelGuideRename = () => {
    setGuideRenamingIndex(null);
    setGuideRenameDraft("");
  };

  const commitGuideRename = async (index: number) => {
    const original = guideAttachments[index].file_name;
    const file_name = normalizeAttachmentName(original, guideRenameDraft);
    cancelGuideRename();
    if (file_name === original) return;
    const next = guideAttachments.map((att, i) => (i === index ? { ...att, file_name } : att));
    try {
      await persistGuideAttachments(next);
    } catch (e) {
      showAppError(e, "重命名失败");
    }
  };

  const handleGuideDelete = async (index: number) => {
    if (!confirm("确定删除此附件？")) return;
    const next = guideAttachments.filter((_, i) => i !== index);
    setGuideSwipeOpenIndex(null);
    try {
      await persistGuideAttachments(next);
    } catch (e) {
      showAppError(e, "删除失败");
    }
  };

  if (!planId) return null;

  const grouped = subjects.map((s) => ({
    subject: s,
    tasks: tasks.filter((t) => t.subject_id === s.id),
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">任务总览</h2>
          <button
            type="button"
            className="inline-flex min-h-7 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium leading-none text-slate-500 active:bg-slate-200"
            onClick={handleGuideIconClick}
            title={guideAttachments.length > 0 ? "查看通用附件说明" : "添加通用附件说明"}
          >
            <PaperclipIcon className="h-3 w-3 shrink-0" />
            {guideAttachments.length > 0 ? `附件${guideAttachments.length}个` : "通用说明"}
          </button>
        </div>
        {guideAttachments.length > 0 && expandedGuide && (
          <div className="mt-2 space-y-2">
            {guideAttachments.map((att, index) => (
              <SwipeActionRow
                key={`guide-${att.id ?? att.file_url}-${index}`}
                className="border border-slate-200/80 bg-white shadow-sm"
                swipeOpen={guideSwipeOpenIndex === index}
                onSwipeOpenChange={(open) => setGuideSwipeOpenIndex(open ? index : null)}
                actions={[
                  { label: "编辑", onClick: () => startGuideRename(index) },
                  {
                    label: "删除",
                    className: "bg-red-500 active:bg-red-600",
                    onClick: () => handleGuideDelete(index),
                  },
                ]}
              >
                <div className="flex min-h-[2.75rem] w-full items-center gap-2 bg-white px-3 py-2">
                  <FileTypeIcon fileName={att.file_name} size="sm" />
                  {guideRenamingIndex === index ? (
                    <input
                      ref={guideRenameInputRef}
                      className="input min-w-0 flex-1 py-1.5 text-sm"
                      value={guideRenameDraft}
                      onChange={(e) => setGuideRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void commitGuideRename(index);
                        } else if (e.key === "Escape") {
                          cancelGuideRename();
                        }
                      }}
                      onBlur={() => void commitGuideRename(index)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left active:opacity-80"
                      onClick={() => setPreviewFile(att)}
                    >
                      <span className="truncate text-sm text-indigo-600">{att.file_name}</span>
                    </button>
                  )}
                </div>
              </SwipeActionRow>
            ))}
            <button
              type="button"
              onClick={openGuideEdit}
              className="text-sm text-indigo-600 active:text-indigo-800"
            >
              + 添加附件
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">加载中...</div>
      ) : (
        <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
          {grouped.map(({ subject, tasks: subjectTasks }) => (
            <div key={subject.id} className="card overflow-hidden">
              <div
                className="flex items-center justify-between gap-2 px-5 py-3 text-white"
                style={{ backgroundColor: subject.color }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="font-semibold">{subject.name}</span>
                  <span className="text-sm opacity-80">{subjectTasks.length} 项任务</span>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 active:bg-white/30"
                  onClick={() => openCreate(subject.id)}
                  aria-label={`添加${subject.name}任务`}
                  title={`添加${subject.name}任务`}
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
              </div>
              {subjectTasks.length === 0 ? (
                <p className="px-5 py-8 text-center text-slate-400">暂无任务</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {subjectTasks.map((task) => {
                    const attachments = taskAttachments(task);
                    return (
                      <SwipeActionRow
                        key={task.id}
                        className="rounded-none"
                        swipeOpen={swipeOpenId === task.id}
                        onSwipeOpenChange={(open) => setSwipeOpenId(open ? task.id : null)}
                        actions={[
                          { label: "编辑", onClick: () => openEdit(task) },
                          {
                            label: "删除",
                            className: "bg-red-500 active:bg-red-600",
                            onClick: () => handleDelete(task.id),
                          },
                        ]}
                      >
                        <div className="min-h-[2.75rem] bg-white px-5 py-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium">{task.title}</h3>
                              {!task.is_active && (
                                <span className="badge bg-slate-100 text-slate-500">已归档</span>
                              )}
                              {attachments.length > 0 && (
                                <button
                                  type="button"
                                  className="inline-flex min-h-7 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium leading-none text-slate-500 active:bg-slate-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedAttachmentsId((prev) =>
                                      prev === task.id ? null : task.id,
                                    );
                                  }}
                                >
                                  <PaperclipIcon className="h-3 w-3 shrink-0" />
                                  附件{attachments.length}个
                                </button>
                              )}
                            </div>
                            {task.description && (
                              <p className="mt-0.5 text-sm text-slate-500">{task.description}</p>
                            )}
                            {attachments.length > 0 && expandedAttachmentsId === task.id && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {attachments.map((att, index) => (
                                  <button
                                    key={`${att.file_url}-${index}`}
                                    type="button"
                                    className="flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-left active:bg-slate-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewFile(att);
                                    }}
                                  >
                                    <FileTypeIcon fileName={att.file_name} size="sm" />
                                    <span className="truncate text-sm text-indigo-600">{att.file_name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-3">
                              <div className="h-1.5 flex-1 max-w-xs overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${task.progress_ratio * 100}%`,
                                    backgroundColor: subject.color,
                                  }}
                                />
                              </div>
                              <span className="text-sm text-slate-600">
                                {task.completed_units}/{task.total_units} {task.unit_label} · {percent(task.progress_ratio)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </SwipeActionRow>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="sheet-backdrop" onClick={() => setShowForm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-scroll">
            <div className="sheet-handle" />
            <h3 className="mb-4 text-lg font-semibold">{editing ? "编辑任务" : "新建任务"}</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-600">作业安排</label>
                {subjects.length === 0 ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    还没有作业安排，请先到「我的 → 作业安排」添加，或从课表模板生成计划。
                  </p>
                ) : (
                  <SelectMenu
                    value={form.subject_id}
                    options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                    onChange={(subject_id) => setForm({ ...form, subject_id })}
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">作业名</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">说明</label>
                <input
                  className="input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">附件</label>
                <TaskAttachmentField
                  planId={planId}
                  attachments={form.attachments}
                  onChange={(attachments) => setForm({ ...form, attachments })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">总数量</label>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={form.total_units}
                    onChange={(e) => setForm({ ...form, total_units: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">单位</label>
                  <input
                    className="input"
                    value={form.unit_label}
                    onChange={(e) => setForm({ ...form, unit_label: e.target.value })}
                    placeholder="节/课/张"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary">
                取消
              </button>
              <button onClick={handleSave} className="btn-primary" disabled={subjects.length === 0}>
                {editing ? "保存" : "创建"}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {showGuideForm && (
        <div className="sheet-backdrop" onClick={() => setShowGuideForm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-scroll">
              <div className="sheet-handle" />
              <h3 className="mb-1 text-lg font-semibold">通用附件说明</h3>
              <p className="mb-4 text-sm text-slate-500">上传的文档对本计划下所有任务可见。</p>
              <TaskAttachmentField
                planId={planId}
                attachments={guideDraft}
                onChange={setGuideDraft}
              />
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button onClick={() => setShowGuideForm(false)} className="btn-secondary">
                  取消
                </button>
                <button onClick={handleGuideSave} className="btn-primary" disabled={guideSaving}>
                  {guideSaving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
