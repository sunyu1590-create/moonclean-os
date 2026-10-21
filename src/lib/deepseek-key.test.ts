import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptDeepSeekKey, encryptDeepSeekKey, fetchDeepSeekKey } from "./deepseek-key";

afterEach(() => vi.unstubAllGlobals());

describe("DeepSeek key encryption", () => {
  it("round-trips a key and rejects an incorrect PIN", async () => {
    const envelope = await encryptDeepSeekKey("  sk-test-secret  ", "0427");
    expect(envelope.key_ciphertext).not.toContain("sk-test-secret");
    await expect(decryptDeepSeekKey(envelope, "0427")).resolves.toBe("sk-test-secret");
    await expect(decryptDeepSeekKey(envelope, "0428")).rejects.toThrow();
  });

  it("requires a four-digit PIN", async () => {
    await expect(encryptDeepSeekKey("sk-test-secret", "123")).rejects.toThrow("四位数字");
  });

  it("counts failed unlock attempts and reports key destruction on the fifth", async () => {
    const envelope = await encryptDeepSeekKey("sk-test-secret", "0427");
    let failures = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method) return Response.json({ configured: true, envelope });
      failures += 1;
      return Response.json({ attemptsLeft: 5 - failures, destroyed: failures === 5 });
    }));

    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(fetchDeepSeekKey("store-id", "0000")).rejects.toThrow(`还可尝试 ${5 - attempt} 次`);
    }
    await expect(fetchDeepSeekKey("store-id", "0000")).rejects.toThrow("云端密钥已销毁");
    expect(failures).toBe(5);
  });
});
