import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, rejectCrossOriginMutation, requireUser } from "@/lib/supabase/auth";

const schema = z.object({
  language: z.enum(["zh-CN", "en-US"]).optional(),
  theme: z.enum(["day", "night"]).optional(),
  font: z.enum(["oppo", "system"]).optional(),
  motion: z.enum(["refined", "standard", "simple"]).optional(),
  pageTransition: z.enum(["blur-fade", "blur-lift"]).optional(),
  notificationStyle: z.enum(["glass", "capsule", "adaptive"]).optional(),
  notificationMotion: z.enum(["soft", "expand", "directional"]).optional(),
  notificationSpeed: z.enum(["fast", "balanced", "elegant"]).optional(),
  debugEnabled: z.boolean().optional(),
  debugMetrics: z.array(z.enum(["fps", "memory", "viewport", "network", "longtasks", "vitals", "workspace"])).max(7).optional(),
  cacheEnabled: z.boolean().optional(),
  startupCache: z.boolean().optional(),
  moduleCache: z.boolean().optional(),
  dataCache: z.boolean().optional(),
  cacheIntensity: z.enum(["auto", "low", "standard", "high"]).optional(),
}).strict();

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const { data, error } = await auth.supabase.from("user_preferences").select("preferences,updated_at").eq("user_id", auth.user.id).maybeSingle();
  if (error) return apiError(error, "读取云端偏好失败");
  return NextResponse.json({ preferences: data?.preferences ?? {}, updatedAt: data?.updated_at ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const denied = rejectCrossOriginMutation(request);
  if (denied) return denied;
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "偏好设置格式无效" }, { status: 400 });
  const { error } = await auth.supabase.from("user_preferences").upsert({ user_id: auth.user.id, preferences: parsed.data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return apiError(error, "保存云端偏好失败");
  return NextResponse.json({ ok: true });
}
