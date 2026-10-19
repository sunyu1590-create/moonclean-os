import type { WorkspaceResource, WorkspaceRow } from "@/lib/workspace";
import { getWorkspaceHotFeature, type WorkspaceFeature } from "@/lib/workspace-usage";

export const WORKSPACE_CACHE_TTL = 30_000;
export const WORKSPACE_REFRESH_EVENT = "moonclean:workspace-refresh";
export const WORKSPACE_CACHE_UPDATED_EVENT = "moonclean:workspace-cache-updated";

type CacheEntry = { rows: WorkspaceRow[]; updatedAt: number; bytes: number; feature: WorkspaceFeature };
type RefreshEventDetail = { refreshers: Array<() => Promise<void>> };
type UpdatedEventDetail = { storeId: string; userId: string; updatedAt: number };

const BASE_CACHE_BYTES = 3 * 1024 * 1024;
const MAX_CACHE_BYTES = 4 * 1024 * 1024;
const MAX_HOT_FEATURE_BYTES = 3 * 1024 * 1024;
const MAX_COLD_FEATURE_BYTES = 1 * 1024 * 1024;
const MAX_CACHE_ENTRY_BYTES = 3 * 1024 * 1024;
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

export function getWorkspaceCache(userId: string, storeId: string, resource: WorkspaceResource, feature?: WorkspaceFeature) {
  const key = cacheKey(userId, storeId, resource);
  const entry = cache.get(key);
  if (!entry) return null;
  cache.delete(key);
  if (feature) entry.feature = feature;
  cache.set(key, entry);
  pruneWorkspaceCache();
  return entry;
}

export function setWorkspaceCache(userId: string, storeId: string, resource: WorkspaceResource, rows: WorkspaceRow[], updatedAt = Date.now(), feature: WorkspaceFeature = "notes") {
  const key = cacheKey(userId, storeId, resource);
  const old = cache.get(key);
  if (old) cacheBytes -= old.bytes;
  cache.delete(key);

  const bytes = estimateBytes(rows);
  if (bytes > MAX_CACHE_ENTRY_BYTES) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<UpdatedEventDetail>(WORKSPACE_CACHE_UPDATED_EVENT, { detail: { storeId, userId, updatedAt } }));
    }
    return;
  }

  cache.set(key, { rows, updatedAt, bytes, feature });
  cacheBytes += bytes;
  pruneWorkspaceCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<UpdatedEventDetail>(WORKSPACE_CACHE_UPDATED_EVENT, { detail: { storeId, userId, updatedAt } }));
  }
}

export function pruneWorkspaceCache() {
  const hotFeature = getWorkspaceHotFeature()?.feature ?? null;
  const measure = () => {
    let hotBytes = 0;
    let coldBytes = 0;
    for (const entry of cache.values()) {
      if (hotFeature && entry.feature === hotFeature) hotBytes += entry.bytes;
      else coldBytes += entry.bytes;
    }
    return { hotBytes, coldBytes };
  };
  while (cache.size > 0) {
    const { hotBytes, coldBytes } = measure();
    const tooMany = cache.size > MAX_CACHE_ENTRIES;
    const tooLarge = hotFeature
      ? cacheBytes > MAX_CACHE_BYTES || hotBytes > MAX_HOT_FEATURE_BYTES || coldBytes > MAX_COLD_FEATURE_BYTES
      : cacheBytes > BASE_CACHE_BYTES;
    if (!tooMany && !tooLarge) break;
    const oldestCold = hotFeature
      ? [...cache.entries()].find(([, entry]) => entry.feature !== hotFeature)
      : undefined;
    const [oldestKey, oldest] = oldestCold || cache.entries().next().value || [];
    if (!oldestKey || !oldest) break;
    cache.delete(oldestKey);
    cacheBytes -= oldest.bytes;
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
