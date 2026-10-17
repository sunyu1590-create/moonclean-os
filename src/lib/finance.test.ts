import { describe, expect, it } from "vitest";
import { adRoas, financialSummary, skuContribution } from "./finance";
import type { AdvertisingMetric, DailyMetric, SKU } from "./model";
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
  productSales: {},
};
const ad: AdvertisingMetric = {
  id: "a1",
  date: row.date,
  spend: "10.10",
  attributedSales: "30.30",
};
describe("统一财务计算", () => {
  it("使用十进制精确计算利润与利润率", () => {
    const result = financialSummary([row], [ad]);
    expect(result.netSales).toBe("100.00");
    expect(result.totalCost).toBe("61.70");
    expect(result.profit).toBe("38.30");
    expect(result.margin).toBe(38.3);
  });
  it("广告 ROAS 只使用归因成交额", () => {
    expect(adRoas([ad])).toBe(3);
    expect(financialSummary([row], [ad]).roas).toBe(3);
  });
  it("没有广告消耗或完整成本时返回空值", () => {
    expect(financialSummary([row], []).roas).toBeNull();
    expect(
      financialSummary([{ ...row, productCost: "" }], [ad]).breakEvenRoas,
    ).toBeNull();
  });
  it("计算 SKU 单件贡献利润", () => {
    const sku: SKU = {
      id: "1",
      name: "测试",
      price: "39.90",
      cost: {
        production: "12.50",
        packaging: "2.20",
        logistics: "5.50",
        platform: "1.80",
      },
    };
    expect(skuContribution(sku)).toBe("17.90");
  });
});
