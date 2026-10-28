"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, CalendarClock, Check, ChevronRight, Clock3, FileClock, RefreshCw } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { DeferredChart } from "@/components/charts/deferred-chart";
import { financialSummary, formatMoney } from "@/lib/finance";
import { isDailyCostComplete, dailySourceLabel } from "@/lib/operating-review";
import { storeToday } from "@/lib/analytics";
import { readLocalBusinessRevisions, type BusinessRevision } from "@/lib/business-history";
import type { AdvertisingMetric, DailyMetric } from "@/lib/model";

const HistoryTrendChart = dynamic(() => import("@/components/charts/history-trend-chart"));
const dayMs = 86_400_000;
const MAX_RANGE_DAYS = 366;

type HistoryRow = {
  date: string;
  daily: DailyMetric | null;
  advertising: AdvertisingMetric | null;
};

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dayCount(from: string, to: string) {
  if (!from || !to) return 0;
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs) + 1;
}

const valueLabels: Record<string, string> = {
  metric_date: "经营日期", date: "经营日期", effective_from: "生效日期", gross_sales: "销售额", sales: "销售额", refunds: "退款金额", refund_amount: "退款金额", order_count: "订单数", orders: "订单数",
  other_expenses: "其他费用", otherExpenses: "其他费用", product_cost: "商品成本", productCost: "商品成本", packaging_cost: "包装费用", packagingCost: "包装费用",
  shipping_cost: "物流费用", logisticsCost: "物流费用", platform_fee: "平台费用", platformFees: "平台费用", production: "生产成本", packaging: "包装费用", logistics: "物流费用", platform: "平台费用", cost_source: "成本来源", costSource: "成本来源",
  advertising_spend: "推广消耗", spend: "推广消耗", attributed_revenue: "归因成交额", attributedSales: "归因成交额", net_attributed_revenue: "净归因成交额", netAttributedSales: "净归因成交额",
  attributed_orders: "归因订单数", attributedOrders: "归因订单数", quantity_sold: "销量", quantitySold: "销量", sku_id: "商品 SKU", skuId: "商品 SKU", data_source: "数据来源", source: "数据来源", is_demo: "模拟数据标记", isDemo: "模拟数据标记",
  report_details: "报表补充指标", reportDetails: "报表补充指标",
};

const metricLabels: Record<BusinessRevision["metric_type"], string> = {
  daily: "经营日报", advertising: "推广日报", sku_daily: "SKU 日销量", sku_cost: "SKU 成本版本",
};

function displayRevisionValue(value: unknown, key?: string, skuNames?: Map<string, string>) {
  if (value === null || value === undefined || value === "") return "未填写";
  if (typeof value === "boolean") return value ? "是" : "否";
  if ((key === "sku_id" || key === "skuId") && typeof value === "string") return skuNames?.get(value) || value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function revisionTitle(action: BusinessRevision["action"]) {
  return action === "baseline" ? "启用历史记录时已有数据" : action === "insert" ? "新增记录" : action === "update" ? "修改记录" : "删除记录";
}

function revisionChanges(revision: BusinessRevision, skuNames: Map<string, string>) {
  const before = revision.before_values || {};
  const after = revision.after_values || {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !["id", "store_id", "created_at", "updated_at"].includes(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key])).map((key) => ({
    label: valueLabels[key] || key,
    before: displayRevisionValue(before[key], key, skuNames),
    after: displayRevisionValue(after[key], key, skuNames),
  }));
}

