import { describe, expect, it } from "vitest";
import type { AdvertisingMetric, DailyMetric } from "@/lib/model";
import { recommendationBaseline, weeklyReportInsights } from "./report-insights";

function daily(overrides: Partial<DailyMetric> = {}): DailyMetric {
  return {
    id: "daily-1", date: "2026-10-18", sales: "100", refunds: "2", orders: 5,
    productCost: "20", packagingCost: "1", logisticsCost: "2", platformFees: "3",
    otherExpenses: "0", productSales: {}, costComplete: true,
    ...overrides,
  };
}

function ad(overrides: Partial<AdvertisingMetric> = {}): AdvertisingMetric {
  return { id: "ad-1", date: "2026-10-18", spend: "10", attributedSales: "50", ...overrides };
}

describe("weeklyReportInsights", () => {
  it("asks for reports when the selected week has no data", () => {
    expect(weeklyReportInsights([], [])).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "数据准备", tone: "blue" }),
    ]));
  });

  it("flags incomplete costs and does not claim a break-even decision", () => {
    const insights = weeklyReportInsights([daily({ productCost: "", costComplete: false })], [ad()]);
    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "利润质量", title: "成本数据不完整，利润只能参考" }),
      expect.objectContaining({ category: "推广效率", title: expect.stringContaining("保本线暂不可算") }),
    ]));
  });

  it("uses ad-attributed ROAS and recommends gradual scaling when above break-even", () => {
    const insights = weeklyReportInsights([daily()], [ad()]);
    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "利润表现" }),
      expect.objectContaining({ category: "推广效率", title: expect.stringContaining("高于估算保本线") }),
    ]));
  });

  it("assigns stable follow-up keys and captures the recommendation baseline", () => {
    const insights = weeklyReportInsights([daily()], [ad()]);
    expect(insights.every((insight) => /^[a-z0-9_-]+$/.test(insight.key))).toBe(true);
    expect(recommendationBaseline([daily()], [ad()], "2026-10-18")).toEqual({
      captured_at: "2026-10-18",
      coverage_days: 1,
      net_sales: "98.00",
      profit: "62.00",
      roas: 5,
      refund_rate: 2,
    });
  });

  it("identifies rising refunds and a falling sales trend", () => {
    const rows = Array.from({ length: 7 }, (_, index) => daily({
      id: `day-${index}`, date: `2026-10-${String(12 + index).padStart(2, "0")}`,
      sales: index < 4 ? "100" : "60", refunds: "8", costComplete: true,
    }));
    const insights = weeklyReportInsights(rows, []);
    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "退款关注" }),
      expect.objectContaining({ category: "销售趋势", title: expect.stringContaining("下降") }),
    ]));
  });
});
