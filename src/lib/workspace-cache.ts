import type { WorkspaceResource, WorkspaceRow } from "@/lib/workspace";

export const WORKSPACE_CACHE_TTL = 30_000;
export const WORKSPACE_REFRESH_EVENT = "moonclean:workspace-refresh";
export const WORKSPACE_CACHE_UPDATED_EVENT = "moonclean:workspace-cache-updated";

type CacheEntry = { rows: WorkspaceRow[]; updatedAt: number; bytes: number };
type RefreshEventDetail = { refreshers: Array<() => Promise<void>> };
type UpdatedEventDetail = { storeId: string; userId: string; updatedAt: number };

const MAX_CACHE_BYTES = 3 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 12;
const cache = new Map<string, CacheEntry>();
let cacheBytes = 0;

function cacheKey(userId: string, storeId: string, resource: WorkspaceResource) {
  return `${userId}:${storeId}:${resource}`;
}

function estimateBytes(value: unknown, limit = MAX_CACHE_BYTES): number {
  const pending: unknown[] = [value];
  const seen = new Set<object>();
  let bytes = 0;
  while (pending.length && bytes <= limit) {
    const item = pending.pop();
    if (typeof item === "string") bytes += item.length * 2;
    else if (typeof item === "number" || typeof item === "boolean") bytes += 8;
    else if (item && typeof item === "object") {
      if (seen.has(item)) continue;
      seen.add(item);
      bytes += 32;
      if (Array.isArray(item)) pending.push(...item);
      else pending.push(...Object.values(item));
    }
  }
  return bytes;
}

export function getWorkspaceCache(userId: string, storeId: string, resource: WorkspaceResource) {
  const key = cacheKey(userId, storeId, resource);
  const entry = cache.get(key);
  if (!entry) return null;
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

export function setWorkspaceCache(userId: string, storeId: string, resource: WorkspaceResource, rows: WorkspaceRow[], updatedAt = Date.now()) {
  const key = cacheKey(userId, storeId, resource);
  const old = cache.get(key);
  if (old) cacheBytes -= old.bytes;
  cache.delete(key);

  const bytes = estimateBytes(rows);
  if (bytes > MAX_CACHE_BYTES) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<UpdatedEventDetail>(WORKSPACE_CACHE_UPDATED_EVENT, { detail: { storeId, userId, updatedAt } }));
    }
    return;
  }

  cache.set(key, { rows, updatedAt, bytes });
  cacheBytes += bytes;
  while (cache.size > MAX_CACHE_ENTRIES || cacheBytes > MAX_CACHE_BYTES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const oldest = cache.get(oldestKey);
    cache.delete(oldestKey);
    if (oldest) cacheBytes -= oldest.bytes;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<UpdatedEventDetail>(WORKSPACE_CACHE_UPDATED_EVENT, { detail: { storeId, userId, updatedAt } }));
  }
}

export function getLatestWorkspaceCacheTime(userId: string, storeId: string) {
  let latest = 0;
  for (const [key, entry] of cache) {
    if (key.startsWith(`${userId}:${storeId}:`)) latest = Math.max(latest, entry.updatedAt);
  }
  return latest || null;
}

export async function refreshWorkspacePage() {
  if (typeof window === "undefined") return;
  const detail: RefreshEventDetail = { refreshers: [] };
  window.dispatchEvent(new CustomEvent<RefreshEventDetail>(WORKSPACE_REFRESH_EVENT, { detail }));
  const results = await Promise.allSettled(detail.refreshers.map(refresh => refresh()));
  if (results.some(result => result.status === "rejected")) throw new Error("部分模块数据刷新失败，请检查各模块提示后重试。");
}
