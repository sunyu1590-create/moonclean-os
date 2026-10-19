import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStore, rejectCrossOriginMutation } from "@/lib/supabase/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { encryptDeepSeekKey } from "@/lib/deepseek-credentials";

const uuid = z.uuid();
const bodySchema = z.object({ apiKey: z.string().trim().min(20).max(512) });
const configError = (cause: unknown) => {
  const message = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "配置操作失败";
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  const status = cause && typeof cause === "object" && "status" in cause && typeof cause.status === "number" ? cause.status : 0;
  if (/store_ai_credentials|schema cache|does not exist/i.test(message)) return "数据库尚未安装 DeepSeek 密钥迁移。请先应用仓库中的 store_deepseek_credentials 数据库迁移。";
  if (/SUPABASE_SECRET_KEY/i.test(message)) return message;
  if (status === 401 || /invalid api key|invalid jwt|jwt expired|unauthorized/i.test(`${code} ${message}`)) return "Vercel 中的 SUPABASE_SECRET_KEY 未被当前 Supabase 项目接受。请确认它来自 MoonClean OS 项目的 Secret keys，并保存到 Production 后重新部署。";
  if (status === 403 || code === "42501" || /permission denied|insufficient privilege/i.test(message)) return "Supabase 已拒绝服务端密钥访问。请确认填入的是当前项目的 Secret key，而不是 Publishable 或 anon key。";
  if (/fetch failed|timeout|econnrefused|network/i.test(message)) return "服务器无法连接 Supabase。请检查项目地址、网络状态和 Vercel 部署环境。";
  return "读取或保存配置失败，请检查数据库迁移和服务端环境变量后重试。";
};

export async function GET(_request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!uuid.safeParse(storeId).success) return NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 });
  const auth = await requireStore(storeId, ["owner", "admin"]);
  if (!auth.ok) return auth.error;
  if (!process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ configured: Boolean(process.env.DEEPSEEK_API_KEY), source: process.env.DEEPSEEK_API_KEY ? "environment" : "unset", canSave: false, error: "服务器未配置 SUPABASE_SECRET_KEY，暂时无法在系统内安全保存 API Key。" }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const db = createServiceSupabaseClient();
    const { data, error } = await db.from("store_ai_credentials").select("store_id,updated_at").eq("store_id", storeId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ configured: Boolean(data || process.env.DEEPSEEK_API_KEY), source: data ? "store" : process.env.DEEPSEEK_API_KEY ? "environment" : "unset", updatedAt: data?.updated_at || null, canSave: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    return NextResponse.json({ configured: Boolean(process.env.DEEPSEEK_API_KEY), source: process.env.DEEPSEEK_API_KEY ? "environment" : "unset", canSave: false, error: configError(cause) }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;
  const { storeId } = await params;
  if (!uuid.safeParse(storeId).success) return NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 });
  const auth = await requireStore(storeId, ["owner", "admin"]);
  if (!auth.ok) return auth.error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请输入有效的 DeepSeek API Key" }, { status: 400 });
  let verification: Response;
  try {
    verification = await fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${parsed.data.apiKey}` }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "连接 DeepSeek 超时或网络不可用，请稍后重试" }, { status: 502 });
  }
  if (verification.status === 401 || verification.status === 403) return NextResponse.json({ error: "DeepSeek API Key 无效或没有访问权限" }, { status: 422 });
  if (!verification.ok) return NextResponse.json({ error: "暂时无法验证 DeepSeek 服务，请稍后重试" }, { status: 502 });
  try {
    const db = createServiceSupabaseClient();
    const { error } = await db.from("store_ai_credentials").upsert({ store_id: storeId, provider: "deepseek", key_ciphertext: encryptDeepSeekKey(parsed.data.apiKey), updated_at: new Date().toISOString() }, { onConflict: "store_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true, configured: true, source: "store" }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    return NextResponse.json({ error: configError(cause) }, { status: /SUPABASE_SECRET_KEY|migration|迁移/i.test(configError(cause)) ? 503 : 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;
  const { storeId } = await params;
  if (!uuid.safeParse(storeId).success) return NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 });
  const auth = await requireStore(storeId, ["owner", "admin"]);
  if (!auth.ok) return auth.error;
  try {
    const db = createServiceSupabaseClient();
    const { error } = await db.from("store_ai_credentials").delete().eq("store_id", storeId);
    if (error) throw error;
    return NextResponse.json({ ok: true, configured: Boolean(process.env.DEEPSEEK_API_KEY), source: process.env.DEEPSEEK_API_KEY ? "environment" : "unset" }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    return NextResponse.json({ error: configError(cause) }, { status: /SUPABASE_SECRET_KEY|migration|迁移/i.test(configError(cause)) ? 503 : 500 });
  }
}
