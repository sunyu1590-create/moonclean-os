"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { BadgePercent, CircleDollarSign, Receipt, Wallet } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { financialSummary, formatMoney } from "@/lib/finance";
import { numeric, periodRows, storeToday, trend } from "@/lib/analytics";
import { AiInsightPanel } from "@/components/ai-insight-panel";
import { DeferredChart } from "@/components/charts/deferred-chart";
import { isDailyCostComplete, previousPeriodEnd, summarizeDataQuality } from "@/lib/operating-review";

const FinanceTrendChart = dynamic(() => import("@/components/charts/finance-charts").then((module) => module.FinanceTrendChart));
const FinanceCostChart = dynamic(() => import("@/components/charts/finance-charts").then((module) => module.FinanceCostChart));
export default function Finance() {
  const { data } = useApp();
  const [days, setDays] = useState<7 | 30>(30);
  if (!data) return <p>正在加载数据…</p>;
  const daily = periodRows(
      data.daily,
      days,
      storeToday(data.settings.store.timezone),
    ),
    ads = periodRows(
      data.advertising,
      days,
      storeToday(data.settings.store.timezone),
    ),
    s = financialSummary(daily, ads);
  const quality = summarizeDataQuality(data.daily, storeToday(data.settings.store.timezone), days);
  const today = storeToday(data.settings.store.timezone);
  const comparisonEnd = previousPeriodEnd(today, days);
  const previousDaily = periodRows(data.daily, days, comparisonEnd);
  const previousAds = periodRows(data.advertising, days, comparisonEnd);
  const previous = financialSummary(previousDaily, previousAds);
  const orderCount = daily.reduce((total, row) => total + row.orders, 0);
  const refundRate = Number(s.grossSales) > 0 ? Number(s.refunds) / Number(s.grossSales) * 100 : null;
  const netPerOrder = orderCount > 0 ? Number(s.netSales) / orderCount : null;
  const profitPerOrder = orderCount > 0 ? Number(s.profit) / orderCount : null;
  const dailyProfit = trend(daily, ads).sort((a, b) => b.profit - a.profit);
  const strongestDays = dailyProfit.filter(row => row.profit > 0).slice(0, 3);
  const lossDays = dailyProfit.filter(row => row.profit < 0).sort((a, b) => a.profit - b.profit).slice(0, 3);
  const profitDayGroups: [string, typeof dailyProfit][] = [["利润较高的日期", strongestDays], ["估算亏损日期", lossDays]];
  const comparisonLabel = (current: string, before: string) => {
    const delta = Number(current) - Number(before);
    return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatMoney(Math.abs(delta))}`;
  };
  const cost = [
    { name: "商品成本", value: Number(s.productCost), color: "var(--chart-1)" },
    { name: "包装费用", value: Number(s.packagingCost), color: "var(--chart-3)" },
    { name: "物流费用", value: Number(s.logisticsCost), color: "var(--chart-2)" },
    { name: "平台费用", value: Number(s.platformFees), color: "var(--chart-6)" },
    { name: "广告费用", value: Number(s.adSpend), color: "var(--chart-4)" },
    { name: "其他经营费用", value: Number(s.otherExpenses), color: "var(--chart-5)" },
  ];
  const detail = [
    ["销售额", s.grossSales],
    ["退款调整", `-${s.refunds}`],
    ["净销售额", s.netSales],
    ["商品成本", `-${s.productCost}`],
    ["包装费用", `-${s.packagingCost}`],
    ["物流费用", `-${s.logisticsCost}`],
    ["平台费用", `-${s.platformFees}`],
    ["广告费用", `-${s.adSpend}`],
    ["其他经营费用", `-${s.otherExpenses}`],
    ["估算经营利润", s.profit],
  ];
  return (
    <>
      <PageHead
        eyebrow="FINANCE / 财务利润"
        title="看见收入，也看清留下的利润"
        description="所有经营费用汇总至统一的财务计算模块。"
        action={
          <div className="flex gap-2">
            {([7, 30] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={days === v ? "default" : "outline"}
                onClick={() => setDays(v)}
              >
                近 {v} 天
              </Button>
            ))}
          </div>
        }
      />
      <AiInsightPanel feature="finance" context={{ periodDays: days, grossSales: Number(s.grossSales), refunds: Number(s.refunds), netSales: Number(s.netSales), productCost: Number(s.productCost), packagingCost: Number(s.packagingCost), logisticsCost: Number(s.logisticsCost), platformFees: Number(s.platformFees), adSpend: Number(s.adSpend), otherExpenses: Number(s.otherExpenses), estimatedProfit: Number(s.profit), profitMargin: s.margin ?? "数据不足", costIncompleteDays: quality.incompleteCostRecords }} />
      {quality.hasDemo && <div role="status" className="mb-5 rounded-2xl border border-border bg-[var(--mc-tint-orange)] p-4 text-sm text-[var(--mc-color-warning)]">所选日期包含模拟平台记录。演示销售额和利润不代表真实店铺业绩。</div>}
      {daily.some(row => !isDailyCostComplete(row)) && <div role="status" className="mb-5 rounded-2xl border border-border bg-[var(--mc-tint-orange)] p-4 text-sm text-[var(--mc-color-warning)]">所选周期有 {quality.incompleteCostRecords} 条日报成本信息不完整，以下利润为不完整估算；盈亏平衡 ROAS 暂不显示。</div>}
      <p className="mb-5 text-xs leading-5 text-muted-foreground">本期数据来源：手工 {quality.sourceCounts.manual} 条 · 导入 {quality.sourceCounts.imported} 条 · 模拟 {quality.sourceCounts.demo} 条 · 正式同步 {quality.sourceCounts.official} 条。经营利润按净销售额扣除已录入成本、费用与推广消耗估算。</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="净销售额"
          value={formatMoney(s.netSales)}
          sub={`销售 ${formatMoney(s.grossSales)} − 退款 ${formatMoney(s.refunds)}`}
          icon={<CircleDollarSign size={18} />}
        />
        <MetricCard
          label="总经营成本"
          value={formatMoney(s.totalCost)}
          icon={<Receipt size={18} />}
        />
        <MetricCard
          label="估算经营利润"
          value={formatMoney(s.profit)}
          tone={Number(s.profit) < 0 ? "red" : "green"}
          icon={<Wallet size={18} />}
        />
        <MetricCard
          label="经营利润率"
          value={numeric(s.margin, "%")}
          tone={s.margin !== null && s.margin < 0 ? "red" : "green"}
          icon={<BadgePercent size={18} />}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <SectionCard title="历史利润趋势" sub="每日净销售额与估算经营利润">
          <DeferredChart label="历史利润趋势图表">
            <FinanceTrendChart trend={trend(daily, ads)} />
          </DeferredChart>
        </SectionCard>
        <SectionCard title="成本结构" sub="不同经营成本在总成本中的占比">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <DeferredChart className="h-[240px] w-full sm:w-1/2" label="成本结构图表">
              <FinanceCostChart costs={cost} />
            </DeferredChart>
            <div className="grid w-full gap-3 sm:w-1/2">
              {cost.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <i
                      className="size-2 rounded-full"
                      style={{ background: item.color }}
                    />
                    {item.name}
                  </span>
                  <strong className="number">
                    {s.totalCost === "0.00"
                      ? "0.0"
                      : ((item.value / Number(s.totalCost)) * 100).toFixed(1)}
                    %
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
      <SectionCard
        className="mt-5"
        title="利润核算明细"
        sub="估算经营利润 = 净销售额 − 商品、包装、物流、平台、广告及其他费用"
      >
        <div className="grid gap-x-8 md:grid-cols-2">
          {detail.map(([label, value], index) => (
            <div
              key={label}
              className={`flex justify-between border-b border-border py-3 text-sm ${index === 9 ? "font-bold text-[var(--mc-color-success)]" : ""}`}
            >
              <span>{label}</span>
              <span className="number">
                {value.startsWith("-")
                  ? "-" + formatMoney(value.slice(1))
                  : formatMoney(value)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          以上为基于录入数据的经营估算，未计入税费、资金结算时间差等未录入项目。
        </p>
      </SectionCard>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <SectionCard title="利润质量与效率" sub="按当前周期已录入的日报、订单与成本估算">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[var(--mc-tint-blue)] p-3"><p className="text-[10px] text-muted-foreground">退款金额占销售额</p><p className="mt-1 text-lg font-semibold text-foreground">{numeric(refundRate, "%")}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">退款金额 ÷ 销售额；仅供本店周期内对比</p></div>
            <div className="rounded-xl bg-[var(--mc-tint-blue)] p-3"><p className="text-[10px] text-muted-foreground">每单净销售额</p><p className="mt-1 text-lg font-semibold text-foreground">{netPerOrder === null ? "—" : formatMoney(netPerOrder)}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">净销售额 ÷ 已录入订单数（{orderCount} 单）</p></div>
            <div className="rounded-xl bg-[var(--mc-tint-blue)] p-3"><p className="text-[10px] text-muted-foreground">每单估算利润</p><p className={`mt-1 text-lg font-semibold ${profitPerOrder !== null && profitPerOrder < 0 ? "text-[var(--mc-color-danger)]" : "text-foreground"}`}>{profitPerOrder === null ? "—" : formatMoney(profitPerOrder)}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">周期利润 ÷ 已录入订单数；成本不完整时仅供参考</p></div>
            <div className="rounded-xl bg-[var(--mc-tint-blue)] p-3"><p className="text-[10px] text-muted-foreground">估算保本 ROAS</p><p className="mt-1 text-lg font-semibold text-foreground">{numeric(s.breakEvenRoas, "x")}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">需销售与成本数据完整；不代表平台投放目标</p></div>
          </div>
        </SectionCard>
        <SectionCard title="与上一周期对比" sub={`本期近 ${days} 天 · 对照前 ${days} 天 · 仅比较已有记录`}>
          <div className="space-y-0">
            {[["净销售额", s.netSales, previous.netSales], ["估算经营利润", s.profit, previous.profit], ["推广消耗", s.adSpend, previous.adSpend]].map(([label, current, before]) => <div key={String(label)} className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right"><strong className="number text-foreground">{formatMoney(String(current))}</strong><span className="ml-2 text-xs text-muted-foreground">较上期 {comparisonLabel(String(current), String(before))}</span></span></div>)}
            <div className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-muted-foreground">日报覆盖</span><span className="text-right"><strong>{new Set(daily.map(row => row.date)).size} 天</strong><span className="ml-2 text-xs text-muted-foreground">上一周期 {new Set(previousDaily.map(row => row.date)).size} 天</span></span></div>
          </div>
          {(daily.some(row => !isDailyCostComplete(row)) || previousDaily.some(row => !isDailyCostComplete(row))) && <p className="mt-2 rounded-xl bg-[var(--mc-tint-orange)] px-3 py-2 text-[10px] leading-4 text-[var(--mc-color-warning)]">至少一个周期的成本信息不完整，利润差额不能单独说明经营改善或恶化。</p>}
          {previousDaily.length === 0 && <p className="mt-2 text-[10px] text-muted-foreground">上一周期没有日报记录，差额仅作数据对照。</p>}
        </SectionCard>
      </div>
      <SectionCard className="mt-5" title="每日利润复核" sub="按单日估算经营利润排序；定位波动日期后可回到数据中心核对日报与费用">
        {dailyProfit.length === 0 ? <p className="text-sm text-muted-foreground">所选周期暂无日报记录。</p> : <div className="grid gap-5 md:grid-cols-2">
          {profitDayGroups.map(([title, values]) => <div key={title}><h3 className="mb-2 text-xs font-semibold text-foreground">{title}</h3>{values.length === 0 ? <p className="rounded-xl bg-[var(--mc-tint-blue)] p-3 text-xs text-muted-foreground">{title === "估算亏损日期" ? "当前周期没有估算亏损的日报日期。" : "当前周期暂无正利润的日报日期。"}</p> : <div className="space-y-2">{values.map(row => <div key={row.date} className="flex items-center justify-between rounded-xl bg-[var(--mc-tint-blue)] px-3 py-2.5 text-xs"><span className="text-muted-foreground">{row.date}</span><strong className={`number ${row.profit < 0 ? "text-[var(--mc-color-danger)]" : "text-[var(--mc-color-success)]"}`}>{formatMoney(row.profit)}</strong></div>)}</div>}</div>)}
        </div>}
        {quality.incompleteCostRecords > 0 && <p className="mt-3 text-[10px] leading-4 text-muted-foreground">所选周期有 {quality.incompleteCostRecords} 条成本不完整记录，相关日期利润可能偏高。</p>}
      </SectionCard>
    </>
  );
}
