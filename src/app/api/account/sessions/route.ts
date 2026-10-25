import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, rejectCrossOriginMutation, requireUser } from "@/lib/supabase/auth";
import { groupDeviceSessions } from "@/lib/device-sessions";

function deviceLabel(userAgent: string) {
  const os = /iPhone|iPad/.test(userAgent) ? "iOS" : /Android/.test(userAgent) ? "Android" : /Windows/.test(userAgent) ? "Windows" : /Mac OS/.test(userAgent) ? "macOS" : /Linux/.test(userAgent) ? "Linux" : "其他系统";
  const browser = /EdgA?\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "浏览器";
  return `${browser} · ${os}`;
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const { data: claimsData } = await auth.supabase.auth.getClaims();
  const currentSessionId = typeof claimsData?.claims?.session_id === "string" ? claimsData.claims.session_id : null;
  if (!currentSessionId) return NextResponse.json({ error: "无法读取当前登录设备" }, { status: 401 });
  const requestedDeviceId = z.uuid().safeParse(request.headers.get("x-moonclean-device-id"));
  const deviceId = requestedDeviceId.success ? requestedDeviceId.data : currentSessionId;
  const userAgent = request.headers.get("user-agent") || "";
  const { error: registerError } = await auth.supabase.rpc("register_current_device_session_for_device", { p_device_id: deviceId, p_device_label: deviceLabel(userAgent), p_user_agent: userAgent });
  if (registerError) return apiError(registerError, "设备登记失败");
  const { data, error } = await auth.supabase.from("user_device_sessions").select("session_id,device_id,device_label,created_at,last_seen_at,revoked_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false });
  if (error) return apiError(error, "设备列表加载失败");
  return NextResponse.json({ sessions: groupDeviceSessions(data, currentSessionId) }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function DELETE(request: Request) {
  const denied = rejectCrossOriginMutation(request);
  if (denied) return denied;
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const parsed = z.union([z.object({ deviceId: z.uuid() }), z.object({ sessionId: z.uuid() }), z.object({ legacy: z.literal(true) })]).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "设备会话无效" }, { status: 400 });
  let error: { message: string } | null = null;
  if ("legacy" in parsed.data) {
    ({ error } = await auth.supabase.rpc("revoke_unidentified_device_sessions"));
  } else if ("deviceId" in parsed.data) {
    ({ error } = await auth.supabase.rpc("revoke_device_sessions_for_device", { p_device_id: parsed.data.deviceId }));
  } else {
    const { data: session } = await auth.supabase.from("user_device_sessions").select("device_id").eq("session_id", parsed.data.sessionId).eq("user_id", auth.user.id).maybeSingle();
    if (session?.device_id) ({ error } = await auth.supabase.rpc("revoke_device_sessions_for_device", { p_device_id: session.device_id }));
    else ({ error } = await auth.supabase.rpc("revoke_device_session", { p_session_id: parsed.data.sessionId }));
  }
  if (error) return apiError(error, "无法移除此设备");
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
