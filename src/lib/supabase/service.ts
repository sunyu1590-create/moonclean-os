import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";

export function createServiceSupabaseClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("服务器尚未配置 SUPABASE_SECRET_KEY，无法安全保存店铺 AI 密钥");
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase 项目配置不可用");
  return createClient(config.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
