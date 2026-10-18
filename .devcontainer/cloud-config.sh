#!/usr/bin/env bash
# Supabase publishable configuration is safe in browser code; RLS protects data.
# Codespaces secrets, when provided, override these defaults.
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://duolfhyodjhuatucjhtz.supabase.co}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-sb_publishable_r8vHGTUIcTbvOyGC8GJPRA_I9yra-OC}"
