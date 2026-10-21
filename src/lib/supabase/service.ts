import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";

export function getSupabaseServiceKey() {
  // Vercel's Supabase integration commonly provides this legacy server key.
  // Prefer it when present; SUPABASE_SECRET_KEY remains supported.
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

export function createServiceSupabaseClient() {
  const key = getSupabaseServiceKey();
  if (!key) throw new Error("服务器未配置 Supabase 服务端访问密钥");
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase 项目配置不可用");
  return createClient(config.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
