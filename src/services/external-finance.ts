import Decimal from "decimal.js";
import type { DailyMetric } from "@/lib/model";

type Order = { id: string; connection_id?: string; placed_at: string; gross_sales: string; status: string; is_demo: boolean };
type Refund = { order_id: string; amount: string; status: string };
export type ExternalCostContext = {
  items: { order_id: string; external_sku_id: string; quantity: number; gross_sales: string }[];
  externalSkus: { id: string; connection_id?: string; external_id: string }[];
  mappings: { external_sku_id: string; sku_id: string }[];
  internalSkus: { id: string; product_id: string }[];
  costs: { id: string; sku_id: string; product_cost: string; packaging_cost: string; shipping_cost: string; platform_fee: string; effective_from: string; created_at: string }[];
};
const money = (value: Decimal) => value.toDecimalPlaces(2).toFixed(2);
export function mergeExternalDaily(
  manual: DailyMetric[], orders: Order[], refunds: Refund[], timezone: string,
  context?: ExternalCostContext,
): DailyMetric[] {
  const occupied = new Set(manual.map((r) => r.date));
  const refundByOrder = new Map<string, Decimal>();
  for (const refund of refunds) if (refund.status === "succeeded")
    refundByOrder.set(refund.order_id, (refundByOrder.get(refund.order_id) || new Decimal(0)).plus(refund.amount));
  const grouped = new Map<string, { gross: Decimal; refund: Decimal; orders: number; demo: boolean; costs: Decimal[]; complete: boolean; productSales: Record<string,string> }>();
  const itemsByOrder = new Map<string,ExternalCostContext["items"]>();
  for(const item of context?.items || []) itemsByOrder.set(item.order_id,[...(itemsByOrder.get(item.order_id)||[]),item]);
  const externalSkuId = new Map(context?.externalSkus.map(sku=>[`${sku.connection_id||""}:${sku.external_id}`,sku.id])||[]);
  const skuId = new Map(context?.mappings.map(mapping=>[mapping.external_sku_id,mapping.sku_id])||[]);
  const productId = new Map(context?.internalSkus.map(sku=>[sku.id,sku.product_id])||[]);
  for (const order of orders) {
    if (!["paid","shipped","completed","refunded"].includes(order.status)) continue;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(order.placed_at));
    if (occupied.has(date)) continue; // Manual or CSV daily total is authoritative for this date.
    const row = grouped.get(date) || { gross: new Decimal(0), refund: new Decimal(0), orders: 0, demo: false, costs:[new Decimal(0),new Decimal(0),new Decimal(0),new Decimal(0)], complete:true, productSales:{} };
    row.gross = row.gross.plus(order.gross_sales);
    row.refund = row.refund.plus(refundByOrder.get(order.id) || 0);
    row.orders++;
    row.demo ||= order.is_demo;
    const lines=itemsByOrder.get(order.id)||[];
    if(!lines.length || !lines.reduce((sum,line)=>sum.plus(line.gross_sales),new Decimal(0)).eq(order.gross_sales)) row.complete=false;
    for(const line of lines){
      const internalSku=skuId.get(externalSkuId.get(`${order.connection_id||""}:${line.external_sku_id}`)||"");
      const cost=internalSku && context?.costs.filter(c=>c.sku_id===internalSku && c.effective_from<=date)
        .sort((a,b)=>b.effective_from.localeCompare(a.effective_from)||b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))[0];
      if(!internalSku || !cost){row.complete=false;continue;}
      [cost.product_cost,cost.packaging_cost,cost.shipping_cost,cost.platform_fee].forEach((value,i)=>{
        row.costs[i]=row.costs[i].plus(new Decimal(value).mul(line.quantity));
      });
      const product=productId.get(internalSku);
      if(product)row.productSales[product]=money(new Decimal(row.productSales[product]||0).plus(line.gross_sales));
    }
    grouped.set(date, row);
  }
  return [...manual, ...[...grouped.entries()].map(([date, row]) => ({
    id: `external-${date}`, date, sales: money(row.gross),
    refunds: money(Decimal.min(row.refund,row.gross)), orders: row.orders,
    productCost: money(row.costs[0]), packagingCost: money(row.costs[1]), logisticsCost: money(row.costs[2]),
    platformFees: money(row.costs[3]), otherExpenses: "0.00", productSales: row.productSales,
    costComplete: row.complete, costSource: "sku" as const,
    source: "mock_pinduoduo" as const, isDemo: row.demo,
  }))].sort((a,b) => a.date.localeCompare(b.date));
}
