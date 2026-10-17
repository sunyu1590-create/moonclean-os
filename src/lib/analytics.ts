import type { AdvertisingMetric, DailyMetric } from "./model";
import { financialSummary } from "./finance";
export function storeToday(zone = "Asia/Shanghai") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (part: string) => parts.find((p) => p.type === part)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function periodRows<T extends { date: string }>(
  rows: T[],
  days: 7 | 30,
  base = storeToday(),
) {
  const cutoff = new Date(`${base}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  const start = cutoff.toISOString().slice(0, 10);
  return rows
    .filter((row) => row.date >= start && row.date <= base)
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function trend(daily: DailyMetric[], ads: AdvertisingMetric[]) {
  return daily.map((row) => {
    const summary = financialSummary(
      [row],
      ads.filter((ad) => ad.date === row.date),
    );
    return {
      date: row.date.slice(5).replace("-", "/"),
      sales: Number(summary.netSales),
      profit: Number(summary.profit),
      spend: Number(summary.adSpend),
      roas: summary.roas,
    };
  });
}
export const numeric = (value: number | null, suffix = "") =>
  value === null ? "—" : `${value.toFixed(2)}${suffix}`;
