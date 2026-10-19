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
      <AiInsightPanel feature="finance" context={{ periodDays: days, grossSales: Number(s.grossSales), refunds: Number(s.refunds), netSales: Number(s.netSales), productCost: Number(s.productCost), packagingCost: Number(s.packagingCost), logisticsCost: Number(s.logisticsCost), platformFees: Number(s.platformFees), adSpend: Number(s.adSpend), otherExpenses: Number(s.otherExpenses), estimatedProfit: Number(s.profit), profitMargin: s.margin ?? "数据不足", costIncompleteDays: daily.filter(row => row.costComplete === false).length }} />
      {daily.some(row => row.source === "mock_pinduoduo") && <div role="status" className="mb-5 rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-4 text-sm text-primary">所选日期包含拼多多模拟同步订单。演示销售额和利润不代表真实店铺业绩。</div>}
      {daily.some(row => row.costComplete === false) && <div role="status" className="mb-5 rounded-2xl border border-border bg-[var(--mc-tint-orange)] p-4 text-sm text-[var(--mc-color-warning)]">部分日期缺少可靠成本版本，以下利润为不完整估算；盈亏平衡 ROAS 暂不显示。</div>}
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
    </>
  );
}
