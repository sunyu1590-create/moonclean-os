import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStore, apiError, rejectCrossOriginMutation } from "@/lib/supabase/auth";
import {
  productSchema,
  dailySchema,
  advertisingSchema,
} from "@/lib/repository";
const payloadSchema = z.object({
  version: z.number().int().min(0).max(1),
  products: z.array(productSchema).max(1000),
  daily: z.array(dailySchema).max(5000),
  advertising: z.array(advertisingSchema).max(5000),
});
type Result = {
  kind: "product" | "daily" | "advertising";
  sourceId: string;
  status: "success" | "skipped" | "failed";
  message?: string;
};
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const auth = await requireStore(storeId, ["owner", "admin", "editor"]);
  if (!auth.ok) return auth.error;
  const { data, error } = await auth.supabase
    .from("migration_records")
    .select("source_kind,source_id")
    .eq("store_id", storeId);
  if (error) return apiError(error);
  return NextResponse.json({ records: data || [] });
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const crossOrigin=rejectCrossOriginMutation(request);if(crossOrigin)return crossOrigin;
  const { storeId } = await params;
  const auth = await requireStore(storeId, ["owner", "admin", "editor"]);
  if (!auth.ok) return auth.error;
  try {
    const raw = await request.text();
    if (raw.length > 2_000_000)
      return NextResponse.json(
        { error: "数据文件过大，请分批导入" },
        { status: 413 },
      );
    const input = payloadSchema.parse(JSON.parse(raw));
    const results: Result[] = [];
    const kinds = [
      {
        kind: "product" as const,
        items: input.products,
        fn: "import_legacy_product" as const,
        key: "p_product" as const,
      },
      {
        kind: "daily" as const,
        items: input.daily,
        fn: "import_legacy_daily" as const,
        key: "p_row" as const,
      },
      {
        kind: "advertising" as const,
        items: input.advertising,
        fn: "import_legacy_ad" as const,
        key: "p_row" as const,
      },
    ];
    const { data: existing, error: existingError } = await auth.supabase
      .from("migration_records")
      .select("source_kind,source_id")
      .eq("store_id", storeId);
    if (existingError) throw existingError;
    const seen = new Set(
      (existing || []).map((r) => `${r.source_kind}:${r.source_id}`),
    );
    for (const group of kinds) {
      for (const item of group.items) {
        const sourceId = item.id;
        const key = `${group.kind}:${sourceId}`;
        if (seen.has(key)) {
          results.push({
            kind: group.kind,
            sourceId,
            status: "skipped",
            message: "此前已导入",
          });
          continue;
        }
        const args = {
          p_store: storeId,
          p_source_id: sourceId,
          [group.key]: item,
        };
        const { error } = await auth.supabase.rpc(group.fn, args);
        if (error) {
          results.push({
            kind: group.kind,
            sourceId,
            status: "failed",
            message: error.message,
          });
        } else {
          seen.add(key);
          results.push({ kind: group.kind, sourceId, status: "success" });
        }
      }
    }
    return NextResponse.json({
      results,
      summary: {
        success: results.filter((r) => r.status === "success").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        failed: results.filter((r) => r.status === "failed").length,
      },
    });
  } catch (error) {
    return apiError(error, "导入失败");
  }
}
