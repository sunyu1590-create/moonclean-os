import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, rejectCrossOriginMutation, requireStore } from "@/lib/supabase/auth";

const message = z.object({ id: z.string().uuid(), role: z.enum(["user", "assistant"]), content: z.string().max(50000), createdAt: z.string().datetime(), model: z.string().max(80).optional(), sources: z.array(z.object({ title: z.string().max(240), url: z.string().url() })).max(10).optional() }).strict();
const conversation = z.object({ id: z.string().uuid(), title: z.string().min(1).max(240), category: z.enum(["未分类", "随便聊聊", "学习", "创作", "灵感", "工作"]), createdAt: z.string().datetime(), updatedAt: z.string().datetime(), messages: z.array(message).max(300), pinned: z.boolean().optional(), archivedAt: z.string().datetime().nullable().optional() }).strict();
type Context = { params: Promise<{ storeId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { storeId } = await params;
  const auth = await requireStore(storeId);
  if (!auth.ok) return auth.error;
  const { data, error } = await auth.supabase.from("free_ai_chat_conversations").select("conversation").eq("store_id", storeId).eq("user_id", auth.user.id).order("updated_at", { ascending: false }).limit(200);
  if (error) return apiError(error, "读取云端聊天记录失败");
  return NextResponse.json({ conversations: (data || []).map((row) => row.conversation) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, { params }: Context) {
  const denied = rejectCrossOriginMutation(request);
  if (denied) return denied;
  const { storeId } = await params;
  const auth = await requireStore(storeId);
  if (!auth.ok) return auth.error;
  const parsed = conversation.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data ?? {}), "utf8") > 250_000) return NextResponse.json({ error: "聊天记录格式无效或内容过长" }, { status: 400 });
  const item = parsed.data;
  const { error } = await auth.supabase.from("free_ai_chat_conversations").upsert({ id: item.id, user_id: auth.user.id, store_id: storeId, title: item.title, conversation: item, updated_at: new Date().toISOString() }, { onConflict: "user_id,store_id,id" });
  if (error) return apiError(error, "保存云端聊天记录失败");
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Context) {
  const denied = rejectCrossOriginMutation(request);
  if (denied) return denied;
  const { storeId } = await params;
  const auth = await requireStore(storeId);
  if (!auth.ok) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "对话 ID 无效" }, { status: 400 });
  const { error } = await auth.supabase.from("free_ai_chat_conversations").delete().eq("id", id).eq("store_id", storeId).eq("user_id", auth.user.id);
  if (error) return apiError(error, "删除云端聊天记录失败");
  return NextResponse.json({ ok: true });
}
