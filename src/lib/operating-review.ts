import { periodRows } from "@/lib/analytics";
import type { DailyMetric } from "@/lib/model";

export type Comparison = {
  delta: number;
  percent: number | null;
};

export function previousPeriodEnd(baseDate: string, days: 7 | 30) {
  const currentStart = new Date(`${baseDate}T12:00:00Z`);
  currentStart.setUTCDate(currentStart.getUTCDate() - (days - 1));
  currentStart.setUTCDate(currentStart.getUTCDate() - 1);
  return currentStart.toISOString().slice(0, 10);
}

export function compareValues(current: number, previous: number): Comparison {
  return {
    delta: current - previous,
    percent: previous <= 0 ? null : ((current - previous) / previous) * 100,
  };
}

export function dailySourceGroup(row: DailyMetric) {
  if (row.source === "official_pinduoduo") return "official" as const;
  if (row.source === "mock_pinduoduo" || row.isDemo) return "demo" as const;
  if (row.source === "csv_import" || row.source === "image_import") return "imported" as const;
  if (!row.source || row.source === "manual") return "manual" as const;
  return "other" as const;
}

export function dailySourceLabel(row: DailyMetric) {
  switch (dailySourceGroup(row)) {
    case "official": return "拼多多正式同步";
    case "demo": return "模拟数据";
    case "imported": return row.source === "image_import" ? "截图识别" : "CSV 导入";
    case "manual": return "手工录入";
    default: return "其他来源";
  }
}

export function isDailyCostComplete(row: DailyMetric) {
  return row.costComplete !== false && [
    row.productCost, row.packagingCost, row.logisticsCost, row.platformFees, row.otherExpenses,
  ].every(value => value !== "");
}

export function summarizeDataQuality(daily: DailyMetric[], baseDate: string, days: 7 | 30 = 30) {
  const rows = periodRows(daily, days, baseDate);
  const expectedStart = new Date(`${baseDate}T12:00:00Z`);
  expectedStart.setUTCDate(expectedStart.getUTCDate() - (days - 1));
  const sourceCounts = { manual: 0, imported: 0, demo: 0, official: 0, other: 0 };
  for (const row of rows) sourceCounts[dailySourceGroup(row)] += 1;
  const completeCost = rows.filter(isDailyCostComplete).length;
  const productAllocated = rows.filter(row => Object.values(row.productSales || {}).some(value => Number(value) > 0)).length;
  return {
    rows,
    startDate: expectedStart.toISOString().slice(0, 10),
    endDate: baseDate,
    coveredDays: new Set(rows.map(row => row.date)).size,
    completeCostRecords: completeCost,
    incompleteCostRecords: rows.length - completeCost,
    productAllocatedRecords: productAllocated,
    sourceCounts,
    hasDemo: sourceCounts.demo > 0,
  };
}
