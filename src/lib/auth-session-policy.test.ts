import { describe, expect, it } from "vitest";
import { stringifySetCookie } from "cookie";
import {
  applySessionPolicyCookieOptions,
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
    expect(getSupabaseAuthCookieOptions(policy, true, now).expires).toEqual(new Date(now + 30 * 24 * 60 * 60 * 1000));
    expect(isRememberedSessionExpired(policy, now + 29 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(isRememberedSessionExpired(policy, now + 30 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(getSessionPolicyCookieHeader(policy, false, now)).toContain("Max-Age=5184000");

    const refreshed = applySessionPolicyCookieOptions({ path: "/", maxAge: 400 * 24 * 60 * 60 }, policy, now + 29 * 24 * 60 * 60 * 1000);
    expect(refreshed.maxAge).toBe(24 * 60 * 60);
    expect(refreshed.expires).toEqual(new Date(now + 30 * 24 * 60 * 60 * 1000));
  });

  it("覆盖 SSR 库默认的 400 天 Cookie，未勾选时写为浏览器会话 Cookie", () => {
    const options = applySessionPolicyCookieOptions({ path: "/", sameSite: "lax", secure: true, httpOnly: false, maxAge: 400 * 24 * 60 * 60 }, "session");
    expect(options).toEqual({ path: "/", sameSite: "lax", secure: true, httpOnly: false });
    const header = stringifySetCookie("sb-project-auth-token.0", "token", options);
    expect(header).not.toMatch(/Max-Age|Expires|Domain/i);
    expect(header).toContain("Path=/");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Secure");
    expect(header).not.toMatch(/HttpOnly/i);
  });

  it("写入的 30 天 Cookie 同时带固定 Expires 和剩余 Max-Age", () => {
    const now = 1_800_000_000_000;
    const policy = createSessionPolicyValue(true, now);
    const options = applySessionPolicyCookieOptions({ path: "/", sameSite: "lax", secure: true, maxAge: 400 * 24 * 60 * 60 }, policy, now);
    expect(options.maxAge).toBe(30 * 24 * 60 * 60);
    expect(options.expires).toEqual(new Date(now + 30 * 24 * 60 * 60 * 1000));
    const header = stringifySetCookie("sb-project-auth-token.0", "token", options);
    expect(header).toContain("Max-Age=2592000");
    expect(header).toContain("Expires=");
    expect(header).not.toMatch(/Domain=/i);
  });

  it("保留 Supabase 明确的 Cookie 删除操作", () => {
    expect(applySessionPolicyCookieOptions({ path: "/", maxAge: 0 }, "session")).toEqual({ path: "/", maxAge: 0 });
  });

  it("退出时移除会话策略 Cookie", () => {
    expect(clearSessionPolicyCookieHeader(true)).toBe("moonclean-session-policy=; Path=/; Max-Age=0; SameSite=Lax; Secure");
  });
});
