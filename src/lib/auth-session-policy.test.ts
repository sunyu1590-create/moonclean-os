import { describe, expect, it } from "vitest";
import {
  clearSessionPolicyCookieHeader,
  createSessionPolicyValue,
  getSessionPolicyCookieHeader,
  getSessionPolicyExpiry,
  getSupabaseAuthCookieOptions,
  isRememberedSessionExpired,
} from "@/lib/auth-session-policy";

describe("登录会话时长策略", () => {
  it("普通会话保留浏览器会话级 Cookie", () => {
    const policy = createSessionPolicyValue(false, 1_800_000_000_000);
    expect(policy).toBe("session");
    expect(getSupabaseAuthCookieOptions(policy, true)).toEqual({ path: "/", sameSite: "lax", secure: true });
    expect(getSessionPolicyCookieHeader(policy, true)).toBe("moonclean-session-policy=session; Path=/; SameSite=Lax; Secure");
  });

  it("持久登录有固定 30 天截止时间，续签不会延长授权期限", () => {
    const now = 1_800_000_000_000;
    const policy = createSessionPolicyValue(true, now);
    expect(getSessionPolicyExpiry(policy)).toBe(now + 30 * 24 * 60 * 60 * 1000);
    expect(getSupabaseAuthCookieOptions(policy, true, now).maxAge).toBe(30 * 24 * 60 * 60);
    expect(isRememberedSessionExpired(policy, now + 29 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(isRememberedSessionExpired(policy, now + 30 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(getSessionPolicyCookieHeader(policy, false, now)).toContain("Max-Age=5184000");
  });

  it("退出时移除会话策略 Cookie", () => {
    expect(clearSessionPolicyCookieHeader(true)).toBe("moonclean-session-policy=; Path=/; Max-Age=0; SameSite=Lax; Secure");
  });
});
