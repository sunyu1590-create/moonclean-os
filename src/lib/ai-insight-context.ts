export const insightMetricLabels: Record<string, string> = {
  periodDays: "分析周期天数", reportDays: "有日报记录的天数", todaySales: "今日销售额", todayOrders: "今日订单数", todayAdSpend: "今日广告消耗",
  periodNetSales: "周期净销售额", estimatedProfit: "估算经营利润", profitMargin: "估算利润率", attributedAdRevenue: "广告归因成交额", adRoas: "广告投入产出比", costIncompleteDays: "成本数据不完整的天数",
  exceptionCount: "异常总数", criticalCount: "高优先级异常数", warningCount: "需要关注的异常数", infoCount: "数据提示数", lowStockCount: "达到库存预警线的 SKU 数", zeroStockCount: "登记库存为零的 SKU 数", untrackedSkuCount: "尚未登记库存的 SKU 数", overdueTasks: "已逾期待办数", missingCostDays: "成本数据不完整的天数", negativeProfit: "系统是否识别到估算利润为负", marginBelowThreshold: "估算利润率是否低于店铺提醒线", adsBelowBreakEven: "系统是否识别到推广投入产出低于估算保本线", refundRiskProducts: "近 30 天按 SKU 汇总达到退款提示线的商品数", todayDataMissing: "今日经营日报是否缺失", coverageDays: "近 7 天中有日报记录的天数", breakEvenRoas: "按已录入成本估算的广告保本投入产出比", refundRate: "近 7 天全店日报退款金额占成交额的比例",
  days: "分析周期天数", adSpend: "广告消耗", attributedRevenue: "广告归因成交额", attributedOrders: "广告归因订单数", roas: "广告投入产出比", totalStoreSales: "全店净销售额（不等同于广告归因成交额）",
  productCount: "商品数", skuCount: "SKU 数", incompleteSkuCosts: "成本信息不完整的 SKU 数", grossSales: "成交额", refunds: "退款金额", netSales: "净销售额", productCost: "商品成本", packagingCost: "包装成本", logisticsCost: "物流成本", platformFees: "平台费用", otherExpenses: "其他费用",
  recordCount: "记录数", daysMissingCosts: "成本记录缺失的天数", daysWithProductSales: "有商品销量记录的天数", latest7DaysSales: "近 7 天销售额", latest7DaysOrders: "近 7 天订单数", totalOrders: "订单总数", loadedOrders: "已载入订单数", paidOrders: "已支付订单数", shippedOrders: "已发货订单数", completedOrders: "已完成订单数", refundedOrders: "已退款订单数", cancelledOrders: "已取消订单数", otherStatusOrders: "其他状态订单数", refundCount: "退款订单数", pendingRefunds: "待处理退款数", orderCount: "订单数", trackedSkuCount: "已登记库存的 SKU 数",
  totalTasks: "待办总数", openTasks: "未完成待办数", doingTasks: "进行中的待办数", highPriorityOpen: "未完成的高优先级待办数", dueSoon: "即将到期的待办数", sellingPrice: "当前模拟售价", productionCost: "生产成本", shippingCost: "物流成本", platformCost: "平台成本", platformRatePercent: "平台费率", targetMarginPercent: "目标利润率", estimatedContribution: "估算单件贡献", actualMarginPercent: "估算利润率", targetPrice: "目标售价",
  sales: "销售额", attentionCount: "需要关注的商品数", lowContributionProducts: "估算贡献偏低的商品数", incompleteCostProducts: "成本信息不完整的商品数", highRefundProducts: "达到退款提示线的商品数", costIncomplete: "成本信息是否不完整", connectionCount: "平台连接数", connected: "是否已连接平台", autoSync: "是否开启自动同步", hasRecentSync: "是否有近期同步记录", jobCount: "同步任务总数", failedJobs: "失败任务数", pendingJobs: "待处理任务数", runningJobs: "运行中任务数", successfulJobs: "成功任务数",
};

type InsightValue = number | boolean | string;

const displayValue = (value: InsightValue) => {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  return value;
};

