import { adRoas, addMoney, financialSummary } from "./finance";
import type { AdvertisingMetric, DailyMetric } from "./model";

export function advertisingReportMetrics(advertising: AdvertisingMetric[], daily: DailyMetric[]) {
  const spend = Number(addMoney(advertising.map((row) => row.spend)));
  const hasNetRevenue = advertising.length > 0 && advertising.every((row) => row.netAttributedSales !== undefined);
  const netAttributedSales = hasNetRevenue
    ? Number(addMoney(advertising.map((row) => row.netAttributedSales || "0")))
    : null;
  const hasNetOrders = advertising.length > 0 && advertising.every((row) => row.attributedOrders !== undefined);
  const netAttributedOrders = hasNetOrders
    ? advertising.reduce((total, row) => total + (row.attributedOrders || 0), 0)
    : null;
  const storeNetSales = Number(financialSummary(daily, []).netSales);

  return {
    spend,
    attributedSales: Number(addMoney(advertising.map((row) => row.attributedSales))),
    actualRoas: adRoas(advertising),
    netAttributedSales,
    netActualRoas: netAttributedSales !== null && spend > 0 ? Number((netAttributedSales / spend).toFixed(2)) : null,
    netAttributedOrders,
    spendPerNetOrder: netAttributedOrders !== null && netAttributedOrders > 0 ? Number((spend / netAttributedOrders).toFixed(2)) : null,
    netRevenueShare: netAttributedSales !== null && storeNetSales > 0 ? Number((netAttributedSales / storeNetSales * 100).toFixed(2)) : null,
  };
}
