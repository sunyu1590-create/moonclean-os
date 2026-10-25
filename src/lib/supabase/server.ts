import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
import { applySessionPolicyCookieOptions, getSupabaseAuthCookieOptions, SESSION_POLICY_COOKIE } from "@/lib/auth-session-policy";

export async function createServerSupabaseClient() {
  const config = supabaseConfig();
  if (!config) throw new Error("尚未配置 Supabase 项目地址和 Publishable Key");
  const cookieStore = await cookies();
  const sessionPolicy = cookieStore.get(SESSION_POLICY_COOKIE)?.value;
  return createServerClient(config.url, config.key, {
    cookieOptions: getSupabaseAuthCookieOptions(sessionPolicy, process.env.NODE_ENV === "production"),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, applySessionPolicyCookieOptions(options, sessionPolicy)));
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes sessions.
        }
      },
    },
  });
}
