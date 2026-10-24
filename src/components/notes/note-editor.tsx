"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, Bold, Check, CheckSquare, ChevronDown, Clock3, Code2, Download, FileText, Heading1, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, LoaderCircle, MoreHorizontal, Pin, Quote, Redo2, RotateCcw, Save, Sparkles, Strikethrough, Table2, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AiNoteTools, type AiNoteAction } from "@/components/workspace/ai-note-tools";
import { useWorkspaceResource } from "@/components/workspace/use-workspace";
import { useApp } from "@/components/app-provider";
import { notifyFeedback } from "@/lib/feedback";
import { operationsRequest } from "@/lib/operations";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { removeNoteDraft, saveNoteDraft, type NoteDraft, type NoteSnapshot } from "@/lib/note-center-drafts";
import { NoteRichEditor, type NoteEditorInstance } from "@/components/notes/note-rich-editor";
import type { WorkspaceRow } from "@/lib/workspace";
import type { AppData } from "@/lib/model";

const BUCKET = "moonclean-service-attachments";
const buttons = "grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-[var(--mc-tint-blue)] hover:text-primary disabled:opacity-40";
function derivedTitle(body: string) {
  const first = body.replace(/<[^>]*>/g, "").split(/\r?\n/).map(line => line.replace(/^\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/, "").replace(/[`*_~]/g, "").trim()).find(Boolean);
  return (first || "未命名笔记").slice(0, 72);
}
function rowSnapshot(row: WorkspaceRow): NoteSnapshot {
  return {
    id: String(row.id),
    title: String(row.title || "未命名笔记"),
    title_is_auto: Boolean(row.title_is_auto),
    body_markdown: String(row.body_markdown || ""),
    category: String(row.category || "未分类"),
    folder: String(row.folder || ""),
    folder_id: typeof row.folder_id === "string" ? row.folder_id : null,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    is_pinned: Boolean(row.is_pinned),
    is_favorite: Boolean(row.is_favorite),
    related_type: (typeof row.related_type === "string" ? row.related_type : null) as NoteSnapshot["related_type"],
    related_id: typeof row.related_id === "string" ? row.related_id : null,
  };
}
function normalizeDraft(note: NoteSnapshot, baseUpdatedAt: string | null, isNew: boolean): NoteDraft {
  return { note, baseUpdatedAt, isNew, savedAt: new Date().toISOString() };
}

export function NoteEditor({ note, draft, availableNotes, folders, onClose, onDelete, onArchive, canEdit, createNote, updateNote, refreshNotes }: {
  note: WorkspaceRow;
  draft: NoteDraft | undefined;
  availableNotes: WorkspaceRow[];
  folders: WorkspaceRow[];
  onClose: () => void;
  onDelete: () => Promise<void>;
  onArchive: () => Promise<void>;
  canEdit: boolean;
  createNote: (value: Record<string, unknown>) => Promise<WorkspaceRow | void>;
  updateNote: (value: Record<string, unknown>) => Promise<WorkspaceRow | void>;
  refreshNotes: () => Promise<boolean>;
}) {
  const router = useRouter();
  const { mode, activeStoreId, user, update: updateAppData, data } = useApp();
  const userId = user?.id || "local";
  const { rows: versions } = useWorkspaceResource("note-versions", "notes");
  const experiments = useWorkspaceResource("experiments", "notes");
  const competitors = useWorkspaceResource("competitors", "notes");
  const cases = useWorkspaceResource("service-cases", "notes");
  const conversations = useWorkspaceResource("copilot-conversations", "notes");
  const noteId = String(note.id);
  const original = useMemo(() => rowSnapshot(note), [note]);
  const initial = useMemo(() => ({ draft: draft || null, value: draft?.note || original }), [draft, original]);
  const [value, setValue] = useState<NoteSnapshot>(initial.value);
  const activeTitle = value.title.trim() || derivedTitle(value.body_markdown);
  const remoteUpdatedAt = String(note.__remote_updated_at || note.updated_at || "");
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(initial.draft?.baseUpdatedAt || remoteUpdatedAt);
  const initialConflict = Boolean(initial.draft?.baseUpdatedAt && remoteUpdatedAt && baseUpdatedAt !== remoteUpdatedAt && !initial.draft.isNew);
  const [saveStatus, setSaveStatus] = useState(initialConflict ? "发现版本冲突" : initial.draft ? "未同步" : "已保存");
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [internalLinkOpen, setInternalLinkOpen] = useState(false);
  const [internalLinkTarget, setInternalLinkTarget] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [restoreVersionTarget, setRestoreVersionTarget] = useState<WorkspaceRow | null>(null);
  const [conflict, setConflict] = useState(initialConflict);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [folderId, setFolderId] = useState(value.folder_id || "");
  const [tagsText, setTagsText] = useState(value.tags.join(", "));
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<NoteEditorInstance>(null);
  const valueRef = useRef(value);
  const revisionRef = useRef(0);
  const persistedRef = useRef(Boolean(note.created_at) && !Boolean(initial.draft?.isNew));
  const savingRef = useRef(false);
  const retryRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const saveNowRef = useRef<() => Promise<void>>(async () => {});
  const dirtyRef = useRef(Boolean(initial.draft));
  const localDraftStoredRef = useRef(Boolean(initial.draft));

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => {
    const node = document.body;
    node.classList.add("notes-center-editor-open");
    const updateViewport = () => {
      const visual = window.visualViewport;
      node.style.setProperty("--note-visual-bottom", visual ? `${Math.max(0, window.innerHeight - visual.height - visual.offsetTop)}px` : "0px");
    };
    updateViewport();
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    return () => {
      node.classList.remove("notes-center-editor-open");
      node.style.removeProperty("--note-visual-bottom");
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
    };
  }, []);

  const persistDraft = useCallback((next: NoteSnapshot, isNew = !persistedRef.current) => {
    if (!activeStoreId) return false;
    const stored = saveNoteDraft(userId, activeStoreId, normalizeDraft(next, baseUpdatedAt || null, isNew));
    localDraftStoredRef.current = stored;
    return stored;
  }, [activeStoreId, baseUpdatedAt, userId]);

  const saveNow = async () => {
    if (!activeStoreId || !canEdit || !dirtyRef.current) return;
    if (savingRef.current) { retryRef.current = true; return; }
    if (mode === "cloud" && !navigator.onLine) { setSaveStatus(localDraftStoredRef.current ? "离线，本地草稿已保留" : "离线，浏览器无法暂存这条笔记"); return; }
    savingRef.current = true;
    retryRef.current = false;
    const capturedRevision = revisionRef.current;
    const current = valueRef.current;
    const titleValue = current.title.trim() || derivedTitle(current.body_markdown);
    const fields = {
      id: noteId,
      title: titleValue,
      title_is_auto: !current.title.trim(),
      body_markdown: current.body_markdown,
      category: current.category || "未分类",
      folder: current.folder,
      folder_id: current.folder_id,
      tags: current.tags,
      is_pinned: current.is_pinned,
      is_favorite: current.is_favorite,
      related_type: current.related_type,
      related_id: current.related_id,
    };
    setSaveStatus("保存中");
    try {
      const result = persistedRef.current
        ? await updateNote({ ...fields, expectedUpdatedAt: baseUpdatedAt || undefined, __silent: true })
        : await createNote(fields);
      if (result && typeof result.updated_at === "string") setBaseUpdatedAt(result.updated_at);
      persistedRef.current = true;
      if (capturedRevision === revisionRef.current) {
        dirtyRef.current = false;
        localDraftStoredRef.current = true;
        if (activeStoreId) removeNoteDraft(userId, activeStoreId, noteId);
        setSaveStatus("已保存");
      } else {
        if (activeStoreId) localDraftStoredRef.current = saveNoteDraft(userId, activeStoreId, normalizeDraft(valueRef.current, baseUpdatedAt || null, false));
        setSaveStatus("正在同步新改动");
        retryRef.current = true;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "保存失败";
      if (/另一设备更新|冲突/.test(message)) {
        setConflict(true);
        setSaveStatus("发现版本冲突");
        void refreshNotes();
      } else {
        setSaveStatus(mode === "cloud" && !navigator.onLine ? localDraftStoredRef.current ? "离线，本地草稿已保留" : "离线，浏览器无法暂存这条笔记" : localDraftStoredRef.current ? "保存失败，本地草稿已保留" : "保存失败，浏览器无法暂存这条笔记");
      }
    } finally {
      savingRef.current = false;
      if (retryRef.current && dirtyRef.current) {
        retryRef.current = false;
        timerRef.current = window.setTimeout(() => { void saveNowRef.current(); }, 500);
      }
    }
  };

  // Keep event and debounce callbacks pointed at the latest save implementation.
  useEffect(() => { saveNowRef.current = saveNow; });

  const scheduleSave = useCallback((next: NoteSnapshot) => {
    if (!canEdit || !activeStoreId) return;
    valueRef.current = next;
    revisionRef.current += 1;
    dirtyRef.current = true;
    const stored = persistDraft(next);
    setSaveStatus(stored ? "未同步" : "本地暂存失败，正在尝试云端保存");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { void saveNowRef.current(); }, 950);
  }, [activeStoreId, canEdit, persistDraft]);

  useEffect(() => {
    if (!initial.draft || initialConflict) return;
    timerRef.current = window.setTimeout(() => { void saveNowRef.current(); }, 950);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [initial.draft, initialConflict]);
  useEffect(() => {
    const onOnline = () => { if (dirtyRef.current) void saveNowRef.current(); };
    const onPageHide = () => { if (dirtyRef.current) persistDraft(valueRef.current); };
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (dirtyRef.current) persistDraft(valueRef.current);
    };
  }, [persistDraft]);

  const change = useCallback((patch: Partial<NoteSnapshot>) => {
    const next = { ...valueRef.current, ...patch };
    setValue(next);
    scheduleSave(next);
  }, [scheduleSave]);
  const setTitle = (title: string) => change({ title, title_is_auto: !title.trim() });
  const setFolder = (folder: string) => {
    const item = folders.find(entry => entry.id === folder);
    setFolderId(folder);
    change({ folder_id: folder || null, folder: item ? String(item.name) : "" });
  };
  const setTags = (text: string) => {
    setTagsText(text);
    change({ tags: [...new Set(text.split(",").map(tag => tag.trim()).filter(Boolean))].slice(0, 30) });
  };
  const setRelatedType = (related_type: string) => change({ related_type: related_type ? related_type as NoteSnapshot["related_type"] : null, related_id: null });
  const setRelatedId = (related_id: string) => change({ related_id: related_id || null });

  const relatedOptions = value.related_type === "product" ? (data?.products || []).map(product => ({ id: product.id, label: product.name }))
    : value.related_type === "sku" ? (data?.products || []).flatMap(product => product.skus.map(sku => ({ id: sku.id, label: `${product.name} · ${sku.name}` })))
      : value.related_type === "experiment" ? experiments.rows.map(row => ({ id: String(row.id), label: String(row.name) }))
        : value.related_type === "competitor" ? competitors.rows.map(row => ({ id: String(row.id), label: String(row.product_name) }))
          : value.related_type === "service_case" ? cases.rows.map(row => ({ id: String(row.id), label: `${String(row.order_number || "售后工单")} · ${String(row.issue_category)}` }))
            : value.related_type === "copilot_conversation" ? conversations.rows.map(row => ({ id: String(row.id), label: String(row.title) })) : [];

  const createTask = async () => {
    if (!activeStoreId) return;
    const task = { title: `跟进：${activeTitle}`, detail: value.body_markdown.slice(0, 900), priority: "normal" as const, status: "todo" as const, dueDate: null, sourceModule: "notes" as const, sourceId: noteId };
    try {
      if (mode === "cloud") await operationsRequest(activeStoreId, "tasks", task, "POST");
      else await updateAppData((current: AppData) => ({ ...current, tasks: [{ ...task, source_module: task.sourceModule, source_id: task.sourceId, id: crypto.randomUUID(), due_date: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...(current.tasks || [])] }));
      notifyFeedback({ kind: "success", title: "已转为运营待办", description: "可在待办页面跟进，并从任务返回这条笔记。" });
    } catch (cause) { notifyFeedback({ kind: "error", title: "创建待办失败", description: cause instanceof Error ? cause.message : "请检查网络后重试。" }); }
  };
  const createExperiment = async () => {
    try {
      const experiment = await experiments.create({ name: `验证笔记方案：${activeTitle}`.slice(0, 180), experiment_type: "custom", status: "draft", test_design: "before_after", source_note_id: noteId, hypothesis: value.body_markdown.slice(0, 3900) });
      if (experiment && "id" in experiment) router.push("/experiments");
    } catch (cause) { notifyFeedback({ kind: "error", title: "从笔记创建实验失败", description: cause instanceof Error ? cause.message : "请检查内容后重试。" }); }
  };

  const editorReady = useCallback((editor: NoteEditorInstance) => { editorRef.current = editor; }, []);
  const bodyChanged = useCallback((body_markdown: string) => change({ body_markdown }), [change]);
  const command = (run: (editor: NonNullable<NoteEditorInstance>) => void) => {
    const editor = editorRef.current;
    if (!editor) return;
    run(editor);
    editor.commands.focus();
  };
  const insertLink = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setLinkUrl("");
    setLinkDialogOpen(true);
  };
  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith("/notes?id=")) { notifyFeedback({ kind: "error", title: "链接格式无效", description: "请使用 https:// 链接或笔记中心内部链接。" }); return; }
    command(current => current.chain().focus().extendMarkRange("link").setLink({ href: url, target: url.startsWith("/") ? null : "_blank" }).run());
    setLinkDialogOpen(false);
  };
  const uploadAttachment = async (file?: File) => {
    if (!file || !activeStoreId || mode !== "cloud") return;
    if (!new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]).has(file.type) || file.size > 10 * 1024 * 1024) {
      notifyFeedback({ kind: "error", title: "附件不符合上传要求", description: "支持 JPG、PNG、WebP 或 PDF，单个文件不超过 10 MB。" }); return;
    }
    setUploadBusy(true);
    try {
      const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
      const path = `${activeStoreId}/notes/${noteId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createBrowserSupabaseClient().storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      if (file.type === "application/pdf") command(editor => editor.chain().focus().insertContent({ type: "text", text: `📎 ${file.name}`, marks: [{ type: "link", attrs: { href: `moonclean-attachment://${path}` } }] }).run());
      else command(editor => editor.chain().focus().setImage({ src: `moonclean-attachment://${path}`, alt: file.name }).run());
    } catch (cause) {
      notifyFeedback({ kind: "error", title: "图片上传失败", description: cause instanceof Error ? cause.message : "请检查网络后重试。" });
    } finally { setUploadBusy(false); }
  };
  const exportNote = () => {
    const markdown = `# ${value.title.trim() || derivedTitle(value.body_markdown)}\n\n${value.body_markdown}`;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${(value.title || "笔记").replace(/[\\/:*?"<>|]/g, "-")}.md`; anchor.click(); URL.revokeObjectURL(url);
  };
  const insertInternalLink = () => {
    const target = availableNotes.find(entry => entry.id === internalLinkTarget);
    if (!target) return;
    const text = String(target.title_is_auto ? derivedTitle(String(target.body_markdown || "")) : target.title || "未命名笔记");
    command(editor => editor.chain().focus().insertContent({ type: "text", text, marks: [{ type: "link", attrs: { href: `/notes?id=${encodeURIComponent(String(target.id))}` } }] }).run());
    setInternalLinkOpen(false);
    setInternalLinkTarget("");
  };
  const navigateEditorLink = async (event: React.MouseEvent) => {
    const anchor = (event.target as HTMLElement).closest("a[href]");
    const href = anchor?.getAttribute("href") || "";
    if (href.startsWith("/notes?id=")) { event.preventDefault(); router.push(href); return; }
    if (!href.startsWith("moonclean-attachment://")) return;
    event.preventDefault();
    const path = href.slice("moonclean-attachment://".length);
    if (!activeStoreId || !path.startsWith(`${activeStoreId}/notes/`)) { notifyFeedback({ kind: "error", title: "附件路径无效", description: "当前账号无法读取此附件。" }); return; }
    const opened = window.open("about:blank", "_blank");
    if (opened) opened.opener = null;
    try {
      const { data: signed, error } = await createBrowserSupabaseClient().storage.from(BUCKET).createSignedUrl(path, 300);
      if (error) throw error;
      if (opened) opened.location.href = signed.signedUrl;
    } catch (cause) {
      opened?.close();
      notifyFeedback({ kind: "error", title: "无法打开附件", description: cause instanceof Error ? cause.message : "请稍后重试。" });
    }
  };
  const versionsForNote = versions.filter(version => version.note_id === noteId).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const restoreVersion = (version: WorkspaceRow) => {
    change({ title: String(version.title || ""), title_is_auto: false, body_markdown: String(version.body_markdown || "") });
    editorRef.current?.commands.setContent(String(version.body_markdown || ""), { contentType: "markdown" });
    setShowVersions(false);
    setRestoreVersionTarget(null);
  };

  const formatButtons = [
    ["粗体", Bold, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().toggleBold().run(), "bold"],
    ["斜体", Italic, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().toggleItalic().run(), "italic"],
    ["删除线", Strikethrough, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().toggleStrike().run(), "strike"],
    ["标题 1", Heading1, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().toggleHeading({ level: 1 }).run(), "h1"],
    ["标题 2", Heading2, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().toggleHeading({ level: 2 }).run(), "h2"],
    ["标题 3", Heading3, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().toggleHeading({ level: 3 }).run(), "h3"],
    ["无序列表", List, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().toggleBulletList().run(), "bullet"],
    ["有序列表", ListOrdered, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().toggleOrderedList().run(), "ordered"],
    ["待办清单", CheckSquare, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().toggleTaskList().run(), "task"],
    ["引用块", Quote, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().toggleBlockquote().run(), "quote"],
    ["表格", Table2, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), "table"],
  ] as const;

  return <section className="notes-editor-shell" aria-label="笔记编辑器" onClickCapture={event => { void navigateEditorLink(event); }}>
    <header className="notes-editor-header">
      <Button size="icon-sm" variant="ghost" aria-label="返回笔记列表" onClick={onClose}><ArrowLeft size={18}/></Button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{saveStatus === "保存中" ? <><LoaderCircle className="mr-1 inline animate-spin" size={12}/></> : saveStatus === "已保存" ? <Check className="mr-1 inline text-[var(--mc-color-success)]" size={13}/> : null}{saveStatus}</p>
        <p className="truncate text-[10px] text-muted-foreground/75">{value.category} · {note.updated_at || note.created_at ? new Date(String(note.updated_at || note.created_at)).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }) : "新建笔记"}</p>
      </div>
      <Button size="icon-sm" variant="ghost" aria-label="立即保存" title="立即保存" disabled={!canEdit || saveStatus === "保存中"} onClick={() => void saveNowRef.current()}><Save size={16}/></Button>
      <div className="relative">
        <Button size="icon-sm" variant="ghost" aria-label="更多笔记操作" title="更多" onClick={() => setMenuOpen(open => !open)}><MoreHorizontal size={18}/></Button>
        {menuOpen && <>
          <button aria-label="关闭菜单" className="fixed inset-0 z-20 cursor-default" onClick={() => setMenuOpen(false)}/>
          <div className="notes-editor-menu absolute right-0 top-10 z-30 w-64 rounded-xl border border-border bg-card p-2 shadow-xl">
            <label className="mb-2 block px-2 text-[10px] font-semibold text-muted-foreground">分类与整理</label>
            <label className="mb-2 block px-2 text-xs">分类<input className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs" value={value.category} maxLength={80} disabled={!canEdit} onChange={event => change({ category: event.target.value })}/></label>
            <label className="mb-2 block px-2 text-xs">文件夹<select className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs" value={folderId} disabled={!canEdit} onChange={event => setFolder(event.target.value)}><option value="">收件箱</option>{folders.filter(folder => !folder.deleted_at).map(folder => <option key={folder.id} value={String(folder.id)}>{String(folder.name)}</option>)}</select></label>
            <label className="mb-2 block px-2 text-xs">标签<input className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs" value={tagsText} placeholder="多个标签用逗号分隔" disabled={!canEdit} onChange={event => setTags(event.target.value)}/></label>
            <label className="mb-2 block px-2 text-xs">关联业务<select className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs" value={value.related_type || ""} disabled={!canEdit} onChange={event => setRelatedType(event.target.value)}><option value="">不关联</option><option value="product">商品</option><option value="sku">SKU</option><option value="experiment">运营实验</option><option value="competitor">竞品</option><option value="service_case">售后工单</option><option value="copilot_conversation">AI 分析会话</option></select></label>
            {value.related_type && <label className="mb-2 block px-2 text-xs">关联记录<select className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs" value={value.related_id || ""} disabled={!canEdit} onChange={event => setRelatedId(event.target.value)}><option value="">请选择记录</option>{relatedOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
            <div className="my-2 border-t border-border"/>
            <button className="notes-menu-item" onClick={() => { change({ is_pinned: !value.is_pinned }); setMenuOpen(false); }}><Pin size={14}/>{value.is_pinned ? "取消置顶" : "置顶笔记"}</button>
            <button className="notes-menu-item" onClick={() => { change({ is_favorite: !value.is_favorite }); setMenuOpen(false); }}>{value.is_favorite ? "★" : "☆"}{value.is_favorite ? "取消收藏" : "收藏笔记"}</button>
            <button className="notes-menu-item" disabled={!canEdit} onClick={() => { setMenuOpen(false); void createTask(); }}><CheckSquare size={14}/>转为运营待办</button>
            <button className="notes-menu-item" disabled={!canEdit} onClick={() => { setMenuOpen(false); void createExperiment(); }}><FileText size={14}/>根据笔记创建实验</button>
            <button className="notes-menu-item" onClick={() => { setShowVersions(true); setMenuOpen(false); }}><Clock3 size={14}/>历史版本</button>
            <button className="notes-menu-item" onClick={() => { exportNote(); setMenuOpen(false); }}><Download size={14}/>导出 Markdown</button>
            {value.related_type && value.related_id && <button className="notes-menu-item" onClick={() => { const route = value.related_type === "product" || value.related_type === "sku" ? "/products" : value.related_type === "experiment" ? "/experiments" : value.related_type === "competitor" ? "/competitors" : value.related_type === "service_case" ? "/service" : "/copilot"; const key = value.related_type === "copilot_conversation" ? "conversation" : "id"; router.push(`${route}?${key}=${encodeURIComponent(value.related_id || "")}`); }}><Link2 size={14}/>打开关联业务记录</button>}
            <button className="notes-menu-item" onClick={() => { setInternalLinkOpen(true); setMenuOpen(false); }}><Link2 size={14}/>插入笔记链接</button>
            <button className="notes-menu-item" disabled={!canEdit} onClick={async () => { setMenuOpen(false); await onArchive(); }}><Archive size={14}/>归档</button>
            <button className="notes-menu-item text-[var(--mc-color-danger)]" disabled={!canEdit} onClick={() => { setMenuOpen(false); setConfirmDeleteOpen(true); }}><Trash2 size={14}/>移入回收站</button>
          </div>
        </>}
      </div>
    </header>

    <div className="notes-editor-scroll">
      <div className="notes-editor-document">
        <Input aria-label="笔记标题" value={value.title_is_auto ? "" : value.title} onChange={event => setTitle(event.target.value)} maxLength={240} disabled={!canEdit} placeholder={activeTitle} className="note-title-input"/>
        {value.title_is_auto && <p className="-mt-1 mb-4 text-[10px] text-muted-foreground">自动标题 · 输入标题即可自定义</p>}
        <div className="note-editor-toolbar" aria-label="笔记格式工具栏">
          {formatButtons.slice(0, 3).map(([label, Icon, run, key]) => <button key={key} className={buttons} aria-label={label} title={label} disabled={!canEdit} onClick={() => command(run)}><Icon size={16}/></button>)}
          <span className="mx-1 h-5 w-px bg-border"/>
          {formatButtons.slice(3, 6).map(([label, Icon, run, key]) => <button key={key} className={buttons} aria-label={label} title={label} disabled={!canEdit} onClick={() => command(run)}><Icon size={16}/></button>)}
          <span className="mx-1 h-5 w-px bg-border"/>
          {formatButtons.slice(6, 10).map(([label, Icon, run, key]) => <button key={key} className={buttons} aria-label={label} title={label} disabled={!canEdit} onClick={() => command(run)}><Icon size={16}/></button>)}
          <details className="relative">
            <summary className={`${buttons} list-none cursor-pointer`} aria-label="更多格式" title="更多格式"><ChevronDown size={15}/></summary>
            <div className="notes-format-menu absolute left-0 top-10 z-20 flex min-w-44 flex-col rounded-xl border border-border bg-card p-1.5 shadow-xl">
              {[formatButtons[10], ["分割线", Code2, (editor: NonNullable<NoteEditorInstance>) => editor.chain().focus().setHorizontalRule().run(), "rule"] as const].map(([label, Icon, run, key]) => <button key={key} className="notes-menu-item" onClick={() => command(run)}><Icon size={14}/>{label}</button>)}
              <button className="notes-menu-item" onClick={insertLink}><Link2 size={14}/>插入超链接</button>
              <button className="notes-menu-item" title={mode === "cloud" ? "支持 JPG、PNG、WebP 或 PDF，单个文件不超过 10 MB" : "连接云端店铺后可上传附件"} onClick={() => fileInput.current?.click()} disabled={!canEdit || mode !== "cloud" || uploadBusy}><ImagePlus size={14}/>{uploadBusy ? "附件上传中…" : "插入图片或 PDF"}</button>
              <span className="my-1 border-t border-border"/>
              <button className="notes-menu-item" onClick={() => command(editor => editor.chain().focus().undo().run())}><Undo2 size={14}/>撤销</button>
              <button className="notes-menu-item" onClick={() => command(editor => editor.chain().focus().redo().run())}><Redo2 size={14}/>重做</button>
              <button className="notes-menu-item" onClick={() => setAiOpen(open => !open)}><Sparkles size={14}/>AI 笔记助手</button>
            </div>
          </details>
          <button className={buttons} aria-label="撤销" title="撤销" disabled={!canEdit} onClick={() => command(editor => editor.chain().focus().undo().run())}><Undo2 size={15}/></button>
          <button className={buttons} aria-label="重做" title="重做" disabled={!canEdit} onClick={() => command(editor => editor.chain().focus().redo().run())}><Redo2 size={15}/></button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={event => { void uploadAttachment(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
        </div>
        <NoteRichEditor value={value.body_markdown} onChange={bodyChanged} editable={canEdit} storeId={activeStoreId} onUploadImage={() => fileInput.current?.click()} onEditorReady={editorReady}/>

        {(conflict || initialConflict) && <div role="alert" className="mt-4 rounded-xl border border-[var(--mc-color-warning)]/30 bg-[var(--mc-tint-yellow)] p-3 text-xs leading-5">
          <p className="font-semibold">这条笔记在另一设备有更新</p><p className="mt-1 text-muted-foreground">你的本机内容仍已保留。选择云端版本，或确认用本机版本覆盖云端。</p>
          <div className="mt-2 flex gap-2"><Button size="xs" variant="outline" onClick={() => { const remote = rowSnapshot((note.__remote_note as WorkspaceRow | undefined) || note); valueRef.current = remote; setValue(remote); setFolderId(remote.folder_id || ""); setTagsText(remote.tags.join(", ")); editorRef.current?.commands.setContent(remote.body_markdown, { contentType: "markdown" }); setBaseUpdatedAt(String(note.__remote_updated_at || note.updated_at || "")); dirtyRef.current = false; if (activeStoreId) removeNoteDraft(userId, activeStoreId, noteId); setConflict(false); setSaveStatus("已保存"); }}>使用云端版本</Button><Button size="xs" onClick={() => { setBaseUpdatedAt(String(note.__remote_updated_at || note.updated_at || "")); setConflict(false); dirtyRef.current = true; void saveNowRef.current(); }}>保留本机版本</Button></div>
        </div>}
        {saveStatus !== "已保存" && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--mc-tint-blue)]/55 px-3 py-2 text-[10px] text-muted-foreground"><span>{saveStatus}</span>{saveStatus.includes("失败") || saveStatus.includes("离线") ? <Button size="xs" variant="outline" onClick={() => void saveNowRef.current()}><RotateCcw size={12}/>重试同步</Button> : null}</div>}
      </div>
    </div>
    <div className="notes-editor-bottom-bar">
      <div className="flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground"><FileText size={13}/><span className="truncate">{value.folder || "收件箱"}</span><span>·</span><span>{value.tags.length ? `${value.tags.length} 个标签` : "无标签"}</span></div>
      <Button type="button" size="xs" variant="ghost" className="notes-editor-ai-trigger shrink-0" onClick={(event) => { event.stopPropagation(); setAiOpen(true); }}><Sparkles size={14}/>AI</Button>
    </div>

    <Dialog open={aiOpen} onOpenChange={setAiOpen}><DialogContent className="max-h-[82dvh] overflow-y-auto overscroll-contain sm:max-w-xl"><DialogHeader className="sr-only"><DialogTitle>AI 笔记助手</DialogTitle><DialogDescription>选择 AI 操作并预览生成结果。</DialogDescription></DialogHeader><AiNoteTools key={noteId} storeId={activeStoreId} enabled={mode === "cloud" && canEdit} title={activeTitle} content={value.body_markdown} onApply={(action: AiNoteAction, result: string) => {
      if (action === "title") { setTitle(result.trim().replace(/^#+\s*/, "").replace(/^['"“”]+|['"“”]+$/g, "").slice(0, 240)); setAiOpen(false); return; }
      if (action === "tags") {
        const tags = [...new Set(result.split(/[\n,，、;；]+/).map(tag => tag.replace(/^\s*[-*#\d.)]+\s*/, "").trim().replace(/^#/, "")).filter(Boolean))].slice(0, 30);
        setTags(tags.join(", ")); setAiOpen(false); return;
      }
      const replace = action === "polish" || action === "structure";
      const sectionTitle = action === "summarize" ? "摘要" : action === "todos" ? "待办事项" : action === "retrospective" ? "运营复盘" : "AI 建议";
      const body = replace ? result : `${value.body_markdown}${value.body_markdown ? "\n\n" : ""}## ${sectionTitle}\n\n${result}`;
      change({ body_markdown: body });
      editorRef.current?.commands.setContent(body, { contentType: "markdown" });
      setAiOpen(false);
    }}/></DialogContent></Dialog>

    <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>插入超链接</DialogTitle><DialogDescription>输入 https:// 地址，或使用笔记中心内部链接。</DialogDescription></DialogHeader><Input autoFocus aria-label="链接地址" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} placeholder="https://example.com"/><DialogFooter><Button variant="ghost" onClick={() => setLinkDialogOpen(false)}>取消</Button><Button disabled={!linkUrl.trim()} onClick={applyLink}>插入链接</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={internalLinkOpen} onOpenChange={setInternalLinkOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>插入笔记链接</DialogTitle><DialogDescription>选择一条笔记，在正文中创建内部链接。</DialogDescription></DialogHeader><select aria-label="选择目标笔记" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs" value={internalLinkTarget} onChange={event => setInternalLinkTarget(event.target.value)}><option value="">选择笔记</option>{availableNotes.filter(entry => entry.id !== noteId).map(entry => <option key={entry.id} value={String(entry.id)}>{entry.title_is_auto ? derivedTitle(String(entry.body_markdown || "")) : String(entry.title || "未命名笔记")}</option>)}</select><DialogFooter><Button variant="ghost" onClick={() => setInternalLinkOpen(false)}>取消</Button><Button disabled={!internalLinkTarget} onClick={insertInternalLink}><Link2 size={14}/>插入链接</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={showVersions} onOpenChange={setShowVersions}><DialogContent className="max-h-[80dvh] overflow-hidden sm:max-w-xl"><DialogHeader><DialogTitle>历史版本</DialogTitle><DialogDescription>正文发生变化时由数据库自动留存。</DialogDescription></DialogHeader><div className="max-h-[60dvh] divide-y divide-border overflow-y-auto">{versionsForNote.length ? versionsForNote.map(version => <article key={version.id} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="text-xs font-medium">{String(version.title || "未命名笔记")}</p><p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{String(version.body_markdown || "")}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(String(version.created_at)).toLocaleString("zh-CN")}</p></div><Button size="xs" variant="outline" onClick={() => setRestoreVersionTarget(version)}>载入</Button></article>) : <p className="p-8 text-center text-xs text-muted-foreground">暂无历史版本</p>}</div></DialogContent></Dialog>
    <AlertDialog open={Boolean(restoreVersionTarget)} onOpenChange={open => { if (!open) setRestoreVersionTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>载入此历史版本？</AlertDialogTitle><AlertDialogDescription>当前正文会先按自动保存规则保存，再载入所选历史正文。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={event => { event.preventDefault(); if (restoreVersionTarget) restoreVersion(restoreVersionTarget); }}>载入版本</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>将笔记移入回收站？</AlertDialogTitle><AlertDialogDescription>你可以之后从回收站恢复这条笔记。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={event => { event.preventDefault(); setConfirmDeleteOpen(false); void onDelete(); }}>移入回收站</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
