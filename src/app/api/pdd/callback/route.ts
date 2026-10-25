import { NextResponse } from "next/server";
import { requireStore } from "@/lib/supabase/auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { buildPddTokenRequest, encryptPddCredential, PDD_REDIRECT_URI, PDD_TOKEN_URL, verifyPddOAuthState } from "@/lib/pinduoduo-oauth";

const STATE_COOKIE = "pdd_oauth_state";
function finish(result: string, status = 302) {
  const destination = new URL("/integrations", PDD_REDIRECT_URI);
  destination.searchParams.set("pddAuth", result);
  const response = NextResponse.redirect(destination, status);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/pdd/callback",
    maxAge: 0,
  });
  return response;
}

function tokenPayload(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const result = (body as Record<string, unknown>).pop_auth_token_create_response;
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const token = result as Record<string, unknown>;
  if (typeof token.access_token !== "string" || !token.access_token || typeof token.refresh_token !== "string" || !token.refresh_token) return null;
  const expiresAt = Number(token.expires_at);
  const expiresIn = Number(token.expires_in);
  const expiresAtSeconds = Number.isFinite(expiresAt) && expiresAt > 0
    ? expiresAt
    : Number.isFinite(expiresIn) && expiresIn > 0
      ? Math.floor(Date.now() / 1000) + expiresIn
      : 0;
  if (!expiresAtSeconds) return null;
  return { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: new Date(expiresAtSeconds * 1000).toISOString() };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const stateToken = url.searchParams.get("state") || "";
  const cookieState = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1) || "";
  const signingSecret = process.env.PDD_OAUTH_STATE_SECRET || "";
  const clientId = process.env.PDD_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.PDD_CLIENT_SECRET || "";
  const encryptionKey = process.env.PDD_TOKEN_ENCRYPTION_KEY || "";

  if (!stateToken || !cookieState || stateToken !== cookieState) return finish("invalid");
  const state = verifyPddOAuthState(stateToken, signingSecret);
  if (!state) return finish("expired");

  const auth = await requireStore(state.storeId, ["owner", "admin"]);
  if (!auth.ok || auth.user.id !== state.userId) {
    const destination = new URL("/login", PDD_REDIRECT_URI);
    destination.searchParams.set("next", "/integrations");
    const response = NextResponse.redirect(destination);
    response.cookies.set(STATE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/pdd/callback", maxAge: 0 });
    return response;
  }

  let db;
  try { db = createServiceSupabaseClient(); }
  catch { return finish("failed"); }

  const updateConnection = async (status: "unauthorized" | "authorized" | "expired" | "failed", lastResult: string) => {
    await db.from("platform_connections").update({ status, last_result: lastResult, updated_at: new Date().toISOString() })
      .eq("id", state.connectionId).eq("store_id", state.storeId).eq("mode", "official").eq("platform", "pinduoduo");
  };

  if (url.searchParams.has("error") || !url.searchParams.get("code")) {
    await updateConnection("unauthorized", url.searchParams.has("error") ? "拼多多授权已取消" : "授权未完成或已取消");
    return finish("cancelled");
  }
  if (!clientId || !clientSecret || !encryptionKey) {
    await updateConnection("failed", "拼多多服务端凭据未配置");
    return finish("failed");
  }

  const code = url.searchParams.get("code") || "";
  if (code.length > 512) {
    await updateConnection("failed", "拼多多返回的授权码无效");
    return finish("failed");
  }

  try {
    const params = buildPddTokenRequest(clientId, clientSecret, code);
    const response = await fetch(PDD_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
      body: new URLSearchParams(params),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => null);
    const tokens = response.ok ? tokenPayload(body) : null;
    if (!tokens) {
      await updateConnection("failed", "拼多多未能完成 Token 交换，请重新授权");
      return finish("failed");
    }

    const cryptoKey = encryptionKey;
    const { error: saveError } = await db.rpc("save_pdd_oauth_credentials", {
      p_store_id: state.storeId,
      p_connection_id: state.connectionId,
      p_client_id_ciphertext: encryptPddCredential(clientId, cryptoKey),
      p_client_secret_ciphertext: encryptPddCredential(clientSecret, cryptoKey),
      p_access_token_ciphertext: encryptPddCredential(tokens.accessToken, cryptoKey),
      p_refresh_token_ciphertext: encryptPddCredential(tokens.refreshToken, cryptoKey),
      p_expires_at: tokens.expiresAt,
    });
    if (saveError) throw saveError;

    const { error: connectionError } = await db.from("platform_connections").update({ status: "authorized", last_result: "拼多多店铺授权成功", updated_at: new Date().toISOString() })
      .eq("id", state.connectionId).eq("store_id", state.storeId).eq("mode", "official").eq("platform", "pinduoduo");
    if (connectionError) throw connectionError;
    return finish("success");
  } catch {
    await updateConnection("failed", "拼多多授权处理失败，请重新授权");
    return finish("failed");
  }
}

