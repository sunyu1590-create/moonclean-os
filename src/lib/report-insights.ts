import type { AdvertisingMetric, DailyMetric } from "@/lib/model";
import { financialSummary } from "@/lib/finance";

export type ReportInsight = {
  category: string;
  title: string;
  detail: string;
  action: string;
  tone: "blue" | "green" | "amber" | "red";
};

const amount = (value: string | number) => Number(value || 0);

/** Produces cautious, actionable recommendations from the latest 7-day window. */
export function weeklyReportInsights(
  daily: DailyMetric[],
  advertising: AdvertisingMetric[],
): ReportInsight[] {
  const insights: ReportInsight[] = [];
  const summary = financialSummary(daily, advertising);
  const gross = amount(summary.grossSales);
  const refunds = amount(summary.refunds);
  const refundRate = gross > 0 ? (refunds / gross) * 100 : 0;
  const orders = daily.reduce((total, row) => total + row.orders, 0);
  const visitors = daily.reduce((total, row) => total + (row.reportDetails?.visitors || 0), 0);
  const conversion = visitors > 0 ? (orders / visitors) * 100 : null;
  const costsComplete = daily.length > 0 && daily.every((row) =>
    row.costComplete !== false && [row.productCost, row.packagingCost, row.logisticsCost, row.platformFees, row.otherExpenses].every((value) => value !== ""),
  );

  if (daily.length === 0) {
    return [{
      category: "数据准备",
      title: "补齐最近一周经营数据",
      detail: "最近 7 天没有可用于分析的经营日报，系统暂时不能可靠判断销售、退款和利润变化。",
      action: "到数据中心导入或录入每日经营报表；如有推广，再补充广告消耗和归因成交。",
      tone: "blue",
    }];
  }

  if (daily.length < 7) {
    insights.push({
      category: "数据覆盖",
      title: `近 7 天已录入 ${daily.length} 天日报`,
      detail: "缺少日期会让周趋势和日均数据偏离实际情况。",
      action: "检查数据中心，补录缺失日期；没有经营或投放的日期也可录入 0，避免误判为漏报。",
      tone: "amber",
    });
  }

  if (!costsComplete) {
    insights.push({
      category: "利润质量",
      title: "成本数据不完整，利润只能参考",
      detail: "所选日报中存在缺少或未确认成本的日期，当前利润和保本 ROAS 不适合用于定预算。",
      action: "补齐商品、包装、物流、平台费用和其他经营费用，再复核利润与广告保本线。",
      tone: "amber",
    });
  } else if (amount(summary.profit) < 0) {
    insights.push({
      category: "利润预警",
      title: "近 7 天估算经营利润为负",
      detail: `净销售额 ${summary.netSales} 元，估算经营利润 ${summary.profit} 元。先找出亏损集中在哪些日期和费用项。`,
      action: "逐日检查推广消耗、退款和单件贡献利润，优先调整低贡献商品或低效投放。",
      tone: "red",
    });
  } else {
    insights.push({
      category: "利润表现",
      title: "经营利润保持为正",
      detail: `近 7 天估算经营利润 ${summary.profit} 元，利润率 ${summary.margin === null ? "暂不可算" : `${summary.margin.toFixed(2)}%`}。`,
      action: "扩量前复核新增广告的归因 ROAS 是否高于成本完整时的保本 ROAS，并留意退款变化。",
      tone: "green",
    });
  }

  const spend = amount(summary.adSpend);
  if (spend <= 0) {
    insights.push({
      category: "推广数据",
      title: advertising.length ? "本周未记录广告消耗" : "尚无本周推广日报",
      detail: "广告 ROAS 只使用广告归因成交额除以广告消耗；不能用全店成交额代替。",
      action: "如果本周有投放，请录入推广报表中的消耗和归因成交额；没有投放则无需补造数据。",
      tone: "blue",
    });
  } else if (summary.roas === null || summary.breakEvenRoas === null) {
    insights.push({
      category: "推广效率",
      title: `已记录推广消耗 ${summary.adSpend} 元，保本线暂不可算`,
      detail: summary.roas === null ? "当前没有有效的广告归因成交额，无法计算 ROAS。" : `广告归因 ROAS 为 ${summary.roas.toFixed(2)}x，但成本数据不完整，暂不能计算可靠保本 ROAS。`,
      action: "核对推广报表的归因成交额，并补齐成本字段后再评估是否加减预算。",
      tone: "amber",
    });
  } else if (summary.roas < summary.breakEvenRoas) {
    insights.push({
      category: "推广效率",
      title: `广告 ROAS ${summary.roas.toFixed(2)}x 低于估算保本线 ${summary.breakEvenRoas.toFixed(2)}x`,
      detail: `近 7 天广告消耗 ${summary.adSpend} 元，归因成交额 ${advertising.reduce((total, row) => total + amount(row.attributedSales), 0).toFixed(2)} 元。`,
      action: "先检查计划、人群和商品转化，谨慎降低低效计划预算；以平台归因口径和完整成本复核。",
      tone: "red",
    });
  } else {
    insights.push({
      category: "推广效率",
      title: `广告 ROAS ${summary.roas.toFixed(2)}x 高于估算保本线`,
      detail: `估算保本 ROAS 为 ${summary.breakEvenRoas.toFixed(2)}x，当前投放可能覆盖直接经营成本。`,
      action: "小步增加预算并观察边际 ROAS、退款和利润，不要一次性大幅扩量。",
      tone: "green",
    });
  }

  if (refundRate >= 5) {
    insights.push({
      category: "退款关注",
      title: `退款金额占成交额 ${refundRate.toFixed(1)}%`,
      detail: `本周退款 ${summary.refunds} 元。5% 是系统提示线，不代表行业通用标准。`,
      action: "查看售后原因和商品评价，按商品、规格及发货日期定位重复问题。",
      tone: "amber",
    });
  }

  if (daily.length >= 4) {
    const split = Math.floor(daily.length / 2);
    const older = daily.slice(0, split);
    const recent = daily.slice(split);
    const average = (rows: DailyMetric[]) => rows.reduce((sum, row) => sum + amount(row.sales) - amount(row.refunds), 0) / Math.max(rows.length, 1);
    const oldAverage = average(older);
    const recentAverage = average(recent);
    if (oldAverage > 0) {
      const change = ((recentAverage - oldAverage) / oldAverage) * 100;
      if (change <= -10) {
        insights.push({
          category: "销售趋势",
          title: `后半周日均净销售额下降 ${Math.abs(change).toFixed(1)}%`,
          detail: `前半周日均 ${oldAverage.toFixed(2)} 元，后半周日均 ${recentAverage.toFixed(2)} 元。`,
          action: "对照推广流量、访客转化、活动结束日期和商品库存，先定位变化发生的日期。",
          tone: "amber",
        });
      } else if (change >= 10) {
        insights.push({
          category: "销售趋势",
          title: `后半周日均净销售额增长 ${change.toFixed(1)}%`,
          detail: `前半周日均 ${oldAverage.toFixed(2)} 元，后半周日均 ${recentAverage.toFixed(2)} 元。`,
          action: "确认增长来自稳定的商品与渠道，再检查库存和履约能力，避免缺货导致波动。",
          tone: "green",
        });
      }
    }
  }

  if (conversion !== null && visitors > 0 && conversion < 2) {
    insights.push({
      category: "流量转化",
      title: `日报访客到订单转化约 ${conversion.toFixed(2)}%`,
      detail: `近 7 天记录 ${visitors} 名访客、${orders} 笔订单。该值按订单数 ÷ 访客数估算，与平台口径可能不同。`,
      action: "检查主图、价格、规格说明、评价和客服响应，并用平台报表的转化率交叉核对。",
      tone: "amber",
    });
  }

  return insights.slice(0, 6);
}
