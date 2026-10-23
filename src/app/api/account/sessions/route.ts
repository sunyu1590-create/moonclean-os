import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, rejectCrossOriginMutation, requireUser } from "@/lib/supabase/auth";

function deviceLabel(userAgent: string) {
  const os = /iPhone|iPad/.test(userAgent) ? "iOS" : /Android/.test(userAgent) ? "Android" : /Windows/.test(userAgent) ? "Windows" : /Mac OS/.test(userAgent) ? "macOS" : /Linux/.test(userAgent) ? "Linux" : "其他系统";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" : /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "浏览器";
  return `${browser} · ${os}`;
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const { data: claimsData } = await auth.supabase.auth.getClaims();
  const currentSessionId = typeof claimsData?.claims?.session_id === "string" ? claimsData.claims.session_id : null;
  if (!currentSessionId) return NextResponse.json({ error: "无法读取当前登录设备" }, { status: 401 });
  const userAgent = request.headers.get("user-agent") || "";
  const { error: registerError } = await auth.supabase.rpc("register_current_device_session", { p_device_label: deviceLabel(userAgent), p_user_agent: userAgent });
  if (registerError) return apiError(registerError, "设备登记失败");
  const { data, error } = await auth.supabase.from("user_device_sessions").select("session_id,device_label,created_at,last_seen_at,revoked_at").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false });
  if (error) return apiError(error, "设备列表加载失败");
  return NextResponse.json({ sessions: data.map((session) => ({ ...session, current: session.session_id === currentSessionId })) });
}

export async function DELETE(request: Request) {
  const denied = rejectCrossOriginMutation(request);
  if (denied) return denied;
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const parsed = z.object({ sessionId: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "设备会话无效" }, { status: 400 });
  const { error } = await auth.supabase.rpc("revoke_device_session", { p_session_id: parsed.data.sessionId });
  if (error) return apiError(error, "无法移除此设备");
  return NextResponse.json({ ok: true });
}
