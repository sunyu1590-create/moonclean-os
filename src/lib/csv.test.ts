import { describe, expect, it } from "vitest";
import { exportDailyCsv, parseDailyCsv } from "./csv";
import type { DailyMetric } from "./model";
const row: DailyMetric = {
  id: "d1",
  date: "2026-10-17",
  sales: "100.10",
  refunds: "0.10",
  orders: 3,
  productCost: "30.10",
  packagingCost: "5.20",
  logisticsCost: "10.10",
  platformFees: "4.10",
  otherExpenses: "2.10",
  productSales: { p1: "55.20" },
  reportDetails: { buyers: 2, averageOrderValue: "33.37", visitors: 48, conversionRate: "4.17", refundOrders: 1, visitorValue: "0.28" },
};
describe("每日数据 CSV", () => {
  it("导出后可以导入并保留商品销售额", () => {
    const result = parseDailyCsv(exportDailyCsv([row]), []);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].productSales.p1).toBe("55.20");
    expect(result.rows[0].reportDetails).toEqual(row.reportDetails);
  });
  it("标记已有日期和文件内重复日期", () => {
    const result = parseDailyCsv(exportDailyCsv([row, row]), [row]);
    expect(result.duplicates).toEqual([row.date]);
    expect(result.errors.some((e) => e.includes("重复"))).toBe(true);
  });
});
