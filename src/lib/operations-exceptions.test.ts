import { describe, expect, it } from "vitest";
import type { AppData } from "@/lib/model";
import type { InventoryBalance, OperationTask } from "@/lib/operations";
import { buildOperationExceptions, operationExceptionCounts } from "@/lib/operations-exceptions";

const today = "2026-10-21";
const data = (costComplete = true): AppData => ({
  version: 1,
  products: [{ id: "product-1", name: "洗衣液", category: "清洁", createdAt: today, skus: [{ id: "sku-1", name: "家庭装", price: "30", cost: { production: "20", packaging: "1", logistics: "2", platform: "1" } }] }],
  daily: [{ id: "daily-1", date: today, sales: "100", refunds: "10", orders: 2, productCost: "80", packagingCost: "5", logisticsCost: "5", platformFees: "5", otherExpenses: "0", productSales: {}, costComplete }],
  advertising: [], skuDaily: [], tasks: [], inventory: [], inventoryMovements: [],
  settings: { store: { id: "store-1", name: "测试店铺", platform: "other", currency: "CNY", createdAt: today, timezone: "Asia/Shanghai" }, salesTarget: "10000", marginAlert: 10, role: "owner" },
});

describe("经营异常中心规则", () => {
  it("按依据识别负利润、零库存和逾期待办并按风险排序", () => {
    const inventory: InventoryBalance[] = [{ sku_id: "sku-1", quantity: 0, low_stock_threshold: 5, updated_at: `${today}T00:00:00Z` }];
    const tasks: OperationTask[] = [{ id: "task-1", title: "补货跟进", detail: "", priority: "high", status: "todo", due_date: "2026-10-20", created_at: today, updated_at: today }];
    const issues = buildOperationExceptions(data(), inventory, tasks, today);
    expect(issues[0].severity).toBe("critical");
    expect(issues.map((item) => item.key)).toEqual(expect.arrayContaining(["negative_profit", "low_stock", "overdue_tasks"]));
    expect(operationExceptionCounts(issues, data(), inventory, tasks, today).zeroStockCount).toBe(1);
  });

  it("成本不完整时标记数据质量，不把利润估算为负数风险", () => {
    const issues = buildOperationExceptions(data(false), [], [], today);
    expect(issues.map((item) => item.key)).toContain("cost_incomplete");
    expect(issues.map((item) => item.key)).not.toContain("negative_profit");
  });

  it("没有今日日报时提示补录，但只按已知数据给出结论", () => {
    const snapshot = data(); snapshot.daily = [];
    expect(buildOperationExceptions(snapshot, [], [], today).map((item) => item.key)).toContain("today_data_missing");
  });

  it("未登记库存时提示数据未知，不把 SKU 当作零库存", () => {
    const issue = buildOperationExceptions(data(), [], [], today).find((item) => item.key === "inventory_untracked");
    expect(issue?.evidence).toContain("不会被当作零库存");
    expect(buildOperationExceptions(data(), [], [], today).map((item) => item.key)).not.toContain("low_stock");
  });
});
