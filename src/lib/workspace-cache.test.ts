import { describe, expect, it } from "vitest";
import { getLatestWorkspaceCacheTime, getWorkspaceCache, setWorkspaceCache } from "./workspace-cache";
import type { WorkspaceRow } from "./workspace";

describe("workspace memory cache", () => {
  it("isolates cached rows by user and store", () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const row = { id: "note-1", title: "缓存笔记" } as WorkspaceRow;
    setWorkspaceCache(`user-${suffix}`, `store-${suffix}`, "notes", [row], 1234);

    expect(getWorkspaceCache(`user-${suffix}`, `store-${suffix}`, "notes")?.rows).toEqual([row]);
    expect(getWorkspaceCache(`another-user-${suffix}`, `store-${suffix}`, "notes")).toBeNull();
    expect(getLatestWorkspaceCacheTime(`user-${suffix}`, `store-${suffix}`)).toBe(1234);
  });

  it("does not retain an oversized dataset", () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const userId = `user-${suffix}`;
    const storeId = `store-${suffix}`;
    setWorkspaceCache(userId, storeId, "notes", [{ id: "previous" } as WorkspaceRow]);
    const largeRows = Array.from({ length: 40 }, (_, index) => ({ id: `large-${index}`, body_markdown: "x".repeat(100_000) } as WorkspaceRow));

    setWorkspaceCache(userId, storeId, "notes", largeRows);
    expect(getWorkspaceCache(userId, storeId, "notes")).toBeNull();
  });
});
