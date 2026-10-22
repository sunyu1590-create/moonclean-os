import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, rejectCrossOriginMutation } from "@/lib/supabase/auth";
const schema = z.object({
  displayName: z.string().trim().max(100),
  avatarUrl: z.union([z.url(), z.literal("")]).optional(),
});
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  const { data, error } = await auth.supabase
    .from("profiles")
    .select("display_name,avatar_url")
    .eq("id", auth.user.id)
    .single();
  if (error) return apiError(error);
  return NextResponse.json({
    userId: auth.user.id,
    email: auth.user.email,
    emailConfirmed: Boolean(auth.user.email_confirmed_at),
    profile: data,
  });
}
export async function PATCH(request: Request) {
  const crossOrigin=rejectCrossOriginMutation(request);if(crossOrigin)return crossOrigin;
  const auth = await requireUser();
  if (!auth.ok) return auth.error;
  try {
    const input = schema.parse(await request.json());
    const { error } = await auth.supabase
      .from("profiles")
      .update({
        display_name: input.displayName,
        avatar_url: input.avatarUrl || null,
      })
      .eq("id", auth.user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
