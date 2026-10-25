"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
import {
  clearSessionPolicyCookieHeader,
  createSessionPolicyValue,
  getSessionPolicyCookieHeader,
  getSessionPolicyExpiry,
  getSupabaseAuthCookieOptions,
  isRememberedSessionExpired,
  SESSION_POLICY_COOKIE,
} from "@/lib/auth-session-policy";

let cachedClient: SupabaseClient | null = null;
let cachedPolicy: string | null = null;

function readSessionPolicyCookie() {
  if (typeof document === "undefined") return null;
  const prefix = `${SESSION_POLICY_COOKIE}=`;
  const cookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function secureCookie() {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

export function setBrowserSessionPolicy(rememberFor30Days: boolean) {
  const value = createSessionPolicyValue(rememberFor30Days);
  document.cookie = getSessionPolicyCookieHeader(value, secureCookie());
  return value;
}

export function setBrowserSessionPolicyUntil(expiresAt: string | null) {
  const parsed = expiresAt ? Date.parse(expiresAt) : NaN;
  const value = Number.isFinite(parsed) ? `remember.${parsed}` : "session";
  document.cookie = getSessionPolicyCookieHeader(value, secureCookie());
  return value;
}

export function clearBrowserSessionPolicy() {
  if (typeof document !== "undefined") document.cookie = clearSessionPolicyCookieHeader(secureCookie());
}

export function isBrowserSessionPolicyExpired() {
  return isRememberedSessionExpired(readSessionPolicyCookie());
}

export function getBrowserSessionPolicyExpiry() {
  return getSessionPolicyExpiry(readSessionPolicyCookie());
}

export function createBrowserSupabaseClient(rememberFor30Days?: boolean): SupabaseClient {
  const config = supabaseConfig();
  if (!config) throw new Error("尚未配置 Supabase 项目地址和 Publishable Key");
  if (rememberFor30Days !== undefined) setBrowserSessionPolicy(rememberFor30Days);
  const policy = readSessionPolicyCookie();
  const remember = !isRememberedSessionExpired(policy) && policy?.startsWith("remember.") === true;
  const cacheKey = remember ? policy : "session";
  if (cachedClient && cachedPolicy === cacheKey) return cachedClient;
  if (cachedClient) void cachedClient.auth.stopAutoRefresh();
  cachedClient = createBrowserClient(config.url, config.key, {
    isSingleton: false,
    cookieOptions: getSupabaseAuthCookieOptions(policy, secureCookie()),
  });
  cachedPolicy = cacheKey;
  return cachedClient;
}

export async function recreateBrowserSupabaseClient(): Promise<SupabaseClient> {
  if (cachedClient) await cachedClient.auth.stopAutoRefresh();
  cachedClient = null;
  cachedPolicy = null;
  return createBrowserSupabaseClient();
}
