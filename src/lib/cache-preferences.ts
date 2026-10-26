export type CacheIntensity = "auto" | "low" | "standard" | "high" | "ultra" | "custom";
export type CachePreferences = {
  enabled: boolean;
  startup: boolean;
  modules: boolean;
  data: boolean;
  intensity: CacheIntensity;
  customMegabytes: number;
};

export const CACHE_PREFERENCES_KEY = "moonclean-cache-preferences-v1";
export const CACHE_PREFERENCES_EVENT = "moonclean:cache-preferences-updated";
export const DEFAULT_CACHE_PREFERENCES: CachePreferences = {
  enabled: true,
  startup: true,
  modules: true,
  data: true,
  intensity: "auto",
  customMegabytes: 24,
};

const MB = 1024 * 1024;
const MAX_CUSTOM_MB = 6 * 1024;
const INTENSITY_MEGABYTES = { low: 8, standard: 24, high: 48, ultra: 1024 } as const;

function profileForMegabytes(megabytes: number) {
  const maxBytes = Math.round(megabytes * MB);
  return {
    maxBytes,
    hotBytes: Math.floor(maxBytes * 0.75),
    coldBytes: Math.ceil(maxBytes * 0.25),
    maxEntries: Math.max(1, Math.min(256, Math.ceil(megabytes / 2))),
    maxEntryBytes: Math.floor(maxBytes * 0.75),
    dataBytes: Math.floor(maxBytes * 0.25),
    ttlMs: megabytes >= 1024 ? 5 * 60_000 : megabytes >= 48 ? 2 * 60_000 : megabytes >= 24 ? 60_000 : 30_000,
    aiResultTtlMs: megabytes >= 1024 ? 24 * 60 * 60_000 : megabytes >= 48 ? 4 * 60 * 60_000 : megabytes >= 24 ? 2 * 60 * 60_000 : 60 * 60_000,
  };
}

export const CACHE_PROFILES = {
  low: profileForMegabytes(INTENSITY_MEGABYTES.low),
  standard: profileForMegabytes(INTENSITY_MEGABYTES.standard),
  high: profileForMegabytes(INTENSITY_MEGABYTES.high),
  ultra: profileForMegabytes(INTENSITY_MEGABYTES.ultra),
} as const;

export type PresetCacheIntensity = "low" | "standard" | "high" | "ultra";

export function suggestedCacheIntensity(memoryGiB: number | null | undefined): PresetCacheIntensity {
  if (typeof memoryGiB === "number" && memoryGiB <= 1) return "low";
  if (typeof memoryGiB === "number" && memoryGiB >= 6) return "high";
  return "standard";
}

export function resolveCacheIntensity(intensity: CacheIntensity, memoryGiB?: number | null): PresetCacheIntensity {
  if (intensity === "auto") return suggestedCacheIntensity(memoryGiB);
  return intensity === "custom" ? "standard" : intensity;
}

export function parseCachePreferences(value: unknown): CachePreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_CACHE_PREFERENCES };
  const saved = value as Partial<CachePreferences>;
  return {
    enabled: typeof saved.enabled === "boolean" ? saved.enabled : DEFAULT_CACHE_PREFERENCES.enabled,
    startup: typeof saved.startup === "boolean" ? saved.startup : DEFAULT_CACHE_PREFERENCES.startup,
    modules: typeof saved.modules === "boolean" ? saved.modules : DEFAULT_CACHE_PREFERENCES.modules,
    data: typeof saved.data === "boolean" ? saved.data : DEFAULT_CACHE_PREFERENCES.data,
    intensity: ["auto", "low", "standard", "high", "ultra", "custom"].includes(saved.intensity || "") ? saved.intensity as CacheIntensity : DEFAULT_CACHE_PREFERENCES.intensity,
    customMegabytes: typeof saved.customMegabytes === "number" && Number.isFinite(saved.customMegabytes) ? Math.max(0, Math.min(MAX_CUSTOM_MB, Math.round(saved.customMegabytes))) : DEFAULT_CACHE_PREFERENCES.customMegabytes,
  };
}

export function readCachePreferences(): CachePreferences {
  if (typeof window === "undefined") return { ...DEFAULT_CACHE_PREFERENCES };
  try { return parseCachePreferences(JSON.parse(window.localStorage.getItem(CACHE_PREFERENCES_KEY) || "null")); }
  catch { return { ...DEFAULT_CACHE_PREFERENCES }; }
}

