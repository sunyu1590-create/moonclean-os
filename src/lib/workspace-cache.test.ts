import { describe, expect, it } from "vitest";
import { clearWorkspaceCacheForUser, dedupeWorkspaceRequest, getLatestWorkspaceCacheTime, getWorkspaceCache, setWorkspaceCache } from "./workspace-cache";
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
    const largeRows = Array.from({ length: 40 }, (_, index) => ({ id: `large-${index}`, body_markdown: "x".repeat(800_000) } as WorkspaceRow));

    setWorkspaceCache(userId, storeId, "notes", largeRows);
    expect(getWorkspaceCache(userId, storeId, "notes")).toBeNull();
  });

  it("deduplicates concurrent reads for the same user scope", async () => {
    const calls: string[] = [];
    let resolveRequest!: (rows: WorkspaceRow[]) => void;
    const request = () => {
      calls.push("request");
      return new Promise<WorkspaceRow[]>((resolve) => { resolveRequest = resolve; });
    };
    const first = dedupeWorkspaceRequest("user:store:notes", request);
    const second = dedupeWorkspaceRequest("user:store:notes", request);

    expect(calls).toHaveLength(1);
    resolveRequest([{ id: "note-1" } as WorkspaceRow]);
    await expect(Promise.all([first, second])).resolves.toEqual([
      [{ id: "note-1" }],
      [{ id: "note-1" }],
    ]);
  });

  it("clears one user's memory cache without affecting another", () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const userId = `user-${suffix}`;
    const otherUserId = `other-${suffix}`;
    const storeId = `store-${suffix}`;
    setWorkspaceCache(userId, storeId, "notes", [{ id: "private" } as WorkspaceRow]);
    setWorkspaceCache(otherUserId, storeId, "notes", [{ id: "other" } as WorkspaceRow]);

    clearWorkspaceCacheForUser(userId);

    expect(getWorkspaceCache(userId, storeId, "notes")).toBeNull();
    expect(getWorkspaceCache(otherUserId, storeId, "notes")?.rows[0]?.id).toBe("other");
  });
});
