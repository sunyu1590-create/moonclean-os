import { describe, expect, it } from "vitest";
import { compareValues, dailySourceGroup, dailySourceLabel, previousPeriodEnd, summarizeDataQuality } from "@/lib/operating-review";
import type { DailyMetric } from "@/lib/model";

const row = (date: string, changes: Partial<DailyMetric> = {}): DailyMetric => ({
  id: date,
  date,
  sales: "100",
  refunds: "0",
  orders: 2,
  productCost: "30",
  packagingCost: "2",
  logisticsCost: "5",
  platformFees: "3",
  otherExpenses: "0",
  productSales: { product: "100" },
  source: "manual",
  ...changes,
});

describe("operating review", () => {
  it("finds the day before an equal-length comparison window", () => {
    expect(previousPeriodEnd("2026-03-01", 7)).toBe("2026-02-22");
    expect(previousPeriodEnd("2026-01-01", 30)).toBe("2025-12-02");
  });

  it("does not publish growth percentages for non-positive baselines", () => {
    expect(compareValues(30, -20)).toEqual({ delta: 50, percent: null });
    expect(compareValues(15, 0)).toEqual({ delta: 15, percent: null });
    expect(compareValues(15, 10)).toEqual({ delta: 5, percent: 50 });
  });

  it("labels official, demo and imported sources distinctly", () => {
    expect(dailySourceGroup(row("2026-01-01", { source: "official_pinduoduo" }))).toBe("official");
    expect(dailySourceLabel(row("2026-01-01", { source: "mock_pinduoduo" }))).toBe("模拟数据");
    expect(dailySourceLabel(row("2026-01-01", { source: "image_import" }))).toBe("截图识别");
  });

  it("summarizes 30-day coverage and data quality from existing records", () => {
    const summary = summarizeDataQuality([
      row("2026-01-03"),
      row("2026-01-03", { id: "demo", source: "mock_pinduoduo", isDemo: true, costComplete: false }),
      row("2026-01-02", { id: "incomplete", source: "csv_import", costComplete: false, productSales: {} }),
      row("2025-12-03"),
    ], "2026-01-03");
    expect(summary.coveredDays).toBe(2);
    expect(summary.completeCostRecords).toBe(1);
    expect(summary.incompleteCostRecords).toBe(2);
    expect(summary.productAllocatedRecords).toBe(2);
    expect(summary.sourceCounts).toEqual({ manual: 1, imported: 1, demo: 1, official: 0, other: 0 });
    expect(summary.hasDemo).toBe(true);
  });
});
