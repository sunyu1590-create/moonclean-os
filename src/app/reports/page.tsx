"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  CalendarDays,
  CircleCheck,
  Download,
  Lightbulb,
  Printer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { downloadText, MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { financialSummary, formatMoney } from "@/lib/finance";
import { periodRows, storeToday } from "@/lib/analytics";
import { weeklyReportInsights } from "@/lib/report-insights";
import { AiInsightPanel } from "@/components/ai-insight-panel";
import { DeferredChart } from "@/components/charts/deferred-chart";

const ReportTrendChart = dynamic(() => import("@/components/charts/report-trend-chart"));

export default function ReportsPage() {
  const { data } = useApp();
  const [days, setDays] = useState<7 | 30>(7);
  if (!data) return <p>正在准备经营报告…</p>;

  const today = storeToday(data.settings.store.timezone);
  const daily = periodRows(data.daily, days, today);
  const ads = periodRows(data.advertising, days, today);
  const summary = financialSummary(daily, ads);
  const dateRows = daily.map((row) => ({ row, ad: ads.find((ad) => ad.date === row.date) }));
  const costIncomplete = daily.some((row) => row.costComplete === false);
  const reportTitle = `${data.settings.store.name} · 近 ${days} 天经营报告`;

  const weekDaily = periodRows(data.daily, 7, today);
  const weekAds = periodRows(data.advertising, 7, today);
  const weekSummary = financialSummary(weekDaily, weekAds);
  const weeklyInsights = weeklyReportInsights(weekDaily, weekAds);
  const weekOrders = weekDaily.reduce((total, row) => total + row.orders, 0);
  const weekGross = Number(weekSummary.grossSales);
  const weekRefundRate = weekGross > 0 ? (Number(weekSummary.refunds) / weekGross) * 100 : null;
  const weeklyProductSales = new Map<string, number>();
  weekDaily.forEach((row) => Object.entries(row.productSales || {}).forEach(([productId, sales]) => {
    weeklyProductSales.set(productId, (weeklyProductSales.get(productId) || 0) + Number(sales));
  }));
  const topProducts = [...weeklyProductSales.entries()]
    .map(([id, sales]) => ({ id, sales, name: data.products.find((product) => product.id === id)?.name || "已归档商品" }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);
  const weekTrend = weekDaily.map((row) => {
    const dayAds = weekAds.filter((item) => item.date === row.date);
    const result = financialSummary([row], dayAds);
    return {
      date: row.date.slice(5).replace("-", "/"),
      净销售额: Number(result.netSales),
      广告消耗: Number(result.adSpend),
      估算利润: Number(result.profit),
    };
  });

  function exportCsv() {
    const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [
      "日期,销售额,退款,净销售额,订单数,广告消耗,广告归因成交额,广告ROAS,估算经营利润,成本完整",
      ...dateRows.map(({ row, ad }) => {
        const net = Number(row.sales) - Number(row.refunds);
        const profit = financialSummary([row], ad ? [ad] : []).profit;
        const roas = ad && Number(ad.spend) > 0
          ? (Number(ad.attributedSales) / Number(ad.spend)).toFixed(2)
          : "";
        return [
          row.date, row.sales, row.refunds, net.toFixed(2), row.orders,
          ad?.spend || "0", ad?.attributedSales || "0", roas, profit,
          row.costComplete === false ? "不完整" : "完整",
        ].map(cell).join(",");
      }),
    ];
    downloadText(`moonclean-report-${today}-${days}days.csv`, `\uFEFF${lines.join("\n")}`, "text/csv;charset=utf-8");
  }

  return (
    <>
      <PageHead
        eyebrow="BUSINESS REPORT / 经营报告"
        title="把日常数据整理成经营复盘"
        description={`${data.settings.store.name} · 截止 ${today} · 销售额、推广和估算利润统一汇总。`}
        action={<div className="flex gap-2"><Button variant="outline" onClick={exportCsv}><Download size={16} />导出 CSV</Button><Button onClick={() => window.print()}><Printer size={16} />打印 / 保存 PDF</Button></div>}
      />
      <AiInsightPanel feature="reports" context={{ periodDays: days, reportDays: daily.length, grossSales: Number(summary.grossSales), netSales: Number(summary.netSales), refunds: Number(summary.refunds), orderCount: daily.reduce((sum, row) => sum + row.orders, 0), adSpend: Number(summary.adSpend), attributedAdRevenue: ads.reduce((sum, row) => sum + Number(row.attributedSales), 0), adRoas: summary.roas ?? "数据不足", estimatedProfit: Number(summary.profit), profitMargin: summary.margin ?? "数据不足", costIncomplete }} />

      <SectionCard title="近 7 天经营快照" sub={`基于 ${weekDaily.length}/7 天经营日报 · 自动生成分析与行动建议`}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="7 天成交额" value={formatMoney(weekSummary.grossSales)} sub={`净销售 ${formatMoney(weekSummary.netSales)}`} />
          <MetricCard label="成交订单" value={`${weekOrders} 单`} sub={`日均 ${(weekOrders / Math.max(weekDaily.length, 1)).toFixed(1)} 单`} />
          <MetricCard label="广告消耗" value={formatMoney(weekSummary.adSpend)} sub={weekSummary.roas === null ? "暂无有效归因 ROAS" : `广告 ROAS ${weekSummary.roas.toFixed(2)}x`} />
          <MetricCard label="退款率" value={weekRefundRate === null ? "无法计算" : `${weekRefundRate.toFixed(2)}%`} sub={weekRefundRate === null ? "需要成交额" : `退款 ${formatMoney(weekSummary.refunds)}`} tone={weekRefundRate !== null && weekRefundRate >= 5 ? "red" : "neutral"} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">销售与推广趋势</h3><span className="text-[11px] text-muted-foreground">金额（元）</span></div>
            {weekTrend.length ? (
              <DeferredChart className="h-[240px] w-full" label="近七天销售与推广趋势图表">
                <ReportTrendChart data={weekTrend} />
              </DeferredChart>
            ) : <p className="py-12 text-center text-sm text-muted-foreground">录入经营日报后显示趋势</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-primary" />净销售额</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-secondary" />广告消耗</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[var(--mc-color-success)]" />估算利润</span></div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><Lightbulb size={17} /></span><div><h3 className="text-sm font-semibold text-foreground">本周经营建议</h3><p className="text-[11px] text-muted-foreground">依据近 7 天已录入数据生成</p></div></div>
            {weeklyInsights.map((insight, index) => {
              const style = insight.tone === "red" ? "border-border bg-[var(--mc-tint-red)]" : insight.tone === "amber" ? "border-border bg-[var(--mc-tint-orange)]" : insight.tone === "green" ? "border-border bg-[var(--mc-tint-green)]" : "border-border bg-[var(--mc-tint-blue)]";
              const icon = insight.tone === "red" ? <AlertTriangle size={15} /> : insight.tone === "green" ? <CircleCheck size={15} /> : insight.tone === "amber" ? <TrendingDown size={15} /> : <TrendingUp size={15} />;
              return <article key={`${insight.category}-${index}`} className={`rounded-xl border p-3 ${style}`}><div className="flex items-start gap-2"><span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span><div className="min-w-0"><p className="text-[10px] font-semibold tracking-wide text-muted-foreground">{insight.category}</p><h4 className="mt-0.5 text-xs font-semibold leading-5 text-foreground">{insight.title}</h4><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{insight.detail}</p><p className="mt-1.5 border-t border-black/5 pt-1.5 text-[11px] leading-5 text-muted-foreground"><span className="font-semibold">建议：</span>{insight.action}</p></div></div></article>;
            })}
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3"><h3 className="text-sm font-semibold text-foreground">商品销售贡献</h3><p className="text-[11px] text-muted-foreground">只汇总日报中已拆分到商品的金额，不与全店销售额重复相加</p></div>
          {topProducts.length ? <div className="divide-y divide-[#f0f3f6]">{topProducts.map((product, index) => <div key={product.id} className="flex items-center gap-3 px-4 py-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--mc-tint-blue)] text-xs font-semibold text-primary">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm text-foreground">{product.name}</span><span className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(product.sales)}</span><span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{weekGross > 0 ? `${(product.sales / weekGross * 100).toFixed(1)}%` : "—"}</span></div>)}</div> : <p className="px-4 py-5 text-sm text-muted-foreground">暂无商品拆分数据。补充日报商品明细后，这里会显示销售贡献排行。</p>}
        </div>
      </SectionCard>

      <div className="mb-5 mt-5 flex flex-wrap items-center gap-3"><CalendarDays size={17} className="text-[#287fe2}" /><span className="text-sm text-muted-foreground">详细报告周期</span>{([7, 30] as const).map((value) => <Button key={value} size="sm" variant={days === value ? "default" : "outline"} onClick={() => setDays(value)}>近 {value} 天</Button>)}</div>
      {costIncomplete && <p className="mb-5 rounded-2xl border border-border bg-[var(--mc-tint-orange)] p-4 text-sm text-[var(--mc-color-warning)]">所选周期有日期缺少可靠成本，利润是未完整估算。请先补齐成本再用于结算判断。</p>}

      <section id="print-report">
        <div className="mb-4 hidden print:block"><h1 className="text-2xl font-bold">{reportTitle}</h1><p className="mt-1 text-sm">报告日期：{today}</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="全店销售额" value={formatMoney(summary.grossSales)} sub={`退款调整 ${formatMoney(summary.refunds)}`} /><MetricCard label="净销售额" value={formatMoney(summary.netSales)} /><MetricCard label="广告 ROAS" value={summary.roas === null ? "无法计算" : `${summary.roas.toFixed(2)}x`} sub="广告归因成交额 ÷ 广告消耗" /><MetricCard label="估算经营利润" value={formatMoney(summary.profit)} tone={Number(summary.profit) < 0 ? "red" : "green"} sub={costIncomplete ? "成本不完整" : "基于已录入费用"} /></div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <SectionCard title="经营结论" sub={`过去 ${days} 天的数据摘要`}><div className="space-y-3 text-sm leading-6 text-muted-foreground"><p>共录入 {daily.length} 天经营数据，净销售额 {formatMoney(summary.netSales)}，估算经营利润 {formatMoney(summary.profit)}。</p><p>广告消耗 {formatMoney(summary.adSpend)}，广告归因成交额 {formatMoney(ads.reduce((sum, row) => sum + Number(row.attributedSales), 0))}。全店销售额与广告归因成交额分别计算。</p><p>{summary.margin === null ? "利润率无法计算。" : `估算经营利润率为 ${summary.margin.toFixed(2)}%。`}{costIncomplete ? " 当前周期有成本数据不完整的日期。" : ""}</p></div></SectionCard>
          <SectionCard title="每日明细" sub="可导出 CSV 进一步筛选">
            {!dateRows.length ? <p className="text-sm text-muted-foreground">当前周期暂无经营数据。</p> : <div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className="sticky top-0 bg-card text-muted-foreground"><tr><th className="py-2">日期</th><th>销售额</th><th>广告消耗</th><th>归因成交</th><th>经营利润</th></tr></thead><tbody>{dateRows.map(({ row, ad }) => <tr key={row.id} className="border-t border-border"><td className="py-2.5">{row.date}</td><td>{formatMoney(row.sales)}</td><td>{formatMoney(ad?.spend || "0")}</td><td>{formatMoney(ad?.attributedSales || "0")}</td><td className={row.costComplete === false ? "text-[var(--mc-color-warning)]" : ""}>{row.costComplete === false ? "不完整 · " : ""}{formatMoney(financialSummary([row], ad ? [ad] : []).profit)}</td></tr>)}</tbody></table></div>}
          </SectionCard>
        </div>
      </section>
      <style jsx global>{`@media print { aside, header, nav, button { display:none!important } main { max-width:none!important;padding:0!important } body { background:white!important } .glass-card { box-shadow:none!important;border-color:#ddd!important;break-inside:avoid } #print-report { color:#111 } }`}</style>
    </>
  );
}