export function formatInsightFacts(feature: string, context: Record<string, InsightValue>) {
  const normalized = { ...context };
  if (feature === "exceptions" && Number(normalized.missingCostDays) > 0) {
    normalized.estimatedProfit = "成本不完整，暂不提供可比较的利润值";
    normalized.profitMargin = "成本不完整，暂不提供可比较的利润率";
    normalized.breakEvenRoas = "成本不完整，暂不提供可比较的保本线";
  }

  const facts = Object.entries(normalized)
    .filter(([key]) => insightMetricLabels[key])
    .map(([key, value]) => `- ${insightMetricLabels[key]}：${displayValue(value)}`);

  if (feature === "exceptions" && normalized.refundRate !== undefined && normalized.refundRiskProducts !== undefined) {
    facts.push("- 口径说明：全店日报退款比例按近 7 天汇总；达到提示线的商品数按近 30 天 SKU 数据逐商品汇总。周期与统计粒度不同，两个指标不能直接互相验证，也不能据此认定数据矛盾。");
  }
  return facts.join("\n");
}

export function containsRawMetricName(text: string, contextKeys: readonly string[]) {
  return contextKeys.some((key) => new RegExp(`\\b${key}\\b`).test(text));
}

export function containsUnsupportedNumber(text: string, context: Record<string, InsightValue>) {
  const allowed = new Set(Object.values(context)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .map((value) => value.toFixed(4)));
  // Markdown item numbers are presentation, not business claims.
  [1, 2, 3].forEach((value) => allowed.add(value.toFixed(4)));
  const numbers = text.match(/(?<![\p{L}])[-−]?\d+(?:[,.]\d+)*(?:%|x)?/giu) || [];
  return numbers.some((token) => {
    const value = Number(token.replace(/[%x]/gi, "").replaceAll(",", "").replace("−", "-"));
    return !Number.isFinite(value) || !allowed.has(value.toFixed(4));
  });
}

export function buildExceptionsFallback(context: Record<string, InsightValue>) {
  const lines = ["分析依据：以下结论只使用当前页面提供的汇总数据，异常条数与日报覆盖天数分别说明。"];
  const period = Number(context.periodDays) || 7;
  const coverage = Number(context.coverageDays) || 0;
  if (context.todayDataMissing === true || (coverage > 0 && coverage < period)) {
    lines.push(`优先补齐数据。当前 ${period} 天范围内仅 ${coverage} 天有日报记录${context.todayDataMissing === true ? "，今日日报也尚未录入" : ""}。先补录缺失日期，再用相同范围判断趋势。`);
  }
  const missingCosts = Number(context.missingCostDays) || 0;
  if (missingCosts > 0) {
    lines.push(`暂缓利润与推广效率判断。${period} 天范围内有 ${missingCosts} 天成本不完整，当前估算利润、利润率和广告保本线不足以支持调价或调整预算；先核对并补齐成本记录。`);
  }
  if (context.refundRate !== undefined && context.refundRiskProducts !== undefined) {
    const rate = Number(context.refundRate);
    const products = Number(context.refundRiskProducts);
    if (Number.isFinite(rate) && rate >= 10 && products === 0) {
      lines.push(`复核退款统计口径。近 7 天全店日报退款金额占成交额为 ${rate}%；近 30 天 SKU 口径未识别到达到提示线的商品。两者统计范围不同，不能据此判定矛盾或归因到具体商品；请核对退款日期与成交额口径。`);
    } else if (Number.isFinite(rate) && rate >= 10) {
      lines.push(`关注退款情况。近 7 天全店日报退款金额占成交额为 ${rate}%，这是系统提示值而非行业标准；请在售后记录中复核退款原因和日期范围，不据此直接归因。`);
    } else if (products > 0) {
      lines.push(`复核商品退款提示。近 30 天 SKU 汇总有 ${products} 个商品达到系统提示线；该指标用于定位核查对象，不代表已确认原因。`);
    }
  }
  if (lines.length === 1) {
    lines.push(`当前汇总识别到 ${Number(context.exceptionCount) || 0} 项异常，尚不足以判断具体原因。请先查看异常中心列出的来源记录，再决定是否需要操作。`);
  }
  return lines.join("\n\n");
}
