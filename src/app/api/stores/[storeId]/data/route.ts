import { NextResponse } from "next/server";
import { requireStore, apiError } from "@/lib/supabase/auth";
import { mapCloudSnapshot, type CloudSnapshot } from "@/lib/supabase/mapper";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const auth = await requireStore(storeId);
  if (!auth.ok) return auth.error;
  try {
    const { data: store, error: storeError } = await auth.supabase
      .from("stores")
      .select(
        "id,name,platform,currency,timezone,sales_target,margin_alert,created_at",
      )
      .eq("id", storeId)
      .single();
    if (storeError) throw storeError;
    const names = [
      "products",
      "skus",
      "sku_costs",
      "daily_metrics",
      "ad_metrics",
      "sku_daily_metrics",
      "product_daily_sales",
    ] as const;
    const results = await Promise.all(
      names.map(async (name) => {
        const rows: unknown[] = [];
        let start = 0;
        const size = 500;
        for (;;) {
          const { data, error } = await auth.supabase
            .from(name)
            .select("*")
            .eq("store_id", storeId)
            .range(start, start + size - 1);
          if (error) throw error;
          rows.push(...(data || []));
          if (!data || data.length < size) break;
          start += size;
        }
        return rows;
      }),
    );
    const snapshot = {
      store,
      role: auth.role,
      products: results[0],
      skus: results[1],
      costs: results[2],
      daily: results[3],
      ads: results[4],
      skuDaily: results[5],
      productSales: results[6],
    } as CloudSnapshot;
    return NextResponse.json(mapCloudSnapshot(snapshot), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error, "数据加载失败");
  }
}
