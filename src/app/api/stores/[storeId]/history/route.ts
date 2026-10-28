import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStore } from "@/lib/supabase/auth";

type RevisionQuery = {
  select: (columns: string) => RevisionQuery;
  eq: (column: string, value: unknown) => RevisionQuery;
  order: (column: string, options: { ascending: boolean }) => RevisionQuery;
  range: (from: number, to: number) => Promise<{ data: unknown[] | null; error: unknown }>;
};
type DynamicClient = { from: (table: string) => RevisionQuery };

const dateSchema = z.iso.date();
const PAGE_SIZE = 500;
const MAX_ROWS = 20_000;

export async function GET(request: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  if (!z.uuid().safeParse(storeId).success) return NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 });
  const auth = await requireStore(storeId);
  if (!auth.ok) return auth.error;

  const search = new URL(request.url).searchParams;
  const from = search.get("from");
  const to = search.get("to");
  const businessDate = search.get("revisionsFor");
  if (!dateSchema.safeParse(from).success || !dateSchema.safeParse(to).success || !from || !to || from > to) {
    return NextResponse.json({ error: "请选择有效的起止日期" }, { status: 400 });
  }
  if (!dateSchema.safeParse(businessDate).success || !businessDate || businessDate < from || businessDate > to) {
    return NextResponse.json({ error: "请选择有效的历史版本日期" }, { status: 400 });
  }
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (span > 365) return NextResponse.json({ error: "单次最多查询 366 天，请缩短日期范围" }, { status: 400 });

  try {
    const client = auth.supabase as unknown as DynamicClient;
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
      const { data, error } = await client.from("business_metric_revisions")
        .select("id,store_id,business_date,metric_type,source_record_id,action,before_values,after_values,changed_by,created_at")
        .eq("store_id", storeId)
        .eq("business_date", businessDate)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data || []) as Record<string, unknown>[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) return NextResponse.json({ revisions: rows, truncated: false }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ revisions: rows, truncated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error, "历史版本读取失败");
  }
}
