import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, rejectCrossOriginMutation, requireStore } from "@/lib/supabase/auth";
import { appendOnlyResources, resourceSchemas, softDeleteResources, workspacePatchSchema, workspaceResource, workspaceTable } from "@/lib/workspace";

type Context = { params: Promise<{ storeId: string; resource: string }> };
type DynamicQuery = {
  select: (columns: string) => DynamicQuery;
  eq: (column: string, value: unknown) => DynamicQuery;
  order: (column: string, options: { ascending: boolean }) => DynamicQuery;
  limit: (count: number) => Promise<{ data: unknown[] | null; error: unknown }>;
  insert: (value: unknown) => DynamicQuery;
  update: (value: unknown) => DynamicQuery;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
};
type DynamicClient = { from: (table: string) => DynamicQuery };
async function authorize(context: Context, write = false) {
  const { storeId, resource: raw } = await context.params;
  if (!z.uuid().safeParse(storeId).success) return { error: NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 }) };
  const parsed = workspaceResource.safeParse(raw);
  if (!parsed.success) return { error: NextResponse.json({ error: "功能模块不存在" }, { status: 404 }) };
  const auth = await requireStore(storeId, write ? ["owner", "admin", "editor"] : undefined);
  return auth.ok ? { auth, storeId, resource: parsed.data, table: workspaceTable[parsed.data] } : { error: auth.error };
}
export async function GET(_request: Request, context: Context) {
  const result = await authorize(context); if (result.error) return result.error;
  const { data, error } = await (result.auth!.supabase as unknown as DynamicClient).from(result.table!).select("*").eq("store_id", result.storeId!).order("created_at", { ascending: false }).limit(500);
  if (error) return apiError(error, "模块数据读取失败");
  return NextResponse.json({ rows: data }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request, context: Context) {
  const denied = rejectCrossOriginMutation(request); if (denied) return denied;
  const result = await authorize(context, true); if (result.error) return result.error;
  if (result.resource === "copilot-messages" || result.resource === "note-versions" || result.resource === "service-template-versions") return NextResponse.json({ error: "此类历史记录由系统自动维护" }, { status: 405 });
  try {
    const schema = resourceSchemas[result.resource!];
    const row = schema.parse(await request.json()) as Record<string, unknown>;
    const fields = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "id"));
    const payload = { ...fields, store_id: result.storeId, created_by: result.auth!.user.id };
    const { data, error } = await (result.auth!.supabase as unknown as DynamicClient).from(result.table!).insert(payload).select("*").single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) { return apiError(error, "创建记录失败，请检查内容后重试"); }
}
export async function PATCH(request: Request, context: Context) {
  const denied = rejectCrossOriginMutation(request); if (denied) return denied;
  const result = await authorize(context, true); if (result.error) return result.error;
  if (appendOnlyResources.has(result.resource!)) return NextResponse.json({ error: "历史记录不可编辑" }, { status: 405 });
  try {
    const parsed = workspacePatchSchema(result.resource!).parse(await request.json());
    const { id } = parsed;
    if (!id) return NextResponse.json({ error: "缺少记录 ID" }, { status: 400 });
    const client = (result.auth!.supabase as unknown as DynamicClient).from(result.table!);
    const { data: existing, error: readError } = await client.select("*").eq("store_id", result.storeId!).eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!existing) return NextResponse.json({ error: "记录不存在或无权修改" }, { status: 404 });
    resourceSchemas[result.resource!].parse({ ...(existing as Record<string, unknown>), ...parsed });
    const fields = Object.fromEntries(Object.entries(parsed).filter(([key]) => key !== "id"));
    const { data, error } = await client.update(fields).eq("store_id", result.storeId!).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "记录不存在或无权修改" }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) { return apiError(error, "更新记录失败，请检查内容后重试"); }
}
export async function DELETE(request: Request, context: Context) {
  const denied = rejectCrossOriginMutation(request); if (denied) return denied;
  const result = await authorize(context, true); if (result.error) return result.error;
  if (appendOnlyResources.has(result.resource!) || !softDeleteResources.has(result.resource!)) return NextResponse.json({ error: "此类记录不支持删除" }, { status: 405 });
  try {
    const { id, restore, archive, restoreArchive } = z.object({ id: z.uuid(), restore: z.boolean().optional(), archive: z.boolean().optional(), restoreArchive: z.boolean().optional() }).parse(await request.json());
    const column = archive || restoreArchive || !["notes","copilot-conversations"].includes(result.resource!) ? "archived_at" : "deleted_at";
    const { data, error } = await (result.auth!.supabase as unknown as DynamicClient).from(result.table!).update({ [column]: restore ? null : new Date().toISOString() }).eq("store_id", result.storeId!).eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "记录不存在或无权修改" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error, "操作失败，请重试"); }
}
