"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

export function createBrowserSupabaseClient() {
  const config = supabaseConfig();
  if (!config) throw new Error("尚未配置 Supabase 项目地址和 Publishable Key");
  return createBrowserClient(config.url, config.key);
}
