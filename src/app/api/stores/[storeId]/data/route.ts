import { NextResponse } from "next/server";
import { requireStore, apiError } from "@/lib/supabase/auth";
import { mapCloudSnapshot, type CloudSnapshot } from "@/lib/supabase/mapper";
import { mergeExternalDaily, type ExternalCostContext } from "@/services/external-finance";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const auth = await requireStore(storeId);
  if (!auth.ok) return auth.error;
  const supabase = auth.supabase;
  try {
    async function loadRows<T>(table: string, columns: string): Promise<T[]> {
      const rows: T[] = [];
      const size = 500;
      for (let start = 0; ; start += size) {
        const { data, error } = await supabase
          .from(table)
          .select(columns)
          .eq("store_id", storeId)
          .order("id", { ascending: true })
          .range(start, start + size - 1);
        if (error) throw error;
        rows.push(...((data || []) as T[]));
        if (!data || data.length < size) break;
      }
      return rows;
    }
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
    const results = await Promise.all(names.map((name) => loadRows(name, "*")));
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
      loadRows<Parameters<typeof mergeExternalDaily>[1][number]>("external_orders", "id,connection_id,placed_at,gross_sales,status,is_demo"),
      loadRows<Parameters<typeof mergeExternalDaily>[2][number]>("external_refunds", "id,order_id,amount,status"),
      loadRows<{ id:string; name:string; is_demo:boolean }>("external_products", "id,name,is_demo"),
      loadRows<ExternalCostContext["externalSkus"][number] & {product_id:string;name:string;sku_code:string|null;selling_price:string}>("external_skus", "id,connection_id,external_id,product_id,name,sku_code,selling_price"),
      loadRows<ExternalCostContext["mappings"][number]>("platform_sku_mappings", "id,external_sku_id,sku_id"),
      loadRows<ExternalCostContext["items"][number]>("external_order_items", "id,order_id,external_sku_id,quantity,gross_sales"),
    ]);
    const result = mapCloudSnapshot(snapshot);
    result.daily = mergeExternalDaily(result.daily, orders, refunds, store.timezone,{
      items:externalItems,externalSkus,mappings,
      internalSkus:snapshot.skus,costs:snapshot.costs,
    });
    const skusByProduct = new Map<string, typeof externalSkus>();
    for (const sku of externalSkus) {
      const group = skusByProduct.get(sku.product_id) || [];
      group.push(sku);
      skusByProduct.set(sku.product_id, group);
    }
    const mappedSkuIds = new Map(mappings.map(mapping => [mapping.external_sku_id, mapping.sku_id]));
    result.externalCatalog = externalProducts.map(product => ({
      id:product.id,name:product.name,isDemo:product.is_demo,
      skus:(skusByProduct.get(product.id) || []).map(sku=>({
        id:sku.id,name:sku.name,code:sku.sku_code,price:sku.selling_price,
        mappedSkuId:mappedSkuIds.get(sku.id) || null,
      })),
    }));
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error, "数据加载失败");
  }
}