export default function BusinessHistoryPage() {
  const { data, mode, activeStoreId } = useApp();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [revisions, setRevisions] = useState<BusinessRevision[]>([]);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!data || from) return;
    const today = storeToday(data.settings.store.timezone);
    queueMicrotask(() => {
      setFrom(shiftDate(today, -29));
      setTo(today);
      setSelectedDate(today);
    });
  }, [data, from]);

  useEffect(() => {
    if (!selectedDate || !from || !to || selectedDate < from || selectedDate > to) return;
    if (mode === "local") {
      if (activeStoreId) queueMicrotask(() => {
        setRevisions(readLocalBusinessRevisions(activeStoreId, selectedDate, selectedDate));
        setTruncated(false);
      });
      return;
    }
    if (!activeStoreId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setRevisionLoading(true);
      setError("");
      setTruncated(false);
    });
    const query = new URLSearchParams({ from, to, revisionsFor: selectedDate });
    fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/history?${query}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "历史版本读取失败");
        setRevisions(result.revisions as BusinessRevision[]);
        setTruncated(Boolean(result.truncated));
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "历史版本读取失败"); })
      .finally(() => { if (!controller.signal.aborted) setRevisionLoading(false); });
    return () => controller.abort();
  }, [mode, activeStoreId, from, to, selectedDate, refreshKey]);

  const rangeValid = Boolean(from && to && from <= to && dayCount(from, to) <= MAX_RANGE_DAYS);
  const daily = useMemo(() => data?.daily.filter((row) => rangeValid && row.date >= from && row.date <= to) || [], [data?.daily, from, to, rangeValid]);
  const advertising = useMemo(() => data?.advertising.filter((row) => rangeValid && row.date >= from && row.date <= to) || [], [data?.advertising, from, to, rangeValid]);
  const dailyByDate = useMemo(() => new Map(daily.map((row) => [row.date, row])), [daily]);
  const adsByDate = useMemo(() => new Map(advertising.map((row) => [row.date, row])), [advertising]);
  const expectedDates = useMemo(() => {
    if (!rangeValid) return [];
    return Array.from({ length: dayCount(from, to) }, (_, index) => shiftDate(to, -index));
  }, [from, to, rangeValid]);
  const dayRows: HistoryRow[] = useMemo(() => expectedDates.map((date) => ({ date, daily: dailyByDate.get(date) || null, advertising: adsByDate.get(date) || null })), [expectedDates, dailyByDate, adsByDate]);
  const summary = useMemo(() => financialSummary(daily, advertising), [daily, advertising]);
  const reportDays = new Set(daily.map((row) => row.date)).size;
  const adDays = new Set(advertising.map((row) => row.date)).size;
  const costIncompleteDays = daily.filter((row) => !isDailyCostComplete(row)).length;
  const selected = dayRows.find((row) => row.date === selectedDate);
  const skuNames = useMemo(() => new Map((data?.products || []).flatMap((product) => product.skus.map((sku) => [sku.id, `${product.name} · ${sku.name}`] as const))), [data?.products]);
  const trendData = [...dayRows].reverse().map((row) => {
    const oneDay = row.daily ? financialSummary([row.daily], row.advertising ? [row.advertising] : []) : null;
    return {
      date: row.date.slice(5).replace("-", "/"),
      netSales: oneDay ? Number(oneDay.netSales) : null,
      adSpend: row.advertising ? Number(row.advertising.spend) : null,
      profit: oneDay && row.daily && isDailyCostComplete(row.daily) ? Number(oneDay.profit) : null,
    };
  });

  function chooseDays(days: number) {
    const today = data ? storeToday(data.settings.store.timezone) : to;
    const nextFrom = shiftDate(today, -(days - 1));
    setFrom(nextFrom);
    setTo(today);
    setSelectedDate(today);
  }

  function chooseMonth() {
    const today = data ? storeToday(data.settings.store.timezone) : to;
    setFrom(`${today.slice(0, 7)}-01`);
    setTo(today);
    setSelectedDate(today);
  }

  function applyFrom(value: string) {
    setFrom(value);
    setSelectedDate(value > to ? value : to);
  }

  function applyTo(value: string) {
    setTo(value);
    setSelectedDate(value);
  }

  if (!data) return <p>正在加载历史经营数据…</p>;
  const actions: BusinessRevision[] = revisions.filter((row) => row.business_date === selectedDate).sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <>
      <PageHead eyebrow="BUSINESS HISTORY / 历史经营" title="按天查看经营记录" description="从单日明细到日期区间，查看已录入经营数据、数据覆盖和修改历史。" action={<Button variant="outline" disabled={!rangeValid || revisionLoading} onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={15} className={revisionLoading ? "animate-spin" : ""}/>刷新历史</Button>} />

      <SectionCard title="选择日期范围" sub="日期按当前店铺时区解释；范围内的汇总只统计已有记录。">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => chooseDays(1)}>今天</Button>
          <Button size="sm" variant="outline" onClick={() => { const today = data ? storeToday(data.settings.store.timezone) : to; const yesterday = shiftDate(today, -1); setFrom(yesterday); setTo(yesterday); setSelectedDate(yesterday); }}>昨天</Button>
          <Button size="sm" variant="outline" onClick={() => chooseDays(7)}>近 7 天</Button>
          <Button size="sm" variant="outline" onClick={() => chooseDays(30)}>近 30 天</Button>
          <Button size="sm" variant="outline" onClick={chooseMonth}>本月</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">开始日期<input aria-label="历史开始日期" type="date" value={from} max={to || undefined} onChange={(event) => applyFrom(event.target.value)} className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground"/></label>
          <span className="pb-3 text-xs text-muted-foreground">至</span>
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">结束日期<input aria-label="历史结束日期" type="date" value={to} min={from || undefined} onChange={(event) => applyTo(event.target.value)} className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground"/></label>
          <span className="pb-2 text-xs text-muted-foreground">最多查询 {MAX_RANGE_DAYS} 天</span>
        </div>
      </SectionCard>

      {!rangeValid && from && to && <p role="alert" className="mt-4 rounded-xl border border-border bg-[var(--mc-tint-orange)] p-3 text-sm text-[var(--mc-color-warning)]">日期范围无效或超过 {MAX_RANGE_DAYS} 天，请缩短范围后查看。</p>}
      {error && <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-[var(--mc-tint-red)] p-3 text-sm text-[var(--mc-color-danger)]"><AlertCircle size={16}/>{error}</p>}
      {truncated && <p className="mt-4 rounded-xl border border-border bg-[var(--mc-tint-orange)] p-3 text-sm text-muted-foreground">记录数量较多，当前范围已达到读取上限。请缩小日期范围查看完整明细。</p>}

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="净销售额" value={formatMoney(summary.netSales)} sub={`${reportDays} / ${dayCount(from, to)} 天有日报`} icon={<CalendarClock size={17}/>} />
        <MetricCard label="退款金额" value={formatMoney(summary.refunds)} sub={`成交额 ${formatMoney(summary.grossSales)}`} />
        <MetricCard label="推广消耗" value={formatMoney(summary.adSpend)} sub={`${adDays} / ${dayCount(from, to)} 天有推广记录`} />
        <MetricCard label="估算经营利润" value={formatMoney(summary.profit)} sub={costIncompleteDays ? `${costIncompleteDays} 天成本信息不完整` : "所录入日报成本完整"} tone={costIncompleteDays ? "neutral" : Number(summary.profit) < 0 ? "red" : "green"} />
      </div>
      {(reportDays < dayCount(from, to) || adDays < dayCount(from, to) || costIncompleteDays > 0) && rangeValid && <p className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-[var(--mc-tint-blue)] p-3 text-xs leading-5 text-muted-foreground"><AlertCircle size={15} className="mt-0.5 shrink-0 text-primary"/>当前范围有 {reportDays} 天日报记录、{adDays} 天推广记录{costIncompleteDays ? `；其中 ${costIncompleteDays} 天成本不完整，利润仅为不完整估算` : ""}。未录入的日期不会按零值计入。</p>}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <SectionCard title="逐日趋势" sub="缺少日报的日期会留空；成本不完整的日期不绘制利润线。">
          {daily.length || advertising.length ? <>
            <DeferredChart className="h-[260px] w-full" label="历史经营每日趋势图">
              <HistoryTrendChart data={trendData}/>
            </DeferredChart>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[var(--chart-1)]"/>净销售额</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[var(--chart-4)]"/>推广消耗</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[var(--chart-2)]"/>估算利润</span></div>
          </> : <p className="py-12 text-center text-sm text-muted-foreground">所选日期范围暂无经营或推广记录。</p>}
        </SectionCard>

        <SectionCard title="每日记录" sub={`${from} 至 ${to} · 选择日期查看明细与修改历史`}>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1" aria-label="历史每日记录">
            {dayRows.map((row) => {
              const active = row.date === selectedDate;
              const result = row.daily ? financialSummary([row.daily], row.advertising ? [row.advertising] : []) : null;
              return <button type="button" key={row.date} onClick={() => setSelectedDate(row.date)} aria-pressed={active} className={`w-full rounded-xl border p-3 text-left transition-colors ${active ? "border-primary/35 bg-[var(--mc-tint-blue)]" : "border-border bg-card hover:bg-[var(--mc-tint-blue)]/50"}`}>
                <span className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-foreground">{row.date}{row.date === storeToday(data.settings.store.timezone) ? " · 今天" : ""}</span><span className="flex items-center gap-1 text-[10px] text-muted-foreground">{row.daily ? <><Check size={12} className="text-[var(--mc-color-success)]"/>日报已录入</> : "未录入日报"}<ChevronRight size={13}/></span></span>
                {row.daily || row.advertising ? <span className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-muted-foreground sm:grid-cols-4"><span>净销售 {row.daily ? formatMoney(Number(row.daily.sales) - Number(row.daily.refunds)) : "—"}</span><span>订单 {row.daily ? `${row.daily.orders} 单` : "未记录"}</span><span>推广 {row.advertising ? formatMoney(row.advertising.spend) : "未记录"}</span><span>估算利润 {result && row.daily && isDailyCostComplete(row.daily) ? formatMoney(result.profit) : "数据不完整"}</span></span> : <span className="mt-2 block text-[10px] text-muted-foreground">该日没有日报或推广记录，未按零值计入。</span>}
                {row.daily && <span className="mt-2 block text-[10px] text-muted-foreground">来源：{dailySourceLabel(row.daily)}{!isDailyCostComplete(row.daily) ? " · 成本不完整" : ""}</span>}
              </button>;
            })}
            {!dayRows.length && <p className="py-8 text-center text-sm text-muted-foreground">请选择有效日期范围。</p>}
          </div>
        </SectionCard>
      </div>

      <SectionCard title={selectedDate ? `${selectedDate} · 当日详情` : "当日详情"} sub="汇总口径按所选日期的已录入数据计算。" className="mt-5">
        {!selected ? <p className="py-4 text-sm text-muted-foreground">选择日期后显示当天数据。</p> : <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="成交额" value={selected.daily ? formatMoney(selected.daily.sales) : "未录入"} sub={selected.daily ? `退款 ${formatMoney(selected.daily.refunds)}` : "无日报记录"}/>
            <MetricCard label="订单数" value={selected.daily ? `${selected.daily.orders} 单` : "未录入"} sub={selected.daily ? "以当日日报为准" : "无日报记录"}/>
            <MetricCard label="广告归因成交额" value={selected.advertising ? formatMoney(selected.advertising.attributedSales) : "未记录"} sub={selected.advertising ? `ROAS ${Number(selected.advertising.spend) > 0 ? (Number(selected.advertising.attributedSales) / Number(selected.advertising.spend)).toFixed(2) : "—"}x` : "无推广记录"}/>
            <MetricCard label="当日估算利润" value={selected.daily ? formatMoney(financialSummary([selected.daily], selected.advertising ? [selected.advertising] : []).profit) : "未录入"} sub={!selected.daily ? "无日报记录" : isDailyCostComplete(selected.daily) ? "基于已录入费用估算" : "成本不完整，结果仅供参考"} tone={selected.daily && Number(financialSummary([selected.daily], selected.advertising ? [selected.advertising] : []).profit) < 0 ? "red" : "green"}/>
          </div>
          <div className="mt-4 rounded-xl border border-border bg-[var(--mc-tint-blue)]/45 p-3 text-xs leading-5 text-muted-foreground">
            {selected.daily ? `日报来源：${dailySourceLabel(selected.daily)}；成本来源：${selected.daily.costSource === "sku" ? "按 SKU 计算" : "日报录入"}；成本字段${isDailyCostComplete(selected.daily) ? "完整" : "不完整"}。` : "当天没有经营日报。"}
            {selected.advertising ? ` 推广来源：${selected.advertising.source === "image_import" ? "截图识别" : selected.advertising.source === "csv_import" ? "CSV 导入" : selected.advertising.source === "mock_pinduoduo" ? "模拟数据" : selected.advertising.source === "official_pinduoduo" ? "平台同步" : "手工录入"}。` : " 当天没有推广记录；未将其视为零消耗。"}
          </div>
        </>}
        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-2"><FileClock size={16} className="text-primary"/><h3 className="text-sm font-semibold text-foreground">数据修改历史</h3><span className="text-[10px] text-muted-foreground">按所选日期记录</span></div>
          {revisionLoading ? <p className="py-3 text-xs text-muted-foreground">正在读取修改历史…</p> : actions.length ? <div className="space-y-2">{actions.map((revision) => {
            const changes = revisionChanges(revision, skuNames);
            return <details key={revision.id} className="rounded-xl border border-border bg-card px-3 py-2.5"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs"><Clock3 size={14} className="shrink-0 text-muted-foreground"/><span className="flex-1 font-medium text-foreground">{metricLabels[revision.metric_type]} · {revisionTitle(revision.action)}</span><span className="text-[10px] text-muted-foreground">{new Date(revision.created_at).toLocaleString("zh-CN", { hour12: false })}</span></summary>
              <div className="mt-2 space-y-1 pl-5">{revision.action === "baseline" && <p className="mb-1 text-[11px] text-muted-foreground">此记录在历史功能启用时已经存在；启用前的修改版本无法从当前数据还原。</p>}{changes.length ? changes.map((change) => <p key={change.label} className="text-[11px] leading-5 text-muted-foreground"><span className="font-medium text-foreground">{change.label}：</span>{revision.action === "baseline" || revision.action === "insert" ? change.after : revision.action === "delete" ? change.before : `${change.before} → ${change.after}`}</p>) : <p className="text-[11px] text-muted-foreground">记录状态已变更。</p>}<p className="pt-1 text-[10px] text-muted-foreground">操作人：{revision.changed_by ? "店铺成员" : "平台同步或系统迁移"}</p></div>
            </details>;
          })}</div> : <p className="py-2 text-xs text-muted-foreground">该日期尚无修改历史。历史功能启用后发生的修改会自动记录。</p>}
        </div>
      </SectionCard>

      <p className="mt-3 flex items-start gap-2 px-1 text-[10px] leading-4 text-muted-foreground"><Clock3 size={13} className="mt-0.5 shrink-0"/>修改历史从本功能启用时开始；启用前已有记录会标注为初始数据，无法还原更早的修改版本。</p>
    </>
  );
}
