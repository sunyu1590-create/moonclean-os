"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Clock3, Copy, FilePlus2, Folder, FolderPlus, LayoutGrid, List, MoreHorizontal, Pin, Plus, Search, Settings2, Star, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useApp } from "@/components/app-provider";
import { useWorkspaceResource } from "@/components/workspace/use-workspace";
import { notifyFeedback } from "@/lib/feedback";
import { listNoteDrafts, readNoteDraft, removeNoteDraft, saveNoteDraft, type NoteDraft, type NoteSnapshot } from "@/lib/note-center-drafts";
import type { WorkspaceRow } from "@/lib/workspace";
import { NoteEditor } from "@/components/notes/note-editor";

type Filter = "all" | "pinned" | "recent" | "favorites" | "archive" | "trash" | `folder:${string}`;
type EditorLayout = "standard" | "wide" | "immersive";
const EDITOR_LAYOUT_KEY = "moonclean-notes-editor-layout";
function plainMarkdown(value: string) {
  return value.replace(/!\[[^\]]*\]\([^)]+\)/g, "图片").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/^\s{0,3}#{1,6}\s+/gm, "").replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*\d+[.)]\s+/gm, "").replace(/^\s*>\s?/gm, "").replace(/[`*_~]/g, "").replace(/\|/g, " ").replace(/\s+/g, " ").trim();
}
function displayTitle(row: WorkspaceRow) {
  if (!row.title_is_auto && String(row.title || "").trim()) return String(row.title);
  const firstLine = String(row.body_markdown || "").split(/\r?\n/).map(line => line.replace(/^\s{0,3}(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/, "").replace(/[`*_~]/g, "").trim()).find(Boolean);
  return (firstLine || "未命名笔记").slice(0, 72);
}
function relativeDate(value: unknown) {
  if (!value) return "刚刚";
  const time = new Date(String(value)).getTime();
  if (!Number.isFinite(time)) return "刚刚";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)} 天前`;
  return new Date(time).toLocaleDateString("zh-CN");
}
function noteFromDraft(draft: NoteDraft, storeId: string): WorkspaceRow {
  return { ...draft.note, store_id: storeId, created_by: "local-draft", created_at: draft.isNew ? undefined : draft.savedAt, updated_at: draft.savedAt, archived_at: null, deleted_at: null, __remote_updated_at: draft.baseUpdatedAt || undefined, __note_draft: true };
}

export function NotesCenter({ initialNoteId = "" }: { initialNoteId?: string }) {
  const router = useRouter();
  const { activeStoreId, mode, user, role } = useApp();
  const notes = useWorkspaceResource("notes", "notes");
  const { rows: noteRows, loading: notesLoading, refresh: refreshNotes, create: createNoteResource, update: updateNoteResource } = notes;
  const foldersResource = useWorkspaceResource("note-folders", "notes");
  const [selectedId, setSelectedId] = useState(initialNoteId);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLocaleLowerCase());
  const [view, setView] = useState<"list" | "cards">("list");
  const [pageSize, setPageSize] = useState(50);
  const [drafts, setDrafts] = useState<NoteDraft[]>([]);
  const [folderDialog, setFolderDialog] = useState<{ mode: "create" } | { mode: "rename"; folder: WorkspaceRow } | null>(null);
  const [folderName, setFolderName] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<WorkspaceRow | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<WorkspaceRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [listWidth, setListWidth] = useState(350);
  const [editorLayout, setEditorLayout] = useState<EditorLayout>("standard");
  const previousLayoutRef = useRef<EditorLayout>("standard");
  const gridRef = useRef<HTMLDivElement>(null);
  const syncingOutboxRef = useRef(false);
  const canEdit = mode === "local" || role !== "viewer";

  useEffect(() => {
    const saved = window.localStorage.getItem(EDITOR_LAYOUT_KEY);
    // Restore the last browser preference after hydration without changing the server-rendered layout.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "standard" || saved === "wide" || saved === "immersive") setEditorLayout(saved);
  }, []);
  const chooseEditorLayout = useCallback((layout: EditorLayout) => {
    if (layout === "immersive" && editorLayout !== "immersive") previousLayoutRef.current = editorLayout;
    setEditorLayout(layout);
    window.localStorage.setItem(EDITOR_LAYOUT_KEY, layout);
  }, [editorLayout]);
  const exitImmersive = useCallback(() => {
    const layout = previousLayoutRef.current === "immersive" ? "standard" : previousLayoutRef.current;
    setEditorLayout(layout);
    window.localStorage.setItem(EDITOR_LAYOUT_KEY, layout);
  }, []);
  useEffect(() => {
    if (!selectedId || editorLayout !== "immersive") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); exitImmersive(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorLayout, exitImmersive, selectedId]);

  const reloadDrafts = useCallback(() => setDrafts(activeStoreId ? listNoteDrafts(user?.id || "local", activeStoreId) : []), [activeStoreId, user?.id]);
  useEffect(() => {
    // Reading the browser outbox here synchronizes this view with persisted local drafts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadDrafts();
  }, [reloadDrafts]);
  useEffect(() => {
    const reload = () => reloadDrafts();
    window.addEventListener("moonclean-note-draft-changed", reload);
    window.addEventListener("storage", reload);
    return () => { window.removeEventListener("moonclean-note-draft-changed", reload); window.removeEventListener("storage", reload); };
  }, [reloadDrafts]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('[aria-label="搜索笔记"]')?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const activeFolders = useMemo(() => foldersResource.rows.filter(folder => !folder.deleted_at).sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-CN")), [foldersResource.rows]);
  const folderById = useMemo(() => new Map(activeFolders.map(folder => [String(folder.id), String(folder.name)])), [activeFolders]);
  const allNotes = useMemo(() => {
    const rowById = new Map(notes.rows.map(row => [row.id, row]));
    const localById = new Map(drafts.map(draft => [draft.note.id, draft]));
    const combined = notes.rows.map(row => {
      const draft = localById.get(row.id);
      if (!draft) return row;
      return { ...row, ...draft.note, updated_at: draft.savedAt, __remote_updated_at: row.updated_at, __remote_note: row, __note_draft: true, deleted_at: row.deleted_at, archived_at: row.archived_at } as WorkspaceRow;
    });
    for (const draft of drafts) if (!rowById.has(draft.note.id)) combined.push(noteFromDraft(draft, activeStoreId || ""));
    return combined;
  }, [activeStoreId, drafts, notes.rows]);
  const visible = useMemo(() => {
    let result = allNotes.filter(row => {
      if (filter === "trash") return Boolean(row.deleted_at);
      if (filter === "archive") return !row.deleted_at && Boolean(row.archived_at);
      if (row.deleted_at || row.archived_at) return false;
      if (filter === "pinned" && !row.is_pinned) return false;
      if (filter === "favorites" && !row.is_favorite) return false;
      if (filter.startsWith("folder:") && String(row.folder_id || "") !== filter.slice(7)) return false;
      return true;
    });
    if (deferredSearch) result = result.filter(row => `${displayTitle(row)} ${row.title || ""} ${row.body_markdown || ""} ${row.category || ""} ${row.folder || ""} ${folderById.get(String(row.folder_id)) || ""} ${(row.tags as string[] || []).join(" ")}`.toLocaleLowerCase().includes(deferredSearch));
    result = result.sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) || String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
    return filter === "recent" ? result.slice(0, 100) : result;
  }, [allNotes, deferredSearch, filter, folderById]);
  const selected = allNotes.find(row => row.id === selectedId);
  const gridLayout: EditorLayout = editorLayout === "immersive" && !selected ? "standard" : editorLayout;

  const syncOutbox = useCallback(async () => {
    if (!activeStoreId || notesLoading || mode !== "cloud" || !navigator.onLine || syncingOutboxRef.current) return;
    syncingOutboxRef.current = true;
    let needsRetry = false;
    try {
      const queued = listNoteDrafts(user?.id || "local", activeStoreId).filter(draft => draft.note.id !== selectedId);
      for (const draft of queued) {
        const latest = readNoteDraft(user?.id || "local", activeStoreId, draft.note.id);
        if (!latest || latest.savedAt !== draft.savedAt) continue;
        const remote = noteRows.find(row => row.id === draft.note.id);
        const fields = {
          ...draft.note,
          title: draft.note.title.trim() || displayTitle({ id: draft.note.id, title: "", title_is_auto: true, body_markdown: draft.note.body_markdown } as WorkspaceRow),
          __silent: true,
        };
        const result = draft.isNew && !remote
          ? await createNoteResource(fields)
          : await updateNoteResource({ ...fields, expectedUpdatedAt: draft.baseUpdatedAt || remote?.updated_at || undefined });
        const newest = readNoteDraft(user?.id || "local", activeStoreId, draft.note.id);
        if (newest?.savedAt === draft.savedAt) removeNoteDraft(user?.id || "local", activeStoreId, draft.note.id);
        else if (newest && result && typeof result.updated_at === "string") {
          saveNoteDraft(user?.id || "local", activeStoreId, { ...newest, baseUpdatedAt: result.updated_at, isNew: false });
          needsRetry = true;
        }
      }
    } catch (cause) {
      if (/另一设备更新|冲突/.test(cause instanceof Error ? cause.message : "")) void refreshNotes(true);
    } finally {
      syncingOutboxRef.current = false;
      reloadDrafts();
      if (needsRetry && selectedId === "") window.setTimeout(() => { void syncOutboxRef.current(); }, 350);
    }
  }, [activeStoreId, createNoteResource, mode, noteRows, notesLoading, refreshNotes, reloadDrafts, selectedId, updateNoteResource, user?.id]);
  const syncOutboxRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => { syncOutboxRef.current = syncOutbox; });
  useEffect(() => {
    const sync = () => { void syncOutboxRef.current(); };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [activeStoreId, mode, notesLoading, selectedId, user?.id]);

  const openNote = (id: string) => {
    // Pull the editor's latest local outbox snapshot before replacing its mounted editor.
    reloadDrafts();
    setSelectedId(id);
    router.replace(`/notes?id=${encodeURIComponent(id)}`, { scroll: false });
  };
  const closeEditor = () => {
    reloadDrafts();
    setSelectedId("");
    router.replace("/notes", { scroll: false });
  };
  const createNote = () => {
    if (!canEdit || !activeStoreId) return;
    const id = crypto.randomUUID();
    const empty: NoteSnapshot = { id, title: "", title_is_auto: true, body_markdown: "", category: "未分类", folder: "", folder_id: null, tags: [], is_pinned: false, is_favorite: false, related_type: null, related_id: null };
    saveNoteDraft(user?.id || "local", activeStoreId, { note: empty, baseUpdatedAt: null, savedAt: new Date().toISOString(), isNew: true });
    reloadDrafts();
    openNote(id);
  };

  const report = (cause: unknown, title: string) => notifyFeedback({ kind: "error", title, description: cause instanceof Error ? cause.message : "请检查网络后重试。" });
  const createFolder = async () => {
    if (!canEdit || !activeStoreId) return;
    setFolderName("");
    setFolderDialog({ mode: "create" });
  };
  const renameFolder = (folder: WorkspaceRow) => {
    setFolderName(String(folder.name));
    setFolderDialog({ mode: "rename", folder });
  };
  const saveFolder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = folderName.trim().slice(0, 80);
    if (!name) return;
    setFolderSaving(true);
    try {
      if (folderDialog?.mode === "create") await foldersResource.create({ name });
      else if (folderDialog?.mode === "rename") {
        await foldersResource.update({ id: folderDialog.folder.id, name });
        for (const note of notes.rows.filter(row => row.folder_id === folderDialog.folder.id)) await notes.update({ id: note.id, folder: name, __silent: true });
      }
      await Promise.all([foldersResource.refresh(true), notes.refresh(true)]);
      setFolderDialog(null);
    } catch (cause) { report(cause, "文件夹操作未完全完成；笔记内容仍保留，请刷新检查"); }
    finally { setFolderSaving(false); }
  };
  const deleteFolder = async (folder: WorkspaceRow) => {
    try {
      for (const note of notes.rows.filter(row => row.folder_id === folder.id)) await notes.update({ id: note.id, folder_id: null, folder: "", __silent: true });
      await foldersResource.update({ id: folder.id, deleted_at: new Date().toISOString() });
      await Promise.all([foldersResource.refresh(true), notes.refresh(true)]);
      if (filter === `folder:${folder.id}`) setFilter("all");
      notifyFeedback({ kind: "success", title: "文件夹已删除", description: "其中的笔记已移到收件箱。" });
    } catch (cause) { report(cause, "删除未完全完成；文件夹仍保留，部分笔记可能已移到收件箱，请刷新检查"); }
  };

  const updateNote = async (id: string, update: Record<string, unknown>) => {
    try { await notes.update({ id, ...update }); }
    catch (cause) { report(cause, "笔记更新失败"); }
  };
  const archiveNote = async (row: WorkspaceRow) => { await notes.archive(String(row.id)); };
  const deleteNote = async (row: WorkspaceRow) => {
    try {
      await notes.remove(String(row.id));
      if (activeStoreId) removeNoteDraft(user?.id || "local", activeStoreId, String(row.id));
      reloadDrafts();
      if (selectedId === row.id) closeEditor();
    } catch (cause) { report(cause, "删除笔记失败，笔记仍保留在原位置"); }
  };
  const confirmFolderDelete = async () => {
    if (!folderToDelete) return;
    setDeleteBusy(true);
    try { await deleteFolder(folderToDelete); setFolderToDelete(null); }
    finally { setDeleteBusy(false); }
  };
  const confirmNoteDelete = async () => {
    if (!noteToDelete) return;
    setDeleteBusy(true);
    try { await deleteNote(noteToDelete); setNoteToDelete(null); }
    finally { setDeleteBusy(false); }
  };
  const restoreNote = async (row: WorkspaceRow) => {
    if (row.deleted_at) await notes.restore(String(row.id)); else await notes.unarchive(String(row.id));
  };
  const duplicateNote = async (row: WorkspaceRow) => {
    try {
      const copy = await notes.create({ title: `${displayTitle(row)} 副本`.slice(0, 240), title_is_auto: false, body_markdown: String(row.body_markdown || ""), category: String(row.category || "未分类"), folder: String(row.folder || ""), folder_id: row.folder_id || null, tags: [...(row.tags as string[] || [])], is_pinned: false, is_favorite: false });
      if (copy && "id" in copy) openNote(String(copy.id));
    } catch (cause) { report(cause, "复制笔记失败"); }
  };
  const moveNote = async (row: WorkspaceRow, folderId: string) => {
    const folder = activeFolders.find(item => item.id === folderId);
    await updateNote(String(row.id), { folder_id: folderId || null, folder: folder ? String(folder.name) : "" });
  };
  const selectedDraft = selected ? drafts.find(draft => draft.note.id === selected.id) : undefined;
  const startListResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = listWidth;
    let nextWidth = startWidth;
    const move = (pointer: PointerEvent) => {
      nextWidth = Math.min(560, Math.max(260, startWidth + pointer.clientX - startX));
      gridRef.current?.style.setProperty("--notes-list-width", `${nextWidth}px`);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setListWidth(nextWidth);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
    window.addEventListener("pointercancel", end, { once: true });
  };

  return <section className={`notes-center ${editorLayout === "immersive" && selected ? "is-immersive" : ""}`} aria-label="笔记中心">
    <div className="notes-center-header">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><FilePlus2 size={17}/></span>
        <div className="min-w-0"><h1 className="text-lg font-semibold tracking-tight">我的笔记</h1><p className="text-[10px] text-muted-foreground">{notes.loading ? "正在同步" : mode === "cloud" ? (notes.error ? "云端暂不可用 · 本地草稿已保留" : "云端同步") : "保存在此设备"}</p></div>
        <span className={`ml-1 size-2 rounded-full ${mode === "cloud" && !notes.error ? "bg-[var(--mc-color-success)]" : notes.error ? "bg-[var(--mc-color-warning)]" : "bg-muted-foreground/50"}`} title={notes.error || (mode === "cloud" ? "云端同步" : "本地保存")}/>
      </div>
      <div className="relative flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" aria-label="更多笔记操作" title="更多操作" onClick={() => setMenuOpen(open => !open)}><MoreHorizontal size={18}/></Button>
        {menuOpen && <><button aria-label="关闭更多操作" className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)}/><div className="notes-list-menu absolute right-0 top-10 z-30 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl"><button className="notes-menu-item" onClick={() => { setView(view === "list" ? "cards" : "list"); setMenuOpen(false); }}>{view === "list" ? <LayoutGrid size={14}/> : <List size={14}/>}切换{view === "list" ? "卡片" : "列表"}视图</button><button className="notes-menu-item" onClick={() => { setFilter("favorites"); setMenuOpen(false); }}><Star size={14}/>我的收藏</button><button className="notes-menu-item" onClick={() => { setFilter("archive"); setMenuOpen(false); }}><Archive size={14}/>归档笔记</button><button className="notes-menu-item" onClick={() => { setFilter("trash"); setMenuOpen(false); }}><Trash2 size={14}/>回收站</button><button className="notes-menu-item" onClick={() => { void createFolder(); setMenuOpen(false); }} disabled={!canEdit}><FolderPlus size={14}/>新建文件夹</button></div></>}
      </div>
    </div>

    <div className="notes-search-wrap"><Search size={16} className="text-muted-foreground"/><Input aria-label="搜索笔记" placeholder="搜索标题、正文或标签" value={search} onChange={event => { setSearch(event.target.value); setPageSize(50); }} className="h-10 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"/>{search && <button aria-label="清除搜索" onClick={() => setSearch("")} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X size={14}/></button>}<span className="hidden text-[10px] text-muted-foreground sm:block">⌘ K</span></div>
    <div className="notes-filter-row" role="tablist" aria-label="笔记筛选">
      {([["all", "全部"], ["pinned", "置顶"], ["recent", "最近编辑"]] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className={`notes-filter-chip ${filter === key ? "is-active" : ""}`}>{key === "pinned" ? <Pin size={12}/> : key === "recent" ? <Clock3 size={12}/> : null}{label}</button>)}
      <span className="mx-1 h-4 w-px shrink-0 bg-border"/>
      {activeFolders.map(folder => <button key={folder.id} role="tab" aria-selected={filter === `folder:${folder.id}`} onClick={() => setFilter(`folder:${folder.id}`)} className={`notes-filter-chip ${filter === `folder:${folder.id}` ? "is-active" : ""}`}><Folder size={12}/>{String(folder.name)}</button>)}
      <button aria-label="新建文件夹" title="新建文件夹" className="notes-filter-chip notes-folder-add" onClick={() => void createFolder()} disabled={!canEdit}><Plus size={13}/></button>
    </div>

    <div ref={gridRef} style={{ "--notes-list-width": `${listWidth}px` } as React.CSSProperties} className={`notes-workspace-grid layout-${gridLayout} ${selected ? "has-selection" : ""}`}>
      <nav className="notes-sidebar-pane" aria-label="笔记导航">
        <p className="notes-sidebar-label">工作空间</p>
        <button className={`notes-sidebar-link ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")}><List size={14}/>全部笔记<span>{allNotes.filter(row => !row.deleted_at && !row.archived_at).length}</span></button>
        <button className={`notes-sidebar-link ${filter === "pinned" ? "is-active" : ""}`} onClick={() => setFilter("pinned")}><Pin size={14}/>置顶笔记</button>
        <button className={`notes-sidebar-link ${filter === "favorites" ? "is-active" : ""}`} onClick={() => setFilter("favorites")}><Star size={14}/>我的收藏</button>
        <button className={`notes-sidebar-link ${filter === "recent" ? "is-active" : ""}`} onClick={() => setFilter("recent")}><Clock3 size={14}/>最近编辑</button>
        <div className="notes-sidebar-divider"/>
        <div className="flex items-center justify-between px-2"><p className="notes-sidebar-label !px-0">文件夹</p><button aria-label="新建文件夹" title="新建文件夹" className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary" onClick={() => void createFolder()} disabled={!canEdit}><Plus size={13}/></button></div>
        {activeFolders.map(folder => <div className="group flex items-center" key={folder.id}><button className={`notes-sidebar-link flex-1 ${filter === `folder:${folder.id}` ? "is-active" : ""}`} onClick={() => setFilter(`folder:${folder.id}`)}><Folder size={14}/><span className="truncate">{String(folder.name)}</span></button><div className="hidden gap-0.5 pr-1 group-hover:flex"><button aria-label={`重命名 ${String(folder.name)}`} title="重命名" className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted" onClick={() => void renameFolder(folder)}><Settings2 size={12}/></button><button aria-label={`删除 ${String(folder.name)}`} title="删除" className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-[var(--mc-tint-red)] hover:text-[var(--mc-color-danger)]" onClick={() => setFolderToDelete(folder)}><X size={12}/></button></div></div>)}
        <div className="notes-sidebar-divider"/>
        <button className={`notes-sidebar-link ${filter === "archive" ? "is-active" : ""}`} onClick={() => setFilter("archive")}><Archive size={14}/>归档笔记</button>
        <button className={`notes-sidebar-link ${filter === "trash" ? "is-active" : ""}`} onClick={() => setFilter("trash")}><Trash2 size={14}/>回收站</button>
      </nav>
      <aside className={`notes-list-pane ${selected ? "mobile-hidden" : ""}`}>
        <div className="notes-list-heading"><span>{filter === "trash" ? "回收站" : filter === "archive" ? "已归档" : filter === "pinned" ? "置顶笔记" : filter === "recent" ? "最近编辑" : filter.startsWith("folder:") ? folderById.get(filter.slice(7)) || "文件夹" : "全部笔记"}</span><span>{visible.length}</span></div>
        {notes.error && <div className="mx-3 my-2 rounded-lg bg-[var(--mc-tint-yellow)] px-3 py-2 text-[10px] leading-4 text-muted-foreground">云端暂时不可达。未同步输入保存在本机，联网后自动重试。<button className="ml-2 font-semibold text-primary" onClick={() => void notes.refresh(true)}>重试</button></div>}
        {notes.loading && visible.length === 0 ? <div className="space-y-2 p-3"><div className="h-16 animate-pulse rounded-lg bg-muted/70"/><div className="h-16 animate-pulse rounded-lg bg-muted/70"/><div className="h-16 animate-pulse rounded-lg bg-muted/70"/></div>
        : visible.length === 0 ? <div className="notes-empty"><span className="grid size-11 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary"><FilePlus2 size={18}/></span><p className="mt-3 text-sm font-medium">{search ? "没有找到匹配笔记" : filter === "trash" ? "回收站为空" : "从一句话开始记录"}</p><p className="mt-1 max-w-[220px] text-center text-[11px] leading-5 text-muted-foreground">{search ? "试试标题、正文关键词或标签。" : "无需先选类型或填写资料，点击新建后直接开始输入。"}</p></div>
        : <div className={`notes-list ${view === "cards" ? "notes-list-cards" : ""}`}>
          {visible.slice(0, pageSize).map(row => <NoteListItem key={row.id} row={row} selected={selectedId === row.id} folderName={folderById.get(String(row.folder_id)) || String(row.folder || "收件箱")} filter={filter} folders={activeFolders} canEdit={canEdit} onOpen={() => openNote(String(row.id))} onPin={() => void updateNote(String(row.id), { is_pinned: !row.is_pinned })} onFavorite={() => void updateNote(String(row.id), { is_favorite: !row.is_favorite })} onDuplicate={() => void duplicateNote(row)} onDelete={() => setNoteToDelete(row)} onArchive={() => void archiveNote(row)} onRestore={() => void restoreNote(row)} onMove={folderId => void moveNote(row, folderId)}/>)}
          {visible.length > pageSize && <button className="mx-3 my-2 w-[calc(100%-1.5rem)] rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted" onClick={() => setPageSize(size => size + 50)}>继续加载 {Math.min(50, visible.length - pageSize)} 条</button>}
        </div>}
      </aside>
      <div className="notes-resize-handle" role="separator" aria-label="调整笔记列表宽度" aria-orientation="vertical" tabIndex={0} onPointerDown={startListResize} onKeyDown={event => { if (event.key === "ArrowLeft") setListWidth(width => Math.max(260, width - 20)); if (event.key === "ArrowRight") setListWidth(width => Math.min(560, width + 20)); }}/>
      <main className={`notes-reader-pane ${selected ? "has-note" : ""}`}>
        {selected ? <NoteEditor key={selected.id} note={selected} draft={selectedDraft} availableNotes={allNotes.filter(row => !row.deleted_at && !row.archived_at)} folders={activeFolders} onClose={closeEditor} onDelete={async () => { await deleteNote(selected); }} onArchive={async () => { await archiveNote(selected); closeEditor(); }} canEdit={canEdit} editorLayout={editorLayout} onEditorLayoutChange={chooseEditorLayout} onExitImmersive={exitImmersive} createNote={notes.create} updateNote={notes.update} refreshNotes={notes.refresh}/>
        : <div className="notes-reader-empty"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary"><FilePlus2 size={21}/></span><p className="mt-3 text-sm font-medium">选择一条笔记</p><p className="mt-1 text-xs text-muted-foreground">内容会在输入后自动保存</p></div>}
      </main>
    </div>
    {canEdit && <button type="button" aria-label="新建笔记" title="新建笔记" className="notes-fab" onClick={createNote}><Plus size={21}/><span>新建</span></button>}
    {folderDialog && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/25 p-4" role="presentation" onClick={() => { if (!folderSaving) setFolderDialog(null); }}><section role="dialog" aria-modal="true" aria-label={folderDialog.mode === "create" ? "新建文件夹" : "重命名文件夹"} className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl" onClick={event => event.stopPropagation()}><h2 className="text-sm font-semibold">{folderDialog.mode === "create" ? "新建文件夹" : "重命名文件夹"}</h2><p className="mt-1 text-[10px] leading-4 text-muted-foreground">笔记保存在原有店铺数据中，文件夹仅用于整理。</p><form className="mt-4" onSubmit={saveFolder}><Input autoFocus aria-label="文件夹名称" value={folderName} onChange={event => setFolderName(event.target.value)} maxLength={80} required placeholder="例如：活动复盘"/><div className="mt-4 flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" disabled={folderSaving} onClick={() => setFolderDialog(null)}>取消</Button><Button type="submit" size="sm" disabled={folderSaving || !folderName.trim()}>{folderSaving ? "保存中…" : folderDialog.mode === "create" ? "创建文件夹" : "保存名称"}</Button></div></form></section></div>}
    <AlertDialog open={Boolean(folderToDelete)} onOpenChange={open => { if (!open && !deleteBusy) setFolderToDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除文件夹“{String(folderToDelete?.name || "")}”？</AlertDialogTitle><AlertDialogDescription>文件夹中的笔记会移到收件箱，正文和历史版本都会保留。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteBusy}>取消</AlertDialogCancel><AlertDialogAction disabled={deleteBusy} onClick={event => { event.preventDefault(); void confirmFolderDelete(); }}>{deleteBusy ? "处理中…" : "删除文件夹"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(noteToDelete)} onOpenChange={open => { if (!open && !deleteBusy) setNoteToDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>将笔记移入回收站？</AlertDialogTitle><AlertDialogDescription>“{noteToDelete ? displayTitle(noteToDelete) : "此笔记"}”可以之后从回收站恢复。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteBusy}>取消</AlertDialogCancel><AlertDialogAction disabled={deleteBusy} onClick={event => { event.preventDefault(); void confirmNoteDelete(); }}>{deleteBusy ? "处理中…" : "移入回收站"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}

function NoteListItem({ row, selected, folderName, filter, folders, canEdit, onOpen, onPin, onFavorite, onDuplicate, onDelete, onArchive, onRestore, onMove }: {
  row: WorkspaceRow; selected: boolean; folderName: string; filter: Filter; folders: WorkspaceRow[]; canEdit: boolean;
  onOpen: () => void; onPin: () => void; onFavorite: () => void; onDuplicate: () => void; onDelete: () => void; onArchive: () => void; onRestore: () => void; onMove: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const summary = plainMarkdown(String(row.body_markdown || ""));
  const [longPressed, setLongPressed] = useState(false);
  const pressTimer = useRef<number | undefined>(undefined);
  return <article className={`notes-list-item ${selected ? "is-selected" : ""} ${row.is_pinned ? "is-pinned" : ""}`} onContextMenu={event => { event.preventDefault(); setMenuOpen(true); }} onTouchStart={() => { pressTimer.current = window.setTimeout(() => { setLongPressed(true); setMenuOpen(true); }, 560); }} onTouchEnd={() => { if (pressTimer.current) window.clearTimeout(pressTimer.current); }} onTouchMove={() => { if (pressTimer.current) window.clearTimeout(pressTimer.current); }}>
    <button type="button" className="notes-list-open" onClick={onOpen} aria-current={selected ? "true" : undefined}>
      <span className="flex min-w-0 items-center gap-1.5"><span className="truncate text-[13px] font-semibold">{displayTitle(row)}</span>{Boolean(row.is_pinned) && <Pin size={11} className="shrink-0 fill-current text-primary"/>}{Boolean(row.is_favorite) && <Star size={11} className="shrink-0 fill-current text-[var(--mc-color-warning)]"/>}{Boolean(row.__note_draft) && <span className="notes-unsynced-dot" title="有本机待同步改动"/>}</span>
      <span className="notes-list-summary">{summary || "还没有正文"}</span>
      <span className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="truncate">{folderName}</span><span>·</span><span>{relativeDate(row.updated_at || row.created_at)}</span>{Array.isArray(row.tags) && row.tags.length > 0 && <><span>·</span><span className="truncate">{(row.tags as string[]).slice(0, 2).map(tag => `#${tag}`).join(" ")}</span></>}</span>
    </button>
    {filter === "trash" ? <button aria-label="恢复笔记" title="恢复" className="notes-list-more" onClick={onRestore}><Undo2 size={15}/></button> : filter === "archive" ? <button aria-label="取消归档" title="取消归档" className="notes-list-more" onClick={onRestore}><Undo2 size={15}/></button> : <div className="relative"><button aria-label="笔记操作" title="操作" className="notes-list-more" onClick={() => setMenuOpen(value => !value)}><MoreHorizontal size={16}/></button>{menuOpen && <><button className="fixed inset-0 z-20" aria-label="关闭菜单" onClick={() => setMenuOpen(false)}/><div className="notes-row-menu absolute right-0 top-9 z-30 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl"><button className="notes-menu-item" disabled={!canEdit} onClick={() => { onPin(); setMenuOpen(false); }}><Pin size={14}/>{row.is_pinned ? "取消置顶" : "置顶"}</button><button className="notes-menu-item" disabled={!canEdit} onClick={() => { onFavorite(); setMenuOpen(false); }}><Star size={14}/>{row.is_favorite ? "取消收藏" : "收藏笔记"}</button><label className="notes-menu-item cursor-pointer"> <Folder size={14}/>移动到<select className="ml-auto max-w-24 bg-transparent text-[10px]" value={String(row.folder_id || "")} disabled={!canEdit} onChange={event => { onMove(event.target.value); setMenuOpen(false); }}><option value="">收件箱</option>{folders.map(folder => <option key={folder.id} value={String(folder.id)}>{String(folder.name)}</option>)}</select></label><button className="notes-menu-item" disabled={!canEdit} onClick={() => { onDuplicate(); setMenuOpen(false); }}><Copy size={14}/>复制笔记</button><button className="notes-menu-item" disabled={!canEdit} onClick={() => { onArchive(); setMenuOpen(false); }}><Archive size={14}/>归档</button><button className="notes-menu-item text-[var(--mc-color-danger)]" disabled={!canEdit} onClick={() => { onDelete(); setMenuOpen(false); }}><Trash2 size={14}/>删除</button></div></>}</div>}
    {longPressed && <span className="sr-only">操作菜单已打开</span>}
  </article>;
}
