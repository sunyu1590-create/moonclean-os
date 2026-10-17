import Papa from "papaparse";
import type { DailyMetric } from "./model";
import { dailySchema } from "./repository";
export const csvColumns = [
  "date",
  "sales",
  "refunds",
  "orders",
  "productCost",
  "packagingCost",
  "logisticsCost",
  "platformFees",
  "otherExpenses",
  "productSales",
] as const;
export function exportDailyCsv(rows: DailyMetric[]) {
  return (
    "\uFEFF" +
    Papa.unparse(
      rows.map((row) => ({
        ...Object.fromEntries(
          csvColumns.map((key) => [
            key,
            key === "productSales"
              ? JSON.stringify(row.productSales)
              : row[key],
          ]),
        ),
      })),
      { columns: [...csvColumns] },
    )
  );
}
export function parseDailyCsv(text: string, existing: DailyMetric[]) {
  const parsed = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    { header: true, skipEmptyLines: true },
  );
  const errors: string[] = [];
  const seen = new Set<string>();
  const rows: DailyMetric[] = [];
  parsed.data.forEach((item, index) => {
    try {
      const productSales = item.productSales
        ? JSON.parse(item.productSales)
        : {};
      const candidate = {
        id: `d-${item.date}`,
        date: item.date,
        sales: item.sales,
        refunds: item.refunds,
        orders: Number(item.orders),
        productCost: item.productCost,
        packagingCost: item.packagingCost,
        logisticsCost: item.logisticsCost,
        platformFees: item.platformFees,
        otherExpenses: item.otherExpenses,
        productSales,
      };
      const result = dailySchema.safeParse(candidate);
      if (!result.success) {
        errors.push(
          `第 ${index + 2} 行：${result.error.issues.map((issue) => issue.message).join("、")}`,
        );
        return;
      }
      if (seen.has(candidate.date)) {
        errors.push(`第 ${index + 2} 行：文件内日期 ${candidate.date} 重复`);
        return;
      }
      seen.add(candidate.date);
      rows.push(result.data);
    } catch {
      errors.push(`第 ${index + 2} 行：商品销售数据不是有效 JSON`);
    }
  });
  parsed.errors.forEach((err) => errors.push(`CSV 解析错误：${err.message}`));
  const duplicates = rows
    .filter((row) => existing.some((item) => item.date === row.date))
    .map((row) => row.date);
  return { rows, errors, duplicates };
}
