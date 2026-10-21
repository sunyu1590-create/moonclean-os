"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardPlus, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { AiInsightPanel } from "@/components/ai-insight-panel";
import { Button } from "@/components/ui/button";
import { storeToday } from "@/lib/analytics";
import { financialSummary } from "@/lib/finance";
import { buildOperationExceptions, operationExceptionCounts, type OperationException } from "@/lib/operations-exceptions";
import { type InventoryBalance, type OperationTask, operationsRequest } from "@/lib/operations";

type InventorySnapshot = { balances: InventoryBalance[]; movements: { id: string }[] };
const severityLabel = { critical: "优先处理", warning: "需要关注", info: "数据提示" } as const;
const severityStyle = {
  critical: "border-[var(--mc-color-danger)]/25 bg-[var(--mc-tint-red)] text-[var(--mc-color-danger)]",
  warning: "border-[var(--mc-color-warning)]/25 bg-[var(--mc-tint-orange)] text-[var(--mc-color-warning)]",
  info: "border-border bg-[var(--mc-tint-blue)] text-primary",
} as const;
const emptyInventory: InventoryBalance[] = [];
const emptyTasks: OperationTask[] = [];

export function OperationsExceptionCenter() {
  const { data, mode, activeStoreId, role, update } = useApp();
  const [cloudInventory, setCloudInventory] = useState<InventoryBalance[]>([]);
  const [cloudTasks, setCloudTasks] = useState<OperationTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ key: string; message: string; error?: boolean } | null>(null);
  const today = data ? storeToday(data.settings.store.timezone) : storeToday();
  const loadCloudOperations = useCallback(async () => {
    if (mode !== "cloud") return;
    if (!activeStoreId) { setCloudInventory([]); setCloudTasks([]); return; }
    setCloudInventory([]); setCloudTasks([]);
    setLoading(true); setSyncError("");
    const [inventoryResult, tasksResult] = await Promise.allSettled([
      operationsRequest<InventorySnapshot>(activeStoreId, "inventory"),
      operationsRequest<{ tasks: OperationTask[] }>(activeStoreId, "tasks"),
    ]);
    if (inventoryResult.status === "fulfilled") setCloudInventory(inventoryResult.value.balances);
    if (tasksResult.status === "fulfilled") setCloudTasks(tasksResult.value.tasks);
    const failure = inventoryResult.status === "rejected" ? inventoryResult.reason : tasksResult.status === "rejected" ? tasksResult.reason : null;
    if (failure) setSyncError(failure instanceof Error ? failure.message : "待办或库存风险读取失败。可点击刷新重试。");
    setLoading(false);
  }, [activeStoreId, mode]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadCloudOperations(); }, 0); return () => window.clearTimeout(timer); }, [loadCloudOperations]);

  const inventory = mode === "local" ? (data?.inventory || emptyInventory) as InventoryBalance[] : cloudInventory;
  const tasks = mode === "local" ? (data?.tasks || emptyTasks) as OperationTask[] : cloudTasks;
  const exceptions = useMemo(() => data ? buildOperationExceptions(data, inventory, tasks, today) : [], [data, inventory, tasks, today]);
  const aiContext = useMemo(() => {
    if (!data) return {};
    const counts = operationExceptionCounts(exceptions, data, inventory, tasks, today);
    const start = new Date(`${today}T12:00:00Z`); start.setUTCDate(start.getUTCDate() - 6);
    const from = start.toISOString().slice(0, 10);
    const week = data.daily.filter((row) => row.date >= from && row.date <= today);
    const gross = week.reduce((sum, row) => sum + Number(row.sales || 0), 0);
    const refunds = week.reduce((sum, row) => sum + Number(row.refunds || 0), 0);
    const refundRate = gross > 0 ? Number((refunds / gross * 100).toFixed(2)) : "数据不足" as const;
    const summary = financialSummary(week, data.advertising.filter((row) => row.date >= from && row.date <= today));
    return { ...counts, estimatedProfit: counts.missingCostDays > 0 ? "成本数据不足" as const : Number(summary.profit), profitMargin: counts.missingCostDays > 0 ? "成本数据不足" as const : summary.margin ?? "数据不足", adRoas: summary.roas ?? "数据不足", breakEvenRoas: summary.breakEvenRoas ?? "成本数据不足", refundRate };
  }, [data, exceptions, inventory, tasks, today]);

  async function createTask(item: OperationException) {
    if (!data || busyKey) return;
    const recommendationKey = `operation_exception_${item.key}`;
    const existing = tasks.find((task) => task.recommendation_key === recommendationKey && task.status !== "done");
    if (existing) return;
    setBusyKey(item.key); setFeedback(null);
    try {
      const offset = item.severity === "critical" ? 1 : item.severity === "warning" ? 3 : 7;
      const due = new Date(`${today}T12:00:00Z`); due.setUTCDate(due.getUTCDate() + offset);
      const dueDate = due.toISOString().slice(0, 10);
      const input = { title: item.title.slice(0, 160), detail: `${item.evidence}\n\n建议行动：${item.action}`.slice(0, 1000), priority: item.severity === "critical" ? "high" as const : item.severity === "warning" ? "normal" as const : "low" as const, status: "todo" as const, dueDate, recommendationKey };
      let created: OperationTask;
      if (mode === "local") {
        const now = new Date().toISOString();
        created = { ...input, id: crypto.randomUUID(), due_date: dueDate, created_at: now, updated_at: now, completed_at: null, recommendation_key: recommendationKey };
        await update((current) => ({ ...current, tasks: [created, ...(current.tasks || [])] }));
      } else {
        if (!activeStoreId) throw new Error("未找到当前云端店铺，请重新选择店铺。");
        created = await operationsRequest<OperationTask>(activeStoreId, "tasks", input, "POST");
        setCloudTasks((current) => [created, ...current.filter((task) => task.id !== created.id)]);
      }
      setFeedback({ key: item.key, message: `已转为待办，截止 ${dueDate}。` });
    } catch (cause) {
      setFeedback({ key: item.key, error: true, message: cause instanceof Error ? cause.message : "创建待办失败，请重试。" });
    } finally { setBusyKey(null); }
  }

  const canEdit = mode === "local" || role !== "viewer";
  return <>
    <section aria-labelledby="exception-center-title" className="mt-5 overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_8px_28px_rgba(35,74,108,0.055)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[var(--mc-tint-orange)] text-[var(--mc-color-warning)]"><ShieldAlert size={19}/></span><div><h2 id="exception-center-title" className="text-sm font-semibold tracking-tight text-foreground md:text-base">经营异常中心</h2><p className="mt-1 text-[11px] leading-5 text-muted-foreground">规则根据现有数据实时检查；每项都可查看依据并转为待办。</p></div></div>
        <div className="flex items-center gap-2"><span className="rounded-full bg-[var(--mc-tint-blue)] px-2.5 py-1 text-xs font-medium text-muted-foreground">{exceptions.length ? `${exceptions.length} 项待处理` : "运行正常"}</span><Button type="button" size="sm" variant="outline" onClick={() => void loadCloudOperations()} disabled={loading || mode !== "cloud"}><RefreshCw size={14} className={loading ? "animate-spin" : ""}/>刷新</Button></div>
      </div>
      <div className="px-3 py-3 md:px-5">
        {syncError && <p role="alert" className="mb-3 rounded-xl bg-[var(--mc-tint-orange)] p-3 text-xs text-[var(--mc-color-warning)]">{syncError} 部分云端风险项可能暂未显示。</p>}
        {loading && mode === "cloud" && <p className="mb-3 text-xs text-muted-foreground">正在读取云端库存和运营待办…</p>}
        {!exceptions.length ? <div className="flex items-center gap-3 rounded-xl bg-[var(--mc-tint-green)] p-4 text-sm text-[var(--mc-color-success)]"><CheckCircle2 size={18}/>当前已录入数据中未发现需要处理的异常。建议持续维护日报、成本和库存，以获得完整检查结果。</div> : <div className="space-y-2.5">{exceptions.map((item) => {
          const openTask = tasks.find((task) => task.recommendation_key === `operation_exception_${item.key}` && task.status !== "done");
          const repeated = busyKey === item.key;
          return <article key={item.key} className={`rounded-2xl border p-3.5 md:p-4 ${severityStyle[item.severity]}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 flex-1 gap-3"><span className="mt-0.5 shrink-0"><AlertTriangle size={17}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold tracking-wide">{severityLabel[item.severity]} · {item.category}</span><h3 className="w-full text-sm font-semibold leading-5 text-foreground">{item.title}</h3></div><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{item.evidence}</p><p className="mt-1 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">建议：</strong>{item.action}</p></div></div><div className="ml-7 flex shrink-0 flex-wrap gap-2 md:ml-0"><Link href={item.href} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-primary hover:bg-[var(--mc-tint-blue)]">查看来源<ArrowRight size={12}/></Link>{canEdit && (openTask ? <Link href="/tasks" className="inline-flex h-8 items-center rounded-lg bg-[var(--mc-tint-green)] px-2.5 text-xs font-semibold text-[var(--mc-color-success)]">已转待办</Link> : <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 bg-card px-2.5 text-xs" disabled={!!busyKey} onClick={() => void createTask(item)}>{repeated ? <LoaderCircle size={13} className="animate-spin"/> : <ClipboardPlus size={13}/>}转为待办</Button>)}</div></div>
            {feedback?.key === item.key && <p role={feedback.error ? "alert" : "status"} className={`ml-7 mt-2 text-xs ${feedback.error ? "text-[var(--mc-color-danger)]" : "text-[var(--mc-color-success)]"}`}>{feedback.message}</p>}
          </article>;
        })}</div>}
      </div>
      <div className="border-t border-border px-3 pb-1 pt-4 md:px-5"><AiInsightPanel feature="exceptions" context={aiContext} /></div>
    </section>
  </>;
}
