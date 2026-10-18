import { NextResponse } from "next/server";
import { z } from "zod";
import { taskSchema } from "@/lib/operations";
import { requireStore, rejectCrossOriginMutation, apiError } from "@/lib/supabase/auth";
type Context = { params: Promise<{ storeId: string }> };
async function authorize(context: Context, write = false) {
  const { storeId } = await context.params;
  if (!z.uuid().safeParse(storeId).success) return { error: NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 }) };
  const auth = await requireStore(storeId,write?["owner","admin","editor"]:undefined);
  return auth.ok ? { auth, storeId } : { error: auth.error };
}
export async function GET(_request: Request, context: Context) {
  const result = await authorize(context); if (result.error) return result.error;
  const { data, error } = await result.auth!.supabase.from("operation_tasks")
    .select("id,title,detail,priority,status,due_date,created_at,updated_at,completed_at,recommendation_key,recommendation_baseline")
    .eq("store_id",result.storeId!).order("created_at",{ascending:false}).limit(500);
  if (error) return apiError(error,"待办读取失败");
  return NextResponse.json({ tasks: data });
}
export async function POST(request: Request, context: Context) {
  const denied = rejectCrossOriginMutation(request); if (denied) return denied;
  const result = await authorize(context,true); if (result.error) return result.error;
  try {
    const row = taskSchema.parse(await request.json());
    if (row.recommendationKey) {
      const { data: existing, error: lookupError } = await result.auth!.supabase.from("operation_tasks")
        .select("id,title,detail,priority,status,due_date,created_at,updated_at,completed_at,recommendation_key,recommendation_baseline")
        .eq("store_id", result.storeId!).eq("recommendation_key", row.recommendationKey).in("status", ["todo", "doing"]).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) return NextResponse.json(existing, { status: 200 });
    }
    const { data, error } = await result.auth!.supabase.from("operation_tasks").insert({
      store_id:result.storeId!,created_by:result.auth!.user.id,title:row.title,
      detail:row.detail,priority:row.priority,status:row.status,due_date:row.dueDate,
      recommendation_key:row.recommendationKey||null,recommendation_baseline:row.recommendationBaseline||null,
    }).select("id,title,detail,priority,status,due_date,created_at,updated_at,completed_at,recommendation_key,recommendation_baseline").single();
    if (error) {
      if (error.code === "23505" && row.recommendationKey) {
        const { data: existing } = await result.auth!.supabase.from("operation_tasks")
          .select("id,title,detail,priority,status,due_date,created_at,updated_at,completed_at,recommendation_key,recommendation_baseline")
          .eq("store_id", result.storeId!).eq("recommendation_key", row.recommendationKey).in("status", ["todo", "doing"]).maybeSingle();
        if (existing) return NextResponse.json(existing, { status: 200 });
      }
      throw error;
    }
    return NextResponse.json(data,{status:201});
  } catch (error) { return apiError(error,"创建待办失败"); }
}
export async function PATCH(request: Request, context: Context) {
  const denied = rejectCrossOriginMutation(request); if (denied) return denied;
  const result = await authorize(context,true); if (result.error) return result.error;
  try {
    const parsed = taskSchema.extend({ id:z.uuid() }).parse(await request.json());
    const { data, error } = await result.auth!.supabase.from("operation_tasks").update({
      title:parsed.title,detail:parsed.detail,priority:parsed.priority,status:parsed.status,due_date:parsed.dueDate,
    }).eq("store_id",result.storeId!).eq("id",parsed.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({error:"待办不存在"},{status:404});
    return NextResponse.json({ ok:true });
  } catch (error) { return apiError(error,"更新待办失败"); }
}
export async function DELETE(request: Request, context: Context) {
  const denied = rejectCrossOriginMutation(request); if (denied) return denied;
  const result = await authorize(context,true); if (result.error) return result.error;
  try {
    const { id } = z.object({id:z.uuid()}).parse(await request.json());
    const { data, error } = await result.auth!.supabase.from("operation_tasks")
      .delete().eq("store_id",result.storeId!).eq("id",id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({error:"待办不存在"},{status:404});
    return NextResponse.json({ok:true});
  } catch (error) { return apiError(error,"删除待办失败"); }
}
