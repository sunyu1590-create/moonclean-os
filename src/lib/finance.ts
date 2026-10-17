import Decimal from "decimal.js";
import type {
  AdvertisingMetric,
  DailyMetric,
  FinancialSummary,
  Money,
  SKU,
} from "./model";
const D = (value: Money | number = "0") => new Decimal(value || 0);
const sum = (items: (Money | number)[]) =>
  items.reduce<Decimal>((total, value) => total.plus(D(value)), D(0));
const money = (value: Decimal) =>
  value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
let displayCurrency = "¥";
export const setDisplayCurrency = (currency: "CNY" | "USD") => {
  displayCurrency = currency === "USD" ? "$" : "¥";
};
export const formatMoney = (
  value: Money | number,
  currency = displayCurrency,
) => `${currency}${D(value).toFixed(2)}`;
export function skuContribution(sku: SKU): Money {
  return money(D(sku.price).minus(sum(Object.values(sku.cost))));
}
export function adRoas(ad: AdvertisingMetric[]): number | null {
  const spend = sum(ad.map((item) => item.spend));
  return spend.gt(0)
    ? Number(
        sum(ad.map((item) => item.attributedSales))
          .div(spend)
          .toFixed(2),
      )
    : null;
}
export function financialSummary(
  daily: DailyMetric[],
  advertising: AdvertisingMetric[],
): FinancialSummary {
  const grossSales = sum(daily.map((row) => row.sales));
  const refunds = sum(daily.map((row) => row.refunds));
  const netSales = grossSales.minus(refunds);
  const productCost = sum(daily.map((row) => row.productCost));
  const packagingCost = sum(daily.map((row) => row.packagingCost));
  const logisticsCost = sum(daily.map((row) => row.logisticsCost));
  const platformFees = sum(daily.map((row) => row.platformFees));
  const otherExpenses = sum(daily.map((row) => row.otherExpenses));
  const adSpend = sum(advertising.map((row) => row.spend));
  const nonAdCosts = productCost
    .plus(packagingCost)
    .plus(logisticsCost)
    .plus(platformFees)
    .plus(otherExpenses);
  const totalCost = nonAdCosts.plus(adSpend);
  const profit = netSales.minus(totalCost);
  const margin = netSales.gt(0)
    ? Number(profit.div(netSales).mul(100).toFixed(2))
    : null;
  // Break-even ROAS uses non-ad cost ratio as an estimate of incremental contribution.
  // Requires positive sales and complete cost fields in every daily row.
  const complete =
    daily.length > 0 &&
    daily.every(
      (row) =>
        row.costComplete !== false &&
        [
          row.productCost,
          row.packagingCost,
          row.logisticsCost,
          row.platformFees,
          row.otherExpenses,
        ].every((v) => v !== ""),
    );
  const contributionRate = netSales.gt(0)
    ? D(1).minus(nonAdCosts.div(netSales))
    : D(0);
  const breakEvenRoas =
    complete && contributionRate.gt(0)
      ? Number(D(1).div(contributionRate).toFixed(2))
      : null;
  return {
    grossSales: money(grossSales),
    refunds: money(refunds),
    netSales: money(netSales),
    productCost: money(productCost),
    packagingCost: money(packagingCost),
    logisticsCost: money(logisticsCost),
    platformFees: money(platformFees),
    adSpend: money(adSpend),
    otherExpenses: money(otherExpenses),
    totalCost: money(totalCost),
    profit: money(profit),
    margin,
    roas: adRoas(advertising),
    breakEvenRoas,
  };
}
export const addMoney = (values: Money[]) => money(sum(values));