export function writeCachePreferences(value: CachePreferences): void {
  const next = parseCachePreferences(value);
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CACHE_PREFERENCES_KEY, JSON.stringify(next)); }
  catch { /* Apply the policy for this page even if browser storage is unavailable. */ }
  if (!isCacheEnabled("startup", next)) clearPersistentCache("startup");
  if (!isCacheEnabled("data", next)) clearPersistentCache("data");
  else pruneAiInsightCache();
  window.dispatchEvent(new CustomEvent(CACHE_PREFERENCES_EVENT, { detail: next }));
}

export function clearPersistentCache(kind: "startup" | "data" | "all" = "all") {
  if (typeof window === "undefined") return;
  const prefixes = kind === "startup" ? ["moonclean-core-snapshot-v1:"] : kind === "data" ? ["moonclean-ai-insight-v2:"] : ["moonclean-core-snapshot-v1:", "moonclean-ai-insight-v2:"];
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && prefixes.some(prefix => key.startsWith(prefix))) window.localStorage.removeItem(key);
    }
  } catch { /* Browser storage may be disabled; memory caches still follow the policy. */ }
}

export function pruneAiInsightCache() {
  if (typeof window === "undefined") return;
  if (!isCacheEnabled("data")) { clearPersistentCache("data"); return; }
  const profile = getCacheProfile();
  try {
    const entries: Array<{ key: string; bytes: number; generatedAt: number }> = [];
    let totalBytes = 0;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith("moonclean-ai-insight-v2:")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      let generatedAt = 0;
      try { generatedAt = Date.parse((JSON.parse(raw) as { generatedAt?: string }).generatedAt || ""); } catch { /* Treat malformed cache entries as expired. */ }
      if (!generatedAt || Date.now() - generatedAt >= profile.aiResultTtlMs) { window.localStorage.removeItem(key); index -= 1; continue; }
      const bytes = raw.length * 2;
      totalBytes += bytes;
      entries.push({ key, bytes, generatedAt });
    }
    entries.sort((a, b) => a.generatedAt - b.generatedAt);
    while (totalBytes > profile.dataBytes && entries.length) {
      const oldest = entries.shift()!;
      window.localStorage.removeItem(oldest.key);
      totalBytes -= oldest.bytes;
    }
  } catch { /* Browser storage can be unavailable; uncached generation still works. */ }
}

export function writeBoundedAiCache(key: string, value: unknown): boolean {
  if (typeof window === "undefined" || !isCacheEnabled("data")) return false;
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") return false;
  const nextBytes = serialized.length * 2;
  const profile = getCacheProfile();
  if (nextBytes > profile.dataBytes) return false;
  try {
    const entries: Array<{ key: string; bytes: number; generatedAt: number }> = [];
    let totalBytes = nextBytes;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const storedKey = window.localStorage.key(index);
      if (!storedKey?.startsWith("moonclean-ai-insight-v2:") || storedKey === key) continue;
      const raw = window.localStorage.getItem(storedKey);
      if (!raw) continue;
      let generatedAt = 0;
      try { generatedAt = Date.parse((JSON.parse(raw) as { generatedAt?: string }).generatedAt || ""); } catch { /* Remove invalid cached data below. */ }
      if (!generatedAt || Date.now() - generatedAt >= profile.aiResultTtlMs) { window.localStorage.removeItem(storedKey); index -= 1; continue; }
      const bytes = raw.length * 2;
      totalBytes += bytes;
      entries.push({ key: storedKey, bytes, generatedAt });
    }
    entries.sort((a, b) => a.generatedAt - b.generatedAt);
    while (totalBytes > profile.dataBytes && entries.length) {
      const oldest = entries.shift()!;
      window.localStorage.removeItem(oldest.key);
      totalBytes -= oldest.bytes;
    }
    window.localStorage.setItem(key, serialized);
    return true;
  } catch { return false; }
}

export function getCacheProfile(preferences = readCachePreferences(), memoryGiB?: number | null) {
  if (preferences.intensity === "custom") return profileForMegabytes(preferences.customMegabytes);
  const resolvedMemory = memoryGiB === undefined ? detectDeviceMemory() : memoryGiB;
  const resolved = resolveCacheIntensity(preferences.intensity, resolvedMemory);
  return resolved === "ultra" ? CACHE_PROFILES.ultra : CACHE_PROFILES[resolved];
}

export function isCacheEnabled(kind: "startup" | "modules" | "data", preferences = readCachePreferences()) {
  return preferences.enabled && preferences[kind] && getCacheProfile(preferences).maxBytes > 0;
}

export function detectDeviceMemory(): number | null {
  if (typeof navigator === "undefined") return null;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof memory === "number" && Number.isFinite(memory) && memory > 0 ? memory : null;
}
