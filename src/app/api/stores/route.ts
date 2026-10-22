import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, rejectCrossOriginMutation } from "@/lib/supabase/auth";
const storeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  platform: z.enum(["pinduoduo", "douyin", "other"]).default("pinduoduo"),
  currency: z.enum(["CNY", "USD"]).default("CNY"),
  timezone: z.string().default("Asia/Shanghai"),
});
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const [storesResult, membersResult] = await Promise.all([
    auth.supabase
      .from("stores")
      .select("id,name,platform,currency,timezone,status,created_at")
      .eq("status", "active")
      .order("created_at"),
    auth.supabase
      .from("store_members")
      .select("store_id,role")
      .eq("user_id", auth.user.id),
  ]);
  const { data: stores, error } = storesResult;
  if (error) return apiError(error);
  const { data: members, error: memberError } = membersResult;
  if (memberError) return apiError(memberError);
  const roles = new Map((members || []).map((m) => [m.store_id, m.role]));
  return NextResponse.json({
    stores: (stores || [])
      .map((s) => ({ ...s, role: roles.get(s.id) }))
      .filter((s) => s.role),
    user: { id: auth.user.id, email: auth.user.email },
  });
}
export async function POST(request: Request) {
  const crossOrigin=rejectCrossOriginMutation(request);if(crossOrigin)return crossOrigin;
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  try {
    const input = storeSchema.parse(await request.json());
    const id = crypto.randomUUID();
    const { error } = await auth.supabase
      .from("stores")
      .insert({ id, ...input, created_by: auth.user.id });
    if (error) throw error;
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
