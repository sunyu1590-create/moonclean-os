import { NextResponse } from "next/server";
import { z } from "zod";
import { rejectCrossOriginMutation, requireStore } from "@/lib/supabase/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createPddOAuthState, encryptPddCredential, PDD_AUTHORIZATION_URL, PDD_REDIRECT_URI, PDD_STATE_TTL_SECONDS, randomPddStateNonce } from "@/lib/pinduoduo-oauth";

const inputSchema = z.object({ storeId: z.uuid() });
const STATE_COOKIE = "pdd_oauth_state";

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;

  let input: z.infer<typeof inputSchema>;
  try { input = inputSchema.parse(await request.json()); }
  catch { return NextResponse.json({ error: "店铺信息无效" }, { status: 400 }); }

  const auth = await requireStore(input.storeId, ["owner", "admin"]);
  if (!auth.ok) return auth.error;

  const clientId = process.env.PDD_CLIENT_ID?.trim();
  const clientSecret = process.env.PDD_CLIENT_SECRET;
  const signingSecret = process.env.PDD_OAUTH_STATE_SECRET;
  const encryptionKey = process.env.PDD_TOKEN_ENCRYPTION_KEY;
  if (!clientId || !clientSecret || !signingSecret || !encryptionKey || Buffer.byteLength(signingSecret) < 32) {
    return NextResponse.json({ error: "拼多多服务端凭据尚未配置，暂时无法发起真实授权。" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try { encryptPddCredential("configuration-check", encryptionKey); }
  catch { return NextResponse.json({ error: "拼多多 Token 加密配置无效，请联系管理员。" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }

  try {
    const db = createServiceSupabaseClient();
    const { data: existing, error: findError } = await db.from("platform_connections")
      .select("id").eq("store_id", input.storeId).eq("platform", "pinduoduo").eq("mode", "official").maybeSingle();
    if (findError) throw findError;

    let connectionId: string;
    if (existing?.id) {
      connectionId = String(existing.id);
      const { error } = await db.from("platform_connections").update({ status: "unauthorized", last_result: "等待拼多多店铺授权", updated_at: new Date().toISOString() }).eq("id", connectionId).eq("store_id", input.storeId);
      if (error) throw error;
    } else {
      const { data, error } = await db.from("platform_connections").insert({
        store_id: input.storeId,
        platform: "pinduoduo",
        mode: "official",
        status: "unauthorized",
        display_name: "拼多多店铺授权",
        auto_sync: false,
        last_result: "等待拼多多店铺授权",
      }).select("id").single();
      if (error || !data) throw error || new Error("connection insert failed");
      connectionId = String(data.id);
    }

    const state = createPddOAuthState({
      storeId: input.storeId,
      connectionId,
      userId: auth.user.id,
      issuedAt: Math.floor(Date.now() / 1000),
      nonce: randomPddStateNonce(),
    }, signingSecret);
    const authorization = new URL(PDD_AUTHORIZATION_URL);
    authorization.searchParams.set("response_type", "code");
    authorization.searchParams.set("client_id", clientId);
    authorization.searchParams.set("redirect_uri", PDD_REDIRECT_URI);
    authorization.searchParams.set("state", state);

    const response = NextResponse.json({ authorizationUrl: authorization.toString() }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/pdd/callback",
      maxAge: PDD_STATE_TTL_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "暂时无法创建拼多多授权请求，请稍后重试。" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

