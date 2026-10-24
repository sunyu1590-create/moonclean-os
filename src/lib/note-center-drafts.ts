export type NoteSnapshot = {
  id: string;
  title: string;
  title_is_auto: boolean;
  body_markdown: string;
  category: string;
  folder: string;
  folder_id: string | null;
  tags: string[];
  is_pinned: boolean;
  is_favorite: boolean;
  related_type: "product" | "sku" | "experiment" | "competitor" | "service_case" | "copilot_conversation" | null;
  related_id: string | null;
};

export type NoteDraft = {
  note: NoteSnapshot;
  baseUpdatedAt: string | null;
  savedAt: string;
  isNew: boolean;
};

const prefix = "moonclean-note-center-v1";
export function noteDraftKey(userId: string, storeId: string, noteId: string) {
  return `${prefix}:${userId || "local"}:${storeId}:${noteId}`;
}

export function saveNoteDraft(userId: string, storeId: string, draft: NoteDraft): boolean {
  try {
    localStorage.setItem(noteDraftKey(userId, storeId, draft.note.id), JSON.stringify(draft));
    return true;
  }
  catch { return false; /* Browser storage can be disabled or full; the editor still keeps its in-memory state. */ }
}

export function readNoteDraft(userId: string, storeId: string, noteId: string): NoteDraft | null {
  try {
    const value = localStorage.getItem(noteDraftKey(userId, storeId, noteId));
    if (!value) return null;
    const draft = JSON.parse(value) as NoteDraft;
    return draft?.note?.id === noteId ? draft : null;
  } catch { return null; }
}

export function listNoteDrafts(userId: string, storeId: string): NoteDraft[] {
  const drafts: NoteDraft[] = [];
  try {
    const start = `${prefix}:${userId || "local"}:${storeId}:`;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(start)) continue;
      const parsed = JSON.parse(localStorage.getItem(key) || "null") as NoteDraft | null;
      if (parsed?.note?.id) drafts.push(parsed);
    }
  } catch { /* Ignore malformed browser-local drafts and keep usable drafts. */ }
  return drafts.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function removeNoteDraft(userId: string, storeId: string, noteId: string) {
  try {
    localStorage.removeItem(noteDraftKey(userId, storeId, noteId));
    window.dispatchEvent(new Event("moonclean-note-draft-changed"));
  } catch { /* Safe to retry at next edit. */ }
}
