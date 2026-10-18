import Decimal from "decimal.js";
import type { AppData, StoreRole } from "@/lib/model";
import { DATA_VERSION } from "@/lib/model";
import { storeToday } from "@/lib/analytics";

export interface CloudSnapshot {
  store: {
    id: string;
    name: string;
    platform: "pinduoduo" | "douyin" | "other";
    currency: "CNY" | "USD";
    timezone: string;
    sales_target: string;
    margin_alert: number;
    created_at: string;
  };
  role: StoreRole;
  products: {
    id: string;
    name: string;
    category: string;
    status: string;
    is_demo?: boolean;
    created_at: string;
  }[];
  skus: {
    id: string;
    product_id: string;
    sku_name: string;
    sku_code: string | null;
    selling_price: string;
    status: string;
  }[];
  costs: {
    id: string;
    sku_id: string;
    product_cost: string;
    packaging_cost: string;
    shipping_cost: string;
    platform_fee: string;
    effective_from: string;
    created_at: string;
  }[];
  daily: {
    id: string;
    metric_date: string;
    gross_sales: string;
    refunds: string;
    order_count: number;
    other_expenses: string;
    product_cost: string | null;
    packaging_cost: string | null;
    shipping_cost: string | null;
    platform_fee: string | null;
    cost_source: "manual" | "sku";
    data_source?: "manual" | "csv_import";
    is_demo?: boolean;
  }[];
  ads: {
    id: string;
    metric_date: string;
    advertising_spend: string;
    attributed_revenue: string;
    attributed_orders: number;
    is_demo?: boolean;
    data_source?: "manual" | "csv_import";
  }[];
  skuDaily: {
    id: string;
    sku_id: string;
    metric_date: string;
    quantity_sold: number;
    gross_sales: string;
    refund_amount?: string;
  }[];
  productSales: {
    product_id: string;
    metric_date: string;
    gross_sales: string;
  }[];
}
const amount = (value: string | null | undefined) =>
  new Decimal(value || 0).toFixed(2);
export function costForDate(
  costs: CloudSnapshot["costs"],
  skuId: string,
  date: string,
) {
  return costs
    .filter((c) => c.sku_id === skuId && c.effective_from <= date)
    .sort(
      (a, b) =>
        b.effective_from.localeCompare(a.effective_from) ||
        b.created_at.localeCompare(a.created_at) ||
        b.id.localeCompare(a.id),
    )[0];
}
export function mapCloudSnapshot(snapshot: CloudSnapshot): AppData {
  const {
    store,
    role,
    products,
    skus,
    costs,
    daily,
    ads,
    skuDaily,
    productSales,
  } = snapshot;
  const today = storeToday(store.timezone || "Asia/Shanghai");
  const skuProduct = new Map(skus.map((s) => [s.id, s.product_id]));
  const productSalesByDate = new Map<string, Record<string, string>>();
  const allocated = new Set(
    productSales.map((row) => `${row.metric_date}:${row.product_id}`),
  );
  for (const row of productSales) {
    const map = productSalesByDate.get(row.metric_date) || {};
    map[row.product_id] = amount(row.gross_sales);
    productSalesByDate.set(row.metric_date, map);
  }
  for (const row of skuDaily) {
    const productId = skuProduct.get(row.sku_id);
    if (!productId) continue;
    const map = productSalesByDate.get(row.metric_date) || {};
    if (!allocated.has(`${row.metric_date}:${productId}`))
      map[productId] = new Decimal(map[productId] || 0)
        .plus(row.gross_sales)
        .toFixed(2);
    productSalesByDate.set(row.metric_date, map);
  }
  return {
    version: DATA_VERSION,
    settings: {
      store: {
        id: store.id,
        name: store.name,
        platform: store.platform,
        currency: store.currency,
        timezone: store.timezone,
        createdAt: store.created_at,
      },
      salesTarget: amount(store.sales_target),
      marginAlert: Number(store.margin_alert),
      role,
    },
    products: products
      .filter((p) => p.status === "active")
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        createdAt: p.created_at,
        isDemo: p.is_demo || false,
        skus: skus
          .filter((s) => s.product_id === p.id && s.status === "active")
          .map((s) => {
            const cost = costForDate(costs, s.id, today);
            return {
              id: s.id,
              name: s.sku_name,
              code: s.sku_code || "",
              price: amount(s.selling_price),
              costComplete: !!cost,
              costHistory: costs.filter(c => c.sku_id === s.id).sort((a,b) => b.effective_from.localeCompare(a.effective_from) || b.created_at.localeCompare(a.created_at)).map(c => ({effectiveFrom:c.effective_from,cost:{production:amount(c.product_cost),packaging:amount(c.packaging_cost),logistics:amount(c.shipping_cost),platform:amount(c.platform_fee)}})),
              cost: {
                production: amount(cost?.product_cost),
                packaging: amount(cost?.packaging_cost),
                logistics: amount(cost?.shipping_cost),
                platform: amount(cost?.platform_fee),
              },
            };
          }),
      })),
    daily: daily.map((row) => {
      let productCost = row.product_cost,
        packagingCost = row.packaging_cost,
        logisticsCost = row.shipping_cost,
        platformFees = row.platform_fee;
      let complete = [
        productCost,
        packagingCost,
        logisticsCost,
        platformFees,
      ].every((v) => v !== null);
      if (row.cost_source === "sku") {
        const lines = skuDaily.filter(
          (line) => line.metric_date === row.metric_date,
        );
        complete = (lines.length > 0 || Number(row.gross_sales) === 0) && lines.reduce((sum,line)=>sum.plus(line.gross_sales),new Decimal(0)).eq(row.gross_sales);
        const totals = [
          new Decimal(0),
          new Decimal(0),
          new Decimal(0),
          new Decimal(0),
        ];
        for (const line of lines) {
          const cost = costForDate(costs, line.sku_id, row.metric_date);
          if (!cost) {
            complete = false;
            continue;
          }
          const q = new Decimal(line.quantity_sold);
          [
            cost.product_cost,
            cost.packaging_cost,
            cost.shipping_cost,
            cost.platform_fee,
          ].forEach((v, i) => {
            totals[i] = totals[i].plus(q.mul(v));
          });
        }
        [productCost, packagingCost, logisticsCost, platformFees] = totals.map(
          (v) => v.toFixed(2),
        );
      }
      return {
        id: row.id,
        date: row.metric_date,
        sales: amount(row.gross_sales),
        refunds: amount(row.refunds),
        orders: row.order_count,
        otherExpenses: amount(row.other_expenses),
        productCost: amount(productCost),
        packagingCost: amount(packagingCost),
        logisticsCost: amount(logisticsCost),
        platformFees: amount(platformFees),
        productSales: productSalesByDate.get(row.metric_date) || {},
        costComplete: complete,
        costSource: row.cost_source,
        source: row.data_source || "manual",
        isDemo: row.is_demo || false,
      };
    }),
    skuDaily: skuDaily.map(row => ({id:row.id,skuId:row.sku_id,date:row.metric_date,quantitySold:row.quantity_sold,grossSales:amount(row.gross_sales),refundAmount:amount(row.refund_amount)})),
    advertising: ads.map((row) => ({
      id: row.id,
      date: row.metric_date,
      spend: amount(row.advertising_spend),
      attributedSales: amount(row.attributed_revenue),
      attributedOrders: row.attributed_orders,
      isDemo: row.is_demo || false,
      source: row.data_source || "manual",
    })),
  };
}
