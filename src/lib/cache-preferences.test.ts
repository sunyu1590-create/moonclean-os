import { describe, expect, it } from "vitest";
import { CACHE_PROFILES, DEFAULT_CACHE_PREFERENCES, getCacheProfile, isCacheEnabled, parseCachePreferences, resolveCacheIntensity, suggestedCacheIntensity } from "./cache-preferences";

describe("application cache preferences", () => {
  it("suggests smaller or larger profiles from reported device memory", () => {
    expect(suggestedCacheIntensity(1)).toBe("low");
    expect(suggestedCacheIntensity(2)).toBe("standard");
    expect(suggestedCacheIntensity(8)).toBe("high");
    expect(suggestedCacheIntensity(null)).toBe("standard");
  });

  it("keeps explicit choices and caps high intensity at a bounded cache size", () => {
    expect(resolveCacheIntensity("high", 1)).toBe("high");
    expect(getCacheProfile({ ...DEFAULT_CACHE_PREFERENCES, intensity: "low" }).maxBytes).toBe(8 * 1024 * 1024);
    expect(getCacheProfile({ ...DEFAULT_CACHE_PREFERENCES, intensity: "standard" }).maxBytes).toBe(24 * 1024 * 1024);
    expect(getCacheProfile({ ...DEFAULT_CACHE_PREFERENCES, intensity: "high" }).maxBytes).toBe(48 * 1024 * 1024);
    expect(getCacheProfile({ ...DEFAULT_CACHE_PREFERENCES, intensity: "ultra" }).maxBytes).toBe(1024 * 1024 * 1024);
    expect(CACHE_PROFILES.ultra.maxEntries).toBeGreaterThan(CACHE_PROFILES.high.maxEntries);
    expect(CACHE_PROFILES.high.maxEntries).toBeGreaterThan(CACHE_PROFILES.standard.maxEntries);
  });

  it("supports custom capacity from zero through six GiB", () => {
    expect(getCacheProfile({ ...DEFAULT_CACHE_PREFERENCES, intensity: "custom", customMegabytes: 0 }).maxBytes).toBe(0);
    expect(getCacheProfile({ ...DEFAULT_CACHE_PREFERENCES, intensity: "custom", customMegabytes: 6144 }).maxBytes).toBe(6 * 1024 * 1024 * 1024);
    expect(parseCachePreferences({ customMegabytes: 9000 }).customMegabytes).toBe(6144);
    expect(parseCachePreferences({ customMegabytes: -4 }).customMegabytes).toBe(0);
  });

  it("defaults malformed preferences and applies the global switch to every cache group", () => {
    expect(parseCachePreferences({ enabled: false, intensity: "fast" })).toEqual({ ...DEFAULT_CACHE_PREFERENCES, enabled: false });
    const disabled = { ...DEFAULT_CACHE_PREFERENCES, enabled: false };
    expect(isCacheEnabled("startup", disabled)).toBe(false);
    expect(isCacheEnabled("modules", disabled)).toBe(false);
    expect(isCacheEnabled("data", disabled)).toBe(false);
  });
});
