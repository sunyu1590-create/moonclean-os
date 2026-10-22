import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStore, apiError, rejectCrossOriginMutation } from "@/lib/supabase/auth";
const memberAction = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upsert"),
    email: z.string().trim().pipe(z.email()),
    role: z.enum(["admin", "editor", "viewer"]),
  }),
  z.object({ action: z.literal("remove"), email: z.string().trim().pipe(z.email()) }),
  z.object({ action: z.literal("transfer"), targetUserId: z.uuid() }),
]);
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const auth = await requireStore(storeId, ["owner", "admin"]);
  if (!auth.ok) return auth.error;
  const { data, error } = await auth.supabase.rpc("list_store_members", {
    p_store: storeId,
  });
  if (error) return apiError(error);
  return NextResponse.json({ members: data || [] });
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const crossOrigin=rejectCrossOriginMutation(request);if(crossOrigin)return crossOrigin;
  const { storeId } = await params;
  const auth = await requireStore(storeId, ["owner", "admin"]);
  if (!auth.ok) return auth.error;
  try {
    const input = memberAction.parse(await request.json());
    if (input.action === "transfer") {
      if (auth.role !== "owner")
        return NextResponse.json(
          { error: "只有店铺所有者可以转移所有权" },
          { status: 403 },
        );
      const { error } = await auth.supabase.rpc("transfer_store_ownership", {
        p_store: storeId,
        p_target_user: input.targetUserId,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    const { error } = await auth.supabase.rpc("manage_store_member", {
      p_store: storeId,
      p_email: input.email,
      p_role: input.action === "upsert" ? input.role : "viewer",
      p_action: input.action,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      if (error.message === "member email not confirmed") {
        return NextResponse.json({ error: "该邮箱已注册，但尚未完成邮箱验证。请让成员先验证邮箱后再添加。" }, { status: 400 });
      }
      if (error.message === "member account not found") {
        return NextResponse.json({ error: "没有找到该邮箱对应的账号，请检查邮箱拼写并确认对方已注册。" }, { status: 400 });
      }
    }
    return apiError(error, "成员操作失败");
  }
}
