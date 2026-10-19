"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, ChevronDown, ClipboardPlus, Lightbulb, LoaderCircle, Sparkles } from "lucide-react";
import type { AdvertisingMetric, DailyMetric } from "@/lib/model";
import { financialSummary } from "@/lib/finance";
import { recommendationBaseline, weeklyReportInsights } from "@/lib/report-insights";
import { periodRows, storeToday } from "@/lib/analytics";
import { type OperationTask, operationsRequest } from "@/lib/operations";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";

function addDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function DashboardIntelligence({ allDaily, allAdvertising }: { allDaily: DailyMetric[]; allAdvertising: AdvertisingMetric[] }) {
  const { data, mode, activeStoreId, update } = useApp();
  const [cloudTasks, setCloudTasks] = useState<OperationTask[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const today = data ? storeToday(data.settings.store.timezone) : storeToday();
  const daily = useMemo(() => periodRows(allDaily, 7, today), [allDaily, today]);
  const advertising = useMemo(() => periodRows(allAdvertising, 7, today), [allAdvertising, today]);
  const insights = useMemo(() => weeklyReportInsights(daily, advertising), [daily, advertising]);
  const baseline = useMemo(() => recommendationBaseline(daily, advertising, today), [daily, advertising, today]);
  const summary = useMemo(() => financialSummary(daily, advertising), [daily, advertising]);
  const tasks = mode === "local" ? (data?.tasks || []) as OperationTask[] : activeStoreId ? cloudTasks : [];
  const completeCostDays = daily.filter(row => row.costComplete !== false && [row.productCost,row.packagingCost,row.logisticsCost,row.platformFees,row.otherExpenses].every(value => value !== "")).length;
  const lowStockCount = (data?.inventory || []).filter(row => row.quantity <= row.low_stock_threshold).length;
  const loadTasks = useCallback(async () => {
    if (mode === "local" || !activeStoreId) return;
    try {
      const result = await operationsRequest<{ tasks: OperationTask[] }>(activeStoreId, "tasks");
      setCloudTasks(result.tasks);
    } catch { /* The task widget below still links to the task page for retry and error details. */ }
  }, [mode, activeStoreId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTasks(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTasks]);

  async function createFollowUp(insight: (typeof insights)[number]) {
    if (!data) return;
    const existing = tasks.find(task => task.recommendation_key === insight.key && task.status !== "done");
    if (existing) return;
    setBusyKey(insight.key); setFeedback("");
    try {
      const dueDate = addDays(today, 2);
      const input = {
        title: `建议跟进：${insight.title}`.slice(0, 160),
        detail: `${insight.action}\n\n分析依据：${insight.detail}`.slice(0, 1000),
        priority: insight.tone === "red" ? "high" as const : insight.tone === "amber" ? "normal" as const : "low" as const,
        status: "todo" as const,
        dueDate,
        recommendationKey: insight.key,
        recommendationBaseline: baseline,
      };
      let saved: OperationTask;
      if (mode === "local") {
        const now = new Date().toISOString();
        saved = { id: crypto.randomUUID(), title: input.title, detail: input.detail, priority: input.priority, status: "todo", due_date: dueDate, created_at: now, updated_at: now, completed_at: null, recommendation_key: insight.key, recommendation_baseline: baseline };
        await update(current => ({ ...current, tasks: [saved, ...(current.tasks || [])] }));
      } else {
        if (!activeStoreId) throw new Error("未找到当前店铺，请重新选择云端店铺。");
        saved = await operationsRequest<OperationTask>(activeStoreId, "tasks", input, "POST");
      }
      if (mode !== "local") setCloudTasks(current => [saved, ...current.filter(task => task.id !== saved.id)]);
      setFeedback(`已创建跟进任务，将于 ${dueDate} 提醒；任务已关联本次建议基线。`);
    } catch (cause) {
      setFeedback(cause instanceof Error ? `创建失败：${cause.message}` : "创建失败，请到任务页面重试。");
    } finally { setBusyKey(null); }
  }

  const followUps = tasks.filter(task => task.recommendation_key && task.status === "done").slice(0, 2);
  const toneBorder = (tone: string) => tone === "red" ? "border-l-[#e85d65]" : tone === "amber" ? "border-l-[#e1a54e]" : tone === "green" ? "border-l-[#16a085]" : "border-l-[#3b91eb]";
  const ended = (completed: string) => addDays(completed.slice(0, 10), 7);
  const elapsed = (completed: string) => Math.max(0, Math.min(7, Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${completed.slice(0,10)}T12:00:00Z`)) / 86400000)));

  return (
    <section aria-labelledby="intelligence-title" className="mt-4 overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_8px_28px_rgba(35,74,108,0.055)] md:mt-5 md:rounded-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 md:px-6 md:py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary md:size-10 md:rounded-[14px]"><Bot size={18}/><Sparkles size={9} className="absolute -right-1 -top-1 text-[var(--mc-color-warning)]"/></span>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><h2 id="intelligence-title" className="text-sm font-semibold tracking-tight text-foreground md:text-[15px]">智能经营建议</h2><span className="rounded-full bg-[var(--mc-tint-blue)] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">近 7 天</span></div><p className="mt-0.5 text-[10px] text-muted-foreground md:text-xs">根据已录入的日报、成本和推广数据进行规则分析</p></div>
        </div>
        <Link href="/reports" className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary md:text-xs">完整分析 <ArrowRight size={13}/></Link>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-border bg-[var(--mc-tint-blue)] px-4 py-2.5 sm:grid-cols-4 md:px-5">
        <div className="text-[10px] text-muted-foreground">日报覆盖 <strong className="ml-1 text-xs text-foreground">{new Set(daily.map(row => row.date)).size}/7 天</strong></div>
        <div className="text-[10px] text-muted-foreground">成本完整 <strong className="ml-1 text-xs text-foreground">{completeCostDays}/{daily.length || 0} 天</strong></div>
        <div className="text-[10px] text-muted-foreground">经营利润 <strong className={`ml-1 text-xs ${Number(summary.profit)<0?"text-[var(--mc-color-danger)]":"text-[var(--mc-color-success)]"}`}>{daily.length?`¥${summary.profit}`:"待录入"}</strong></div>
        <div className="text-[10px] text-muted-foreground">广告 ROAS <strong className="ml-1 text-xs text-foreground">{summary.roas===null?"—":`${summary.roas.toFixed(2)}x`}</strong></div>
      </div>

      {lowStockCount > 0 && <Link href="/inventory" className="flex items-center justify-between gap-3 border-b border-border bg-[var(--mc-tint-orange)] px-4 py-2 text-[11px] text-[var(--mc-color-warning)] transition-colors hover:bg-[var(--mc-tint-orange)] md:px-5">
        <span><strong>{lowStockCount} 个 SKU</strong> 已达到库存预警线，建议确认补货计划。</span><span className="shrink-0 font-semibold">查看库存 <ArrowRight size={12} className="ml-1 inline"/></span>
      </Link>}

      <div className="space-y-2 p-3 md:space-y-2.5 md:p-5">
        {insights.slice(0, 4).map((item, index) => {
          const openTask = tasks.find(task => task.recommendation_key === item.key && task.status !== "done");
          const completedTask = tasks.find(task => task.recommendation_key === item.key && task.status === "done");
          const isOpen = expanded === item.key;
          return <article key={item.key} className={`insight-row-enter rounded-[14px] border border-border border-l-[3px] ${toneBorder(item.tone)} bg-[var(--mc-tint-blue)]`} style={{ animationDelay: `${index * 45}ms` }}>
            <div className="flex items-center gap-2.5 px-3 py-2.5 md:gap-3 md:px-4 md:py-3">
              <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : item.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-card text-[var(--mc-color-warning)] ring-1 ring-[#edf1f5]"><Lightbulb size={14}/></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-medium text-muted-foreground">{item.category}</span><span className="block truncate text-xs font-semibold leading-5 text-foreground md:text-sm">{item.title}</span></span>
                <ChevronDown size={15} className={`shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${isOpen?"rotate-180":""}`}/>
              </button>
              {openTask ? <Link href="/tasks" className="shrink-0 rounded-lg bg-[var(--mc-tint-green)] px-2 py-1.5 text-[10px] font-semibold text-[var(--mc-color-success)]">{openTask.status === "doing" ? "处理中" : "已转待办"}</Link> : completedTask ? <Link href="/tasks" className="shrink-0 rounded-lg bg-[var(--mc-tint-blue)] px-2 py-1.5 text-[10px] font-semibold text-muted-foreground">上次已完成</Link> : <Button size="sm" variant="outline" disabled={busyKey===item.key} className="h-8 shrink-0 gap-1 px-2 text-[10px] md:px-3 md:text-xs" onClick={() => void createFollowUp(item)}>{busyKey===item.key?<LoaderCircle size={13} className="animate-spin"/>:<ClipboardPlus size={13}/>}<span className="hidden min-[380px]:inline">转为待办</span><span className="min-[380px]:hidden">建任务</span></Button>}
            </div>
            {isOpen && <div className="insight-details border-t border-border px-3 py-3 md:px-4"><p className="text-xs leading-5 text-muted-foreground">{item.detail}</p><p className="mt-2 text-xs leading-5 text-muted-foreground"><strong>建议行动：</strong>{item.action}</p>{openTask&&<p className="mt-2 text-[11px] font-medium text-[var(--mc-color-success)]">待办「{openTask.title}」{openTask.due_date?` · 截止 ${openTask.due_date}`:""}</p>}{completedTask&&<p className="mt-2 text-[11px] font-medium text-muted-foreground">该建议已完成，复盘结果见下方。</p>}</div>}
          </article>;
        })}
      </div>

      {feedback && <p role="status" className={`mx-3 mb-3 rounded-xl px-3 py-2 text-xs md:mx-5 ${feedback.startsWith("创建失败")?"bg-[var(--mc-tint-red)] text-[var(--mc-color-danger)]":"bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]"}`}>{feedback}</p>}
      {followUps.length > 0 && <div className="border-t border-border px-4 py-3 md:px-5">
        <h3 className="mb-2 text-xs font-semibold text-muted-foreground">已完成建议 · 效果复盘</h3>
        <div className="grid gap-2 sm:grid-cols-2">{followUps.map(task => {
          const completeDate = task.completed_at || task.updated_at;
          const baselineValue = task.recommendation_baseline;
          const days = elapsed(completeDate);
          const finishDate = ended(completeDate);
          const afterRows = periodRows(allDaily, 7, finishDate).filter(row => row.date > completeDate.slice(0,10) && row.date <= today);
          const afterAds = periodRows(allAdvertising, 7, finishDate).filter(row => row.date > completeDate.slice(0,10) && row.date <= today);
          const after = financialSummary(afterRows, afterAds);
          const reachedEnd = today >= finishDate;
          const afterCoverage = new Set(afterRows.map(row => row.date)).size;
          const hasFullFollowUp = reachedEnd && afterCoverage === 7;
          return <div key={task.id} className="rounded-xl border border-border bg-[var(--mc-tint-green)] p-3"><p className="truncate text-xs font-semibold text-foreground">{task.title.replace(/^建议跟进：/,"")}</p>{baselineValue&&days>0?<><p className="mt-1 text-[10px] text-muted-foreground">建议前利润 ¥{baselineValue.profit} · 完成后利润 {hasFullFollowUp?`¥${after.profit}`:"待补齐日报"}</p><p className="mt-1 text-[10px] text-[var(--mc-color-success)]">{hasFullFollowUp?`完成后 7 天净销售 ${Number(after.netSales)>=Number(baselineValue.net_sales)?"上升":"下降"} ¥${Math.abs(Number(after.netSales)-Number(baselineValue.net_sales)).toFixed(2)}`:reachedEnd?`后续日报已录 ${afterCoverage}/7 天，数据不足，暂不判断效果`:`已过 ${days} 天，后续日报已录 ${afterCoverage}/7 天，继续记录后复盘`}</p></>:<p className="mt-1 text-[10px] text-muted-foreground">建议已完成，待录入后续经营日报以生成效果对比。</p>}</div>;
        })}</div>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-[var(--mc-tint-blue)] px-4 py-2.5 text-[10px] text-muted-foreground md:px-6 md:py-3 md:text-[11px]">
        <span>规则分析 · 数据覆盖 {new Set(daily.map(row=>row.date)).size}/7 天 · {completeCostDays<daily.length?"成本尚未完整":"成本已完整"}</span>
        <Link href="/tasks" className="font-semibold text-primary">查看全部待办</Link>
      </div>
    </section>
  );
}
