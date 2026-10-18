"use client";
import { useState } from "react";
import Link from "next/link";
import Decimal from "decimal.js";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
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
import { AiInsightPanel } from "@/components/ai-insight-panel";
import { financialSummary, formatMoney, addMoney } from "@/lib/finance";
import { numeric, periodRows, storeToday, trend } from "@/lib/analytics";
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
  const alerts: string[] = [];
  if (rows.some(row => row.costComplete === false)) alerts.push("部分经营日期缺少可靠成本，利润为不完整估算");
  if (summary.margin !== null && summary.margin < data.settings.marginAlert)
    alerts.push(
      `近 ${days} 天利润率 ${summary.margin}% 低于预警阈值 ${data.settings.marginAlert}%`,
    );
  if (!todayRows.length) alerts.push("今日尚未录入经营数据");
  if (
    todayAds.some(
      (ad) => Number(ad.spend) > 0 && Number(ad.attributedSales) === 0,
    )
  )
    alerts.push("今日广告有消耗，但未录入归因成交额");
  if (!alerts.length) alerts.push("当前没有需要处理的经营异常");
  return (
    <>
      <PageHead
        eyebrow="OVERVIEW / 经营总览"
        title="早上好，今天的生意一目了然"
        description="从销售、推广到利润，掌握店铺经营节奏。"
        action={
          <div className="flex items-center gap-2 rounded-xl border border-[#e4edf5] bg-white p-1">
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
      <section className="mb-5 overflow-hidden rounded-[22px] border border-[#e2ebf4] bg-white shadow-[0_10px_34px_rgba(41,76,108,0.065)]">
        <div className="grid gap-5 p-5 md:grid-cols-[1.45fr_1fr] md:items-center md:px-6 md:py-5">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#eff7ff] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#5286b5]"><span className="size-1.5 rounded-full bg-[#3b91eb]" />近 {days} 天经营快照</span>
            <h2 className="mt-2.5 text-[20px] font-semibold tracking-[-.035em] text-[#1e344a] md:text-[23px]">经营表现，清晰可见。</h2>
            <p className="mt-1 text-xs leading-5 text-[#8798a9]">销售、利润与经营目标集中呈现，数据更新后自动同步。</p>
            <div className="mt-4 grid max-w-[500px] grid-cols-2 gap-4">
              <div className="border-r border-[#eaf0f5] pr-3"><p className="text-[11px] text-[#8898a8]">期间净销售额</p><p className="number mt-1 text-[25px] font-semibold tracking-[-.04em] text-[#223c56] md:text-[29px]">{formatMoney(summary.netSales)}</p></div>
              <div><p className="text-[11px] text-[#8898a8]">估算经营利润</p><p className={`number mt-1 text-[23px] font-semibold tracking-[-.04em] md:text-[27px] ${Number(summary.profit)<0?"text-[#e85d65]":"text-[#168c76]"}`}>{formatMoney(summary.profit)}</p></div>
            </div>
          </div>
          <div className="rounded-[17px] border border-[#e5eff8] bg-[linear-gradient(130deg,#f5faff_0%,#eef7ff_100%)] p-4 md:p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-medium text-[#71889e]">本月销售目标</p><p className="number mt-1 text-[22px] font-semibold tracking-tight text-[#223c56]">{targetPercent ? `${targetPercent.toFixed(1)}%` : "未设置"}</p></div><span className="grid size-9 place-items-center rounded-xl bg-white text-[#438ed2] shadow-sm"><Target size={17}/></span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dcebf8]"><div className="h-full rounded-full bg-[#3b91eb] transition-[width] duration-500 motion-reduce:transition-none" style={{width:`${targetProgress}%`}}/></div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#758ba0]"><span>已完成 {formatMoney(monthSales)} / {formatMoney(data.settings.salesTarget)}</span><Link href="/data" className="inline-flex items-center gap-1 font-semibold text-[#3189e8]">经营数据 <ArrowRight size={12}/></Link></div>
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
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend(rows, ads)}
                margin={{ top: 10, right: 10, left: -13, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b91eb" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#3b91eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf3f9" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#9aabba", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#9aabba", fontSize: 11 }}
                />
                <Tooltip
                  formatter={(v, name) => [
                    formatMoney(Number(v)),
                    name === "sales" ? "净销售额" : "估算利润",
                  ]}
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid #e5edf5",
                    boxShadow: "0 10px 30px #16487715",
                  }}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b91eb"
                  strokeWidth={3}
                  fill="url(#sales-fill)"
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="profit"
                  stroke="#16a085"
                  strokeWidth={2.5}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="商品销售排行" sub={`近 ${days} 天各商品录入销售额`}>
          <div className="space-y-5 pt-1">
            {ranking.map((row, index) => (
              <div key={row.product.id} className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eef6fe] text-xs font-bold text-[#3b91eb]">
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
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ecf4fb]">
                    <div
                      className="h-full rounded-full bg-[#3b91eb]"
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
      <SectionCard
        title="经营异常提醒"
        sub="根据当前录入数据与设置阈值自动识别"
        className="mt-5"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {alerts.map((alert, index) => (
            <div
              key={alert}
              className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${alerts.length === 1 && index === 0 && alert.startsWith("当前") ? "border-[#d6efe7] bg-[#f3fbf8] text-[#16a085]" : "border-[#f8e4dc] bg-[#fff8f5] text-[#bc7657]"}`}
            >
              <AlertCircle size={18} />
              {alert}
            </div>
          ))}
        </div>
      </SectionCard>
      <OperationsWidget />
    </>
  );
}
