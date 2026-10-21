"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Decimal from "decimal.js";
import {
  ArrowUpRight,
  ArrowRight,
  BadgePercent,
  ChartNoAxesCombined,
  ShoppingBag,
  Target,
  Wallet,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import {
  DemoNote,
  MetricCard,
  PageHead,
  SectionCard,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { OperationsWidget } from "@/components/operations-widget";
import { DashboardIntelligence } from "@/components/dashboard-intelligence";
import { OperationsExceptionCenter } from "@/components/operations-exception-center";
import { AiInsightPanel } from "@/components/ai-insight-panel";
import { financialSummary, formatMoney, addMoney } from "@/lib/finance";
import { numeric, periodRows, storeToday, trend } from "@/lib/analytics";
import { DeferredChart } from "@/components/charts/deferred-chart";

const DashboardTrendChart = dynamic(() => import("@/components/charts/dashboard-trend-chart"));
export default function Dashboard() {
  const { data } = useApp();
  const [days, setDays] = useState<7 | 30>(7);
  if (!data) return <p>正在加载数据…</p>;
  const currentDate = storeToday(data.settings.store.timezone);
  const rows = periodRows(data.daily, days, currentDate),
    ads = periodRows(data.advertising, days, currentDate);
  const summary = financialSummary(rows, ads);
  const todayRows = data.daily.filter((r) => r.date === currentDate),
    todayAds = data.advertising.filter((r) => r.date === currentDate);
  const current = financialSummary(todayRows, todayAds);
  const orders = todayRows.reduce((n, r) => n + r.orders, 0);
  const ranking = data.products
    .map((product) => ({
      product,
      value: addMoney(rows.map((r) => r.productSales[product.id] || "0")),
    }))
    .sort((a, b) => new Decimal(b.value).cmp(a.value));
  const monthRows = data.daily.filter((r) =>
    r.date.startsWith(currentDate.slice(0, 7)),
  );
  const monthSales = financialSummary(monthRows, []).netSales;
  const target = new Decimal(data.settings.salesTarget);
  const targetPercent = target.gt(0) ? new Decimal(monthSales).div(target).mul(100) : null;
  const targetProgress = targetPercent ? Decimal.min(targetPercent, 100).toNumber() : 0;
  return (
    <>
      <PageHead
        eyebrow="OVERVIEW / 经营总览"
        title="早上好，今天的生意一目了然"
        description="从销售、推广到利润，掌握店铺经营节奏。"
        action={
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1">
            {([7, 30] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={days === v ? "default" : "ghost"}
                onClick={() => setDays(v)}
              >
                {v} 天
              </Button>
            ))}
          </div>
        }
      />
      <section className="material-hero mb-5 overflow-hidden rounded-[22px]">
        <div className="grid gap-5 p-5 md:grid-cols-[1.45fr_1fr] md:items-center md:px-6 md:py-5">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--mc-tint-blue)] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-primary"><span className="size-1.5 rounded-full bg-primary" />近 {days} 天经营快照</span>
            <h2 className="mt-2.5 text-[20px] font-semibold tracking-[-.035em] text-foreground md:text-[23px]">经营表现，清晰可见。</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">销售、利润与经营目标集中呈现，数据更新后自动同步。</p>
            <div className="mt-4 grid max-w-[500px] grid-cols-2 gap-4">
              <div className="border-r border-border pr-3"><p className="text-[11px] text-muted-foreground">期间净销售额</p><p className="number mt-1 text-[25px] font-semibold tracking-[-.04em] text-foreground md:text-[29px]">{formatMoney(summary.netSales)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">估算经营利润</p><p className={`number mt-1 text-[23px] font-semibold tracking-[-.04em] md:text-[27px] ${Number(summary.profit)<0?"text-[var(--mc-color-danger)]":"text-[var(--mc-color-success)]"}`}>{formatMoney(summary.profit)}</p></div>
            </div>
          </div>
          <div className="rounded-[17px] border border-border bg-[linear-gradient(130deg,var(--card)_0%,var(--mc-tint-blue)_100%)] p-4 md:p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-medium text-muted-foreground">本月销售目标</p><p className="number mt-1 text-[22px] font-semibold tracking-tight text-foreground">{targetPercent ? `${targetPercent.toFixed(1)}%` : "未设置"}</p></div><span className="grid size-9 place-items-center rounded-xl bg-card text-primary shadow-sm"><Target size={17}/></span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--mc-tint-blue)]"><div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{width:`${targetProgress}%`}}/></div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>已完成 {formatMoney(monthSales)} / {formatMoney(data.settings.salesTarget)}</span><Link href="/data" className="inline-flex items-center gap-1 font-semibold text-primary">经营数据 <ArrowRight size={12}/></Link></div>
          </div>
        </div>
      </section>
      <div className="mb-5 px-1">
        <DemoNote hasDemo={data.daily.some((r) => r.isDemo)} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="今日销售额"
          value={formatMoney(current.netSales)}
          sub="已扣除退款"
          icon={<Wallet size={18} />}
        />
        <MetricCard
          label="今日订单量"
          value={`${orders} 单`}
          sub="已录入订单"
          icon={<ShoppingBag size={18} />}
        />
        <MetricCard
          label="今日推广消耗"
          value={formatMoney(current.adSpend)}
          sub="来自推广录入"
          icon={<Target size={18} />}
        />
        <MetricCard
          label="今日估算经营利润"
          value={formatMoney(current.profit)}
          tone={Number(current.profit) < 0 ? "red" : "green"}
          sub="含广告及其他费用"
          icon={<ArrowUpRight size={18} />}
        />
        <MetricCard
          label="期间经营利润率"
          value={numeric(summary.margin, "%")}
          tone={summary.margin !== null && summary.margin < 0 ? "red" : "green"}
          icon={<BadgePercent size={18} />}
        />
        <MetricCard
          label="期间广告 ROAS"
          value={numeric(summary.roas, "x")}
          sub="归因成交额 ÷ 广告消耗"
          icon={<ChartNoAxesCombined size={18} />}
        />
      </div>
      <DashboardIntelligence allDaily={data.daily} allAdvertising={data.advertising} />
      <AiInsightPanel feature="dashboard" autoRefresh context={{ periodDays: 7, reportDays: rows.length, todaySales: Number(current.netSales), todayOrders: orders, todayAdSpend: Number(current.adSpend), periodNetSales: Number(summary.netSales), estimatedProfit: Number(summary.profit), profitMargin: summary.margin ?? "数据不足", attributedAdRevenue: Number(addMoney(ads.map(row => row.attributedSales))), adRoas: summary.roas ?? "数据不足", costIncompleteDays: rows.filter(row => row.costComplete === false).length }} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <SectionCard title="经营趋势" sub={`近 ${days} 天净销售额与估算利润`}>
          <DeferredChart label="经营趋势图表">
            <DashboardTrendChart data={trend(rows, ads)} />
          </DeferredChart>
        </SectionCard>
        <SectionCard title="商品销售排行" sub={`近 ${days} 天各商品录入销售额`}>
          <div className="space-y-5 pt-1">
            {ranking.map((row, index) => (
              <div key={row.product.id} className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--mc-tint-blue)] text-xs font-bold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate font-medium">
                      {row.product.name}
                    </span>
                    <span className="number font-semibold">
                      {formatMoney(row.value)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--mc-tint-blue)]">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Number(ranking[0]?.value) > 0 ? (Number(row.value) / Number(ranking[0].value)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
      <OperationsExceptionCenter />
      <OperationsWidget />
    </>
  );
}
