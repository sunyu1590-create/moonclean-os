import { NextResponse } from "next/server";
import { requireStore, apiError } from "@/lib/supabase/auth";
import { mapCloudSnapshot, type CloudSnapshot } from "@/lib/supabase/mapper";
import { mergeExternalDaily } from "@/services/external-finance";
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
    const [orders, refunds, externalProducts, externalSkus, mappings, externalItems] = await Promise.all([
      auth.supabase.from("external_orders").select("id,connection_id,placed_at,gross_sales,status,is_demo").eq("store_id",storeId),
      auth.supabase.from("external_refunds").select("order_id,amount,status").eq("store_id",storeId),
      auth.supabase.from("external_products").select("id,name,is_demo").eq("store_id",storeId),
      auth.supabase.from("external_skus").select("id,connection_id,external_id,product_id,name,sku_code,selling_price").eq("store_id",storeId),
      auth.supabase.from("platform_sku_mappings").select("external_sku_id,sku_id").eq("store_id",storeId),
      auth.supabase.from("external_order_items").select("order_id,external_sku_id,quantity,gross_sales").eq("store_id",storeId),
    ]);
    for (const response of [orders,refunds,externalProducts,externalSkus,mappings,externalItems]) if(response.error) throw response.error;
    const result = mapCloudSnapshot(snapshot);
    result.daily = mergeExternalDaily(result.daily, orders.data || [], refunds.data || [], store.timezone,{
      items:externalItems.data||[],externalSkus:externalSkus.data||[],mappings:mappings.data||[],
      internalSkus:snapshot.skus,costs:snapshot.costs,
    });
    result.externalCatalog = (externalProducts.data || []).map(product => ({
      id:product.id,name:product.name,isDemo:product.is_demo,
      skus:(externalSkus.data || []).filter(sku=>sku.product_id===product.id).map(sku=>({
        id:sku.id,name:sku.name,code:sku.sku_code,price:sku.selling_price,
        mappedSkuId:(mappings.data || []).find(map=>map.external_sku_id===sku.id)?.sku_id || null,
      })),
    }));
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error, "数据加载失败");
  }
}
