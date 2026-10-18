import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseConfig } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("Supabase public configuration", () => {
  it("connects to the project when Codespaces has no environment variables", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const config = supabaseConfig();
    expect(config.url).toBe("https://duolfhyodjhuatucjhtz.supabase.co");
    expect(config.key).toMatch(/^sb_publishable_/);
  });

  it("uses a complete environment override", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    expect(supabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      key: "sb_publishable_example",
    });
  });
});
