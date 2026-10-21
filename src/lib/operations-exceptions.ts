import type { AppData } from "@/lib/model";
import type { InventoryBalance, OperationTask } from "@/lib/operations";
import { financialSummary } from "@/lib/finance";

export type OperationException = {
  key: string;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  evidence: string;
  action: string;
  href: string;
};

const dayOffset = (day: string, offset: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const money = (value: number) => value.toFixed(2);

export function buildOperationExceptions(
  data: AppData,
  inventory: InventoryBalance[],
  tasks: OperationTask[],
  today: string,
): OperationException[] {
  const from = dayOffset(today, -6);
  const week = data.daily.filter((row) => row.date >= from && row.date <= today);
  const weekAds = data.advertising.filter((row) => row.date >= from && row.date <= today);
  const summary = financialSummary(week, weekAds);
  const missingCostDays = week.filter((row) =>
    row.costComplete === false || [row.productCost, row.packagingCost, row.logisticsCost, row.platformFees, row.otherExpenses].some((value) => value === ""),
  ).length;
  const exceptions: OperationException[] = [];

  if (!week.some((row) => row.date === today)) {
    exceptions.push({ key: "today_data_missing", severity: "info", category: "数据覆盖", title: "今日经营日报尚未录入", evidence: `截至 ${today}，数据中心还没有今天的日报。`, action: "录入今日销售、退款和订单数据；如果今天没有经营，也可记录为 0。", href: "/data" });
  }
  if (missingCostDays > 0) {
    exceptions.push({ key: "cost_incomplete", severity: "warning", category: "数据质量", title: `${missingCostDays} 天成本数据不完整`, evidence: "所选日期缺少成本字段或成本尚未确认，利润和保本 ROAS 只能作为参考。", action: "先补齐成本数据，再据此调整价格或推广预算。", href: "/data" });
  } else if (week.length > 0 && Number(summary.profit) < 0) {
    exceptions.push({ key: "negative_profit", severity: "critical", category: "利润风险", title: "近 7 天估算经营利润为负", evidence: `净销售额 ¥${summary.netSales}，估算经营利润 ¥${summary.profit}。`, action: "对照日报费用、退款和广告消耗，定位亏损日期与主要费用项。", href: "/finance" });
  }
  if (missingCostDays === 0 && summary.margin !== null && summary.margin >= 0 && summary.margin < data.settings.marginAlert) {
    exceptions.push({ key: "margin_below_threshold", severity: "warning", category: "利润预警", title: `利润率低于店铺预警线 ${data.settings.marginAlert}%`, evidence: `近 7 天估算利润率 ${summary.margin.toFixed(2)}%；成本数据完整。`, action: "查看商品贡献利润、费用结构和定价空间，再决定调整方案。", href: "/finance" });
  }
  const spend = Number(summary.adSpend);
  if (spend > 0 && summary.roas !== null && summary.breakEvenRoas !== null && summary.roas < summary.breakEvenRoas) {
    exceptions.push({ key: "ad_below_break_even", severity: "warning", category: "推广效率", title: "广告 ROAS 低于估算保本线", evidence: `近 7 天 ROAS ${summary.roas.toFixed(2)}x，估算保本线 ${summary.breakEvenRoas.toFixed(2)}x。`, action: "先核对归因口径和成本，再检查低效计划、人群与商品，不建议仅凭单日波动大幅调预算。", href: "/advertising" });
  }

  const skuLabels = new Map(data.products.flatMap((product) => product.skus.map((sku) => [sku.id, `${product.name} · ${sku.name}`] as const)));
  const lowBalances = inventory.filter((row) => row.quantity <= row.low_stock_threshold);
  if (lowBalances.length > 0) {
    const zeroCount = lowBalances.filter((row) => row.quantity === 0).length;
    const topNames = lowBalances.slice(0, 2).map((row) => skuLabels.get(row.sku_id) || "已归档 SKU").join("、");
    exceptions.push({ key: "low_stock", severity: zeroCount > 0 ? "critical" : "warning", category: "库存风险", title: `${lowBalances.length} 个 SKU 达到库存预警线`, evidence: `${zeroCount ? `${zeroCount} 个 SKU 库存为 0；` : ""}${topNames}${lowBalances.length > 2 ? "等" : ""}需要核对。`, action: "查看近期销量与实际在库量，确认补货数量和到货时间。", href: "/inventory" });
  }
  const trackedSkuIds = new Set(inventory.map((row) => row.sku_id));
  const untrackedSkuCount = data.products.reduce((count, product) => count + product.skus.filter((sku) => !trackedSkuIds.has(sku.id)).length, 0);
  if (untrackedSkuCount > 0) {
    exceptions.push({ key: "inventory_untracked", severity: "info", category: "库存覆盖", title: `${untrackedSkuCount} 个 SKU 尚未登记库存`, evidence: "未登记的 SKU 不会被当作零库存计算，因此目前无法判断其补货风险。", action: "到库存管理补录当前库存和预警线，完善库存风险检查。", href: "/inventory" });
  }

  const overdue = tasks.filter((task) => task.status !== "done" && task.due_date && task.due_date < today);
  if (overdue.length > 0) {
    exceptions.push({ key: "overdue_tasks", severity: "warning", category: "待办跟进", title: `${overdue.length} 项运营任务已逾期`, evidence: overdue.slice(0, 2).map((task) => `${task.title}（${task.due_date}）`).join("；"), action: "重新确认处理人和截止时间，完成后在任务中心更新状态。", href: "/tasks" });
  }

  const cutoff = dayOffset(today, -29);
  const refundsByProduct = new Map<string, { gross: number; refund: number }>();
  for (const row of data.skuDaily || []) {
    if (row.date < cutoff || row.date > today) continue;
    const product = data.products.find((item) => item.skus.some((sku) => sku.id === row.skuId));
    if (!product) continue;
    const current = refundsByProduct.get(product.id) || { gross: 0, refund: 0 };
    current.gross += Number(row.grossSales || 0);
    current.refund += Number(row.refundAmount || 0);
    refundsByProduct.set(product.id, current);
  }
  const refundRisks = [...refundsByProduct.entries()].map(([id, values]) => ({
    name: data.products.find((product) => product.id === id)?.name || "商品",
    rate: values.gross > 0 ? values.refund / values.gross * 100 : 0,
    gross: values.gross,
    refund: values.refund,
  })).filter((row) => row.rate >= 10).sort((a, b) => b.rate - a.rate);
  if (refundRisks.length > 0) {
    const top = refundRisks.slice(0, 2).map((row) => `${row.name} ${row.rate.toFixed(1)}%（退款 ¥${money(row.refund)} / 成交 ¥${money(row.gross)}）`).join("、");
    exceptions.push({ key: "refund_risk", severity: "warning", category: "售后风险", title: `${refundRisks.length} 个商品近 30 天退款率偏高`, evidence: `${top}${refundRisks.length > 2 ? "等" : ""}；10% 为系统提示线，需结合平台口径复核。`, action: "查看售后原因、SKU 和发货批次，确认是否存在可重复解决的问题。", href: "/product-insights" });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return exceptions.sort((a, b) => order[a.severity] - order[b.severity] || a.category.localeCompare(b.category, "zh-CN"));
}

export function operationExceptionCounts(exceptions: OperationException[], data: AppData, inventory: InventoryBalance[], tasks: OperationTask[], today: string) {
  const week = data.daily.filter((row) => row.date >= dayOffset(today, -6) && row.date <= today);
  const costsIncomplete = week.filter((row) => row.costComplete === false || [row.productCost, row.packagingCost, row.logisticsCost, row.platformFees, row.otherExpenses].some((value) => value === "")).length;
  const adsBelowBreakEven = exceptions.some((item) => item.key === "ad_below_break_even");
  const refundRiskProducts = exceptions.find((item) => item.key === "refund_risk")?.title.match(/^\d+/)?.[0] || "0";
  const tracked = new Set(inventory.map((row) => row.sku_id));
  const untrackedSkuCount = data.products.reduce((count, product) => count + product.skus.filter((sku) => !tracked.has(sku.id)).length, 0);
  return {
    periodDays: 7,
    exceptionCount: exceptions.length,
    criticalCount: exceptions.filter((item) => item.severity === "critical").length,
    warningCount: exceptions.filter((item) => item.severity === "warning").length,
    infoCount: exceptions.filter((item) => item.severity === "info").length,
    lowStockCount: inventory.filter((row) => row.quantity <= row.low_stock_threshold).length,
    zeroStockCount: inventory.filter((row) => row.quantity === 0).length,
    untrackedSkuCount,
    overdueTasks: tasks.filter((task) => task.status !== "done" && !!task.due_date && task.due_date < today).length,
    missingCostDays: costsIncomplete,
    negativeProfit: exceptions.some((item) => item.key === "negative_profit"),
    marginBelowThreshold: exceptions.some((item) => item.key === "margin_below_threshold"),
    adsBelowBreakEven,
    refundRiskProducts: Number(refundRiskProducts),
    todayDataMissing: !data.daily.some((row) => row.date === today),
    coverageDays: new Set(week.map((row) => row.date)).size,
  };
}
