import { describe, expect, it } from "vitest";
import type { AdvertisingMetric, DailyMetric } from "./model";
import { advertisingReportMetrics } from "./advertising-report";

const ad = (overrides: Partial<AdvertisingMetric> = {}): AdvertisingMetric => ({
  id: "ad-1", date: "2026-10-21", spend: "10.00", attributedSales: "30.00",
  netAttributedSales: "24.00", attributedOrders: 2, ...overrides,
});
const daily: DailyMetric[] = [{
  id: "day-1", date: "2026-10-21", sales: "100.00", refunds: "20.00", orders: 5,
  productCost: "0", packagingCost: "0", logisticsCost: "0", platformFees: "0",
  otherExpenses: "0", productSales: {},
}];

describe("advertising report metrics", () => {
  it("calculates template ROAS, net order cost, and net revenue share from source values", () => {
    expect(advertisingReportMetrics([ad()], daily)).toMatchObject({
      spend: 10, attributedSales: 30, actualRoas: 3, netAttributedSales: 24,
      netActualRoas: 2.4, netAttributedOrders: 2, spendPerNetOrder: 5,
      netRevenueShare: 30,
    });
  });

  it("keeps net metrics unknown for legacy rows without net attribution", () => {
    expect(advertisingReportMetrics([ad({ netAttributedSales: undefined })], daily)).toMatchObject({
      netAttributedSales: null, netActualRoas: null, netRevenueShare: null,
    });
  });
});
