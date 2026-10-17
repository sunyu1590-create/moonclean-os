import { describe, expect, it } from "vitest";
import { mapCloudSnapshot, type CloudSnapshot } from "./mapper";
import { financialSummary } from "@/lib/finance";
const base: CloudSnapshot = {
  store: {
    id: "store-a",
    name: "A",
    platform: "pinduoduo",
    currency: "CNY",
    timezone: "Asia/Shanghai",
    sales_target: "1000",
    margin_alert: 12,
    created_at: "2026-10-01T00:00:00Z",
  },
  role: "owner",
  products: [
    {
      id: "product-a",
      name: "商品",
      category: "清洁",
      status: "active",
      created_at: "2026-10-01T00:00:00Z",
    },
  ],
  skus: [
    {
      id: "sku-a",
      product_id: "product-a",
      sku_name: "规格",
      sku_code: null,
      selling_price: "30.00",
      status: "active",
    },
  ],
  costs: [
    {
      id: "cost-1",
      sku_id: "sku-a",
      product_cost: "5.00",
      packaging_cost: "1.00",
      shipping_cost: "2.00",
      platform_fee: "1.00",
      effective_from: "2026-09-01",
      created_at: "2026-09-01T00:00:00Z",
    },
    {
      id: "cost-2",
      sku_id: "sku-a",
      product_cost: "8.00",
      packaging_cost: "1.00",
      shipping_cost: "2.00",
      platform_fee: "1.00",
      effective_from: "2026-10-15",
      created_at: "2026-10-15T00:00:00Z",
    },
  ],
  daily: [
    {
      id: "d1",
      metric_date: "2026-10-10",
      gross_sales: "30.00",
      refunds: "0.00",
      order_count: 1,
      other_expenses: "0.00",
      product_cost: null,
      packaging_cost: null,
      shipping_cost: null,
      platform_fee: null,
      cost_source: "sku",
    },
    {
      id: "d2",
      metric_date: "2026-10-16",
      gross_sales: "30.00",
      refunds: "0.00",
      order_count: 1,
      other_expenses: "0.00",
      product_cost: null,
      packaging_cost: null,
      shipping_cost: null,
      platform_fee: null,
      cost_source: "sku",
    },
  ],
  ads: [],
  skuDaily: [
    {
      id: "line-1",
      sku_id: "sku-a",
      metric_date: "2026-10-10",
      quantity_sold: 1,
      gross_sales: "30.00",
    },
    {
      id: "line-2",
      sku_id: "sku-a",
      metric_date: "2026-10-16",
      quantity_sold: 1,
      gross_sales: "30.00",
    },
  ],
  productSales: [],
};
describe("云端财务映射", () => {
  it("按销售日期匹配历史 SKU 成本且不重复计入汇总成本", () => {
    const data = mapCloudSnapshot(base);
    expect(data.daily[0].productCost).toBe("5.00");
    expect(data.daily[1].productCost).toBe("8.00");
    expect(data.daily[0].productSales["product-a"]).toBe("30.00");
    expect(financialSummary(data.daily, []).productCost).toBe("13.00");
  });
  it("缺少生效成本时标记数据不完整", () => {
    const data = mapCloudSnapshot({ ...base, costs: [] });
    expect(data.daily[0].costComplete).toBe(false);
    expect(financialSummary(data.daily, []).breakEvenRoas).toBeNull();
  });
});
