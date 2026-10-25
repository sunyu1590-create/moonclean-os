import { NextResponse } from "next/server";
import { z } from "zod";
import { rejectCrossOriginMutation } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deviceLabel } from "@/lib/device-label";

const loginSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(1024),
  rememberFor30Days: z.boolean().default(false),
});

function response(body: { error: string }, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const denied = rejectCrossOriginMutation(request);
  if (denied) return denied;
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response({ error: "邮箱或密码格式不正确。" }, 400);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.trim(),
    password: parsed.data.password,
  });
  if (error || !data.user) {
    const message = error?.code === "email_not_confirmed" ? "请先验证邮箱，再登录。" : "邮箱或密码不正确。";
    return NextResponse.json({ error: message, code: error?.code || "login_failed" }, { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const sessionId = typeof claimsData?.claims?.session_id === "string" ? claimsData.claims.session_id : null;
  if (!sessionId) {
    await supabase.auth.signOut({ scope: "local" });
    return response({ error: "无法建立安全登录会话，请重试。" }, 503);
  }

  const userAgent = request.headers.get("user-agent") || "";
  const deviceHeader = z.uuid().safeParse(request.headers.get("x-moonclean-device-id"));
  const deviceId = deviceHeader.success ? deviceHeader.data : sessionId;
  const { error: registerError } = await supabase.rpc("register_current_device_session_for_device", {
    p_device_id: deviceId,
    p_device_label: deviceLabel(userAgent),
    p_user_agent: userAgent,
  });
  if (registerError) {
    await supabase.auth.signOut({ scope: "local" });
    return response({ error: "无法登记当前设备，请稍后重试。" }, 503);
  }

  const { data: registered, error: readError } = await supabase.from("user_device_sessions")
    .select("created_at")
    .eq("user_id", data.user.id)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (readError || !registered) {
    await supabase.auth.signOut({ scope: "local" });
    return response({ error: "无法保存登录时长，请稍后重试。" }, 503);
  }

  const rememberUntil = parsed.data.rememberFor30Days
    ? new Date(new Date(registered.created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const { data: updated, error: updateError } = await supabase.from("user_device_sessions")
    .update({ remember_until: rememberUntil })
    .eq("user_id", data.user.id)
    .eq("session_id", sessionId)
    .select("remember_until")
    .maybeSingle();
  if (updateError || !updated) {
    await supabase.auth.signOut({ scope: "local" });
    return response({ error: "无法保存登录时长，请稍后重试。" }, 503);
  }

  return NextResponse.json({ ok: true, rememberUntil }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
