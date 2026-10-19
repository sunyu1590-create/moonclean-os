import { NextResponse } from "next/server";
import { z } from "zod";
import { rejectCrossOriginMutation, requireUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

const attachmentUpdateSchema = z.object({
  cases: z.array(z.object({
    storeId: z.uuid(),
    caseId: z.uuid(),
    paths: z.array(z.string().min(1).max(500)).max(20),
  })).max(2000),
});

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.error;

  const { data: memberships, error: memberError } = await auth.supabase
    .from("store_members")
    .select("store_id")
    .eq("user_id", auth.user.id)
    .eq("role", "owner");
  if (memberError) return NextResponse.json({ error: "读取店铺权限失败" }, { status: 500 });
  const ids = [...new Set((memberships || []).map((row) => row.store_id))];
  if (!ids.length) return NextResponse.json({ error: "附件备份仅限店铺 Owner 操作" }, { status: 403 });

  const [{ data: stores, error: storesError }, { data: cases, error: casesError }] = await Promise.all([
    auth.supabase.from("stores").select("id,name").in("id", ids).order("name"),
    auth.supabase.from("service_cases").select("id,store_id,attachment_paths").in("store_id", ids),
  ]);
  if (storesError || casesError) return NextResponse.json({ error: "读取售后附件清单失败，请确认数据库迁移已应用" }, { status: 500 });
  return NextResponse.json({
    stores: stores || [],
    cases: cases || [],
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOriginMutation(request);
  if (crossOrigin) return crossOrigin;
  const auth = await requireUser();
  if (!auth.ok) return auth.error;

  const body = attachmentUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "附件恢复清单格式无效" }, { status: 400 });
  const storeIds = [...new Set(body.data.cases.map((item) => item.storeId))];
  if (!storeIds.length) return NextResponse.json({ updated: 0 });

  const { data: memberships, error: memberError } = await auth.supabase
    .from("store_members").select("store_id").eq("user_id", auth.user.id).eq("role", "owner").in("store_id", storeIds);
  if (memberError) return NextResponse.json({ error: "校验店铺权限失败" }, { status: 500 });
  const owned = new Set((memberships || []).map((row) => row.store_id));
  if (storeIds.some((id) => !owned.has(id))) return NextResponse.json({ error: "附件只能恢复到当前账号拥有的店铺" }, { status: 403 });

  let updated = 0;
  let attachedPaths = 0;
  const failures: { caseId: string; error: string }[] = [];
  for (const item of body.data.cases) {
    if (item.paths.some((path) => !path.startsWith(`${item.storeId}/cases/${item.caseId}/`) || path.includes(".."))) {
      failures.push({ caseId: item.caseId, error: "附件路径与店铺或工单不匹配" });
      continue;
    }
    const { data: current, error: readError } = await auth.supabase.from("service_cases")
      .select("attachment_paths").eq("store_id", item.storeId).eq("id", item.caseId).maybeSingle();
    if (readError || !current) {
      failures.push({ caseId: item.caseId, error: "目标工单不存在或不可访问" });
      continue;
    }
    const paths = [...new Set([...(current.attachment_paths || []), ...item.paths])];
    if (paths.length > 20) {
      failures.push({ caseId: item.caseId, error: "恢复后附件数量超过单个工单上限 20 个" });
      continue;
    }
    const { error } = await auth.supabase.from("service_cases").update({ attachment_paths: paths })
      .eq("store_id", item.storeId).eq("id", item.caseId);
    if (error) failures.push({ caseId: item.caseId, error: "保存工单附件关系失败" });
    else { updated += 1; attachedPaths += item.paths.length; }
  }
  return NextResponse.json({ updated, attachedPaths, failures }, { status: failures.length ? 207 : 200 });
}
