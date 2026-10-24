import { beforeEach, describe, expect, it, vi } from "vitest";
import { listNoteDrafts, noteDraftKey, readNoteDraft, removeNoteDraft, saveNoteDraft, type NoteDraft } from "@/lib/note-center-drafts";

class MemoryStorage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
  removeItem(key: string) { this.data.delete(key); }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  clear() { this.data.clear(); }
}

const draft: NoteDraft = {
  note: { id: "note-a", title: "", title_is_auto: true, body_markdown: "一条离线草稿", category: "未分类", folder: "", folder_id: null, tags: [], is_pinned: false, is_favorite: false, related_type: null, related_id: null },
  baseUpdatedAt: "2026-10-24T10:00:00.000Z",
  savedAt: "2026-10-24T10:01:00.000Z",
  isNew: false,
};

describe("笔记中心本地待同步草稿", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new MemoryStorage() });
    Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent: vi.fn() } });
  });

  it("按用户、店铺和笔记隔离保存，可恢复后再删除", () => {
    saveNoteDraft("user-a", "store-a", draft);
    expect(noteDraftKey("user-a", "store-a", "note-a")).not.toBe(noteDraftKey("user-b", "store-a", "note-a"));
    expect(readNoteDraft("user-a", "store-a", "note-a")?.note.body_markdown).toBe("一条离线草稿");
    expect(readNoteDraft("user-b", "store-a", "note-a")).toBeNull();
    expect(listNoteDrafts("user-a", "store-a")).toHaveLength(1);
    removeNoteDraft("user-a", "store-a", "note-a");
    expect(readNoteDraft("user-a", "store-a", "note-a")).toBeNull();
  });
});
