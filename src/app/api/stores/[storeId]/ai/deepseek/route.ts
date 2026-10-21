import { NextResponse } from "next/server";
import { apiError, rejectCrossOriginMutation, requireStore } from "@/lib/supabase/auth";

type Context = { params: Promise<{ storeId: string }> };
const jsonError = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(_request: Request, { params }: Context) {
  const { storeId } = await params;
  const auth = await requireStore(storeId);
  if (!auth.ok) return auth.error;
  const { data, error } = await auth.supabase.from("store_ai_credentials").select("key_ciphertext,key_salt,key_iv,failed_attempts,locked_at").eq("store_id", storeId).maybeSingle();
  if (error) return apiError(error, "读取 DeepSeek 配置失败");
  const locked = Boolean(data?.locked_at) || (data?.failed_attempts ?? 0) >= 5;
  if (!data?.key_ciphertext || !data.key_salt || !data.key_iv || locked) return NextResponse.json({ configured: false, locked });
  return NextResponse.json({ configured: true, envelope: { key_ciphertext: data.key_ciphertext, key_salt: data.key_salt, key_iv: data.key_iv } }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: Context) {
  const denied = rejectCrossOriginMutation(request);
  if (denied) return denied;
  const { storeId } = await params;
  const auth = await requireStore(storeId, ["owner", "admin"]);
  if (!auth.ok) return auth.error;
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("请求格式无效"); }
  if (!body || typeof body !== "object") return jsonError("请求格式无效");
  const envelope = body as Record<string, unknown>;
  const ciphertext = envelope.key_ciphertext;
  const salt = envelope.key_salt;
  const iv = envelope.key_iv;
  if (typeof ciphertext !== "string" || ciphertext.length > 12_000 || typeof salt !== "string" || salt.length > 100 || typeof iv !== "string" || iv.length > 100) return jsonError("加密密钥格式无效");
  const { error } = await auth.supabase.from("store_ai_credentials").upsert({ store_id: storeId, provider: "deepseek", key_ciphertext: ciphertext, key_salt: salt, key_iv: iv, failed_attempts: 0, locked_at: null, updated_at: new Date().toISOString() }, { onConflict: "store_id" });
  if (error) return apiError(error, "保存 DeepSeek 配置失败");
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: Context) {
  const denied = rejectCrossOriginMutation(request);
  if (denied) return denied;
  const { storeId } = await params;
  const auth = await requireStore(storeId);
  if (!auth.ok) return auth.error;
  let body: { action?: unknown };
  try { body = await request.json() as { action?: unknown }; } catch { return jsonError("请求格式无效"); }
  if (body.action !== "failed") return jsonError("操作无效");
  const { data, error } = await auth.supabase.rpc("record_store_ai_credential_attempt", { p_store: storeId });
  if (error) return apiError(error, "更新解锁状态失败");
  const result = data as { failed_attempts?: number; destroyed?: boolean } | null;
  return NextResponse.json({ attemptsLeft: Math.max(0, 5 - (result?.failed_attempts ?? 0)), destroyed: Boolean(result?.destroyed) });
}

export async function DELETE(request: Request, { params }: Context) {
  const denied = rejectCrossOriginMutation(request);
  if (denied) return denied;
  const { storeId } = await params;
  const auth = await requireStore(storeId, ["owner", "admin"]);
  if (!auth.ok) return auth.error;
  const { error } = await auth.supabase.from("store_ai_credentials").delete().eq("store_id", storeId);
  if (error) return apiError(error, "清除 DeepSeek 配置失败");
  return NextResponse.json({ ok: true });
}
