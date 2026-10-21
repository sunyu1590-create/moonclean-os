"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Decimal from "decimal.js";
import { AlertCircle, Bot, CheckCircle2, Clock3, RefreshCw, Save, Sparkles } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { DeepSeekUnlockDialog } from "@/components/deepseek-unlock-dialog";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getIntegration, integrationAction, type IntegrationSnapshot } from "@/integrations/pinduoduo/client";
import { formatMoney } from "@/lib/finance";
import { REFUND_REASONS, summarizeRefundIssues, refundReasonSchema, type RefundReason } from "@/lib/after-sales";
import { notifyFeedback } from "@/lib/feedback";
import { getCachedDeepSeekKey } from "@/lib/deepseek-key";
import { MarkdownContent } from "@/components/markdown-content";

type Period = 7 | 30 | 90;
type Draft = { reason: RefundReason | ""; note: string };
const EMPTY_ORDERS: IntegrationSnapshot["orders"] = [];
const EMPTY_REFUNDS: IntegrationSnapshot["refunds"] = [];

export default function AfterSalesPage() {
  const { activeStoreId, mode, role } = useApp();
  const [snapshot, setSnapshot] = useState<IntegrationSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>(30);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [summary, setSummary] = useState("");
  const [aiPeriod, setAiPeriod] = useState<Period>(7);
  const [pinOpen, setPinOpen] = useState(false);
  const [now, setNow] = useState(0);
  const canEdit = role !== "viewer";

  const load = useCallback(async () => {
    if (mode === "local") { setSnapshot(null); setError(""); setLoading(false); return; }
    if (!activeStoreId) return;
    setLoading(true); setError("");
    try { setSnapshot(await getIntegration(activeStoreId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "售后读取失败"); }
    finally { setLoading(false); }
  }, [activeStoreId, mode]);
  useEffect(() => { queueMicrotask(() => { setSnapshot(null); void load(); }); }, [load]);
  useEffect(() => {
    let interval = 0;
    const frame = window.requestAnimationFrame(() => {
      setNow(Date.now());
      interval = window.setInterval(() => setNow(Date.now()), 60_000);
    });
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(interval); };
  }, []);

  const refunds = snapshot?.refunds || EMPTY_REFUNDS;
  const orders = snapshot?.orders || EMPTY_ORDERS;
  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const cutoff = now - period * 86400000;
  const periodRefunds = refunds.filter((refund) => {
    const date = orderById.get(refund.order_id)?.placed_at;
    return !date || new Date(date).getTime() >= cutoff;
  });
  const completed = periodRefunds.filter((row) => row.status === "succeeded");
  const pending = periodRefunds.filter((row) => row.status === "pending");
  const completedAmount = completed.reduce((sum, row) => sum.plus(row.amount), new Decimal(0));
  const totalSales = orders.filter((order) => new Date(order.placed_at).getTime() >= cutoff).reduce((sum, row) => sum.plus(row.gross_sales), new Decimal(0));
  const ratio = totalSales.gt(0) ? completedAmount.div(totalSales).mul(100).toNumber() : null;
  const issueSummary = summarizeRefundIssues(periodRefunds.map((row) => ({ amount: row.amount, status: row.status, reason: row.reason })), cutoff);
  const sorted = [...periodRefunds].sort((a, b) => Number(orderById.get(b.order_id)?.placed_at || 0) - Number(orderById.get(a.order_id)?.placed_at || 0));

  function draftFor(refund: IntegrationSnapshot["refunds"][number]): Draft {
    return drafts[refund.id] || { reason: refund.reason || "", note: refund.note || "" };
  }
  async function saveIssue(refund: IntegrationSnapshot["refunds"][number]) {
    if (!activeStoreId || !refund.connection_id) return;
    const draft = draftFor(refund);
    if (draft.reason && !refundReasonSchema.safeParse(draft.reason).success) return;
    setSavingId(refund.id); setSavedMessage(""); setError("");
    try {
      await integrationAction(activeStoreId, { action: "setRefundIssue", connectionId: refund.connection_id, externalId: refund.external_id, reason: draft.reason || null, note: draft.note.trim() });
      setSavedMessage("售后问题已保存");
      await load();
      window.setTimeout(() => setSavedMessage(""), 2600);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "售后问题保存失败"); }
    finally { setSavingId(""); }
  }
  async function requestSummary(apiKey: string) {
    if (!activeStoreId) return;
    setAiBusy(true); setAiError(""); setSummary("");
    try {
      const response = await fetch(`/api/stores/${activeStoreId}/after-sales/summary`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, days: aiPeriod }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "AI 分析失败");
      setSummary(body.summary || "未能读取分析结果");
      notifyFeedback({ kind: "success", title: "售后分析已生成", description: "分析结果已显示在当前窗口。" });
    } catch (cause) { const message = cause instanceof Error ? cause.message : "AI 分析失败"; setAiError(message); notifyFeedback({ kind: "error", title: "售后分析失败", description: message }); }
    finally { setAiBusy(false); }
  }
  async function startSummary() {
    if (!activeStoreId || aiBusy) return;
    const cachedKey = await getCachedDeepSeekKey(activeStoreId);
    if (cachedKey) await requestSummary(cachedKey);
    else setPinOpen(true);
  }

  if (mode === "local") return <><PageHead eyebrow="AFTER-SALES / 售后分析" title="把售后问题按原因看清楚" description="售后数据跟随云端平台同步记录；本机工作区不会请求云端退款。"/><div className="rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-5 text-sm leading-6 text-primary">当前本机工作区没有云端同步的订单与退款。切换到云端数据后，可以分析退款趋势、标注问题原因并生成 AI 总结。</div></>;

  return <>
    <PageHead eyebrow="AFTER-SALES / 售后分析" title="把售后问题按原因看清楚" description="按退款原因统计频次和金额，及时发现质量、包装、漏发与物流问题。" action={<div className="flex gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/>刷新</Button><Button onClick={() => { setAiOpen(true); setAiError(""); }} disabled={!activeStoreId}><Sparkles size={16}/>DeepSeek 售后总结</Button></div>}/>
    {error && <p role="alert" className="mb-4 rounded-xl bg-[var(--mc-tint-red)] p-4 text-sm text-[var(--mc-color-danger)]">{error}</p>}
    {savedMessage && <p role="status" className="mb-4 rounded-xl bg-[var(--mc-tint-green)] p-3 text-sm text-[var(--mc-color-success)]">{savedMessage}</p>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">统计周期</p><div className="flex gap-2">{([7, 30, 90] as const).map((days) => <Button key={days} size="sm" variant={period === days ? "default" : "outline"} onClick={() => setPeriod(days)}>{days} 天</Button>)}</div></div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label={`${period} 天退款记录`} value={String(periodRefunds.length)} icon={<AlertCircle size={19}/>}/><MetricCard label="处理中" value={String(pending.length)} tone={pending.length ? "red" : "green"} icon={<Clock3 size={19}/>}/><MetricCard label="成功退款金额" value={formatMoney(completedAmount.toFixed(2))} tone="red" icon={<CheckCircle2 size={19}/>}/><MetricCard label="退款金额 / 同期同步订单额" value={ratio === null ? "无法计算" : `${ratio.toFixed(2)}%`} sub="仅统计当前已同步订单"/></div>
    <div className="mb-5 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <SectionCard title="高频售后问题" sub={`${period} 天内已分类 ${issueSummary.total - issueSummary.unclassified} / ${issueSummary.total} 条 · 按原因标注后持续更新`}>
        {issueSummary.reasons.length ? <div className="space-y-3">{issueSummary.reasons.map((item, index) => { const share = issueSummary.total ? item.count / issueSummary.total * 100 : 0; return <div key={item.reason} className="rounded-xl border border-border p-3"><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--mc-tint-blue)] text-xs font-semibold text-primary">{index + 1}</span><strong className="truncate text-sm text-foreground">{item.label}</strong></div><span className="shrink-0 text-sm font-semibold text-muted-foreground">{item.count} 条 · {formatMoney(item.amount)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--mc-tint-blue)]"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, share)}%` }}/></div></div>; })}</div> : <p className="text-sm text-muted-foreground">目前没有已标注的售后原因。请在下方退款记录中选择问题类别，之后这里会自动统计频次和金额。</p>}
        {issueSummary.unclassified > 0 && <p className="mt-3 rounded-xl bg-[var(--mc-tint-orange)] p-3 text-xs leading-5 text-[var(--mc-color-warning)]">还有 {issueSummary.unclassified} 条退款未分类。分类可以帮助定位重复出现的商品或履约问题。</p>}
      </SectionCard>
      <SectionCard title="售后处理建议" sub="根据已标注问题整理的运营提醒">
        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          {issueSummary.topReason ? <p className="rounded-xl bg-[var(--mc-tint-blue)] p-3">当前高频原因是<strong className="mx-1 text-foreground">{issueSummary.topReason.label}</strong>（{issueSummary.topReason.count} 条）。建议抽查对应批次、包装环节和客服处理记录。</p> : <p className="rounded-xl bg-[var(--mc-tint-blue)] p-3">先为退款记录补充问题类型，系统会据此识别最常见的售后原因。</p>}
          <p className="rounded-xl bg-[var(--mc-tint-blue)] p-3">成功退款金额为 {formatMoney(completedAmount.toFixed(2))}；处理中退款 {pending.length} 条。建议优先跟进金额较高或等待时间较久的记录。</p>
          <p className="text-xs text-muted-foreground">问题原因来自人工标注或模拟数据，平台原始退款记录通常不包含标准化原因。DeepSeek 总结仅在点击后发送匿名汇总数字。</p>
        </div>
      </SectionCard>
    </div>
    <SectionCard title="退款记录与问题标注" sub={loading ? "正在读取云端退款" : `展示 ${periodRefunds.length} 条 · 分类后会同步保存到当前店铺`}>
      {loading ? <p className="text-sm text-muted-foreground">正在加载售后数据…</p> : !sorted.length ? <div className="text-sm text-muted-foreground">暂无退款记录。可在平台连接中心同步退款。<Link className="ml-2 text-primary underline" href="/integrations">前往平台连接</Link></div> : <div className="space-y-3">{sorted.map((refund) => { const order = orderById.get(refund.order_id); const state = refund.status === "succeeded" ? "退款成功" : refund.status === "pending" ? "处理中" : "已驳回"; const draft = draftFor(refund); return <div key={refund.id} className="rounded-2xl border border-border p-3 sm:p-4"><div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><strong className="text-sm text-foreground">{refund.external_id}</strong><p className="mt-1 text-xs text-muted-foreground">订单 {order?.external_id || "未同步"} · {state}{order?.is_demo && <span className="ml-2 text-primary">模拟数据</span>}</p></div><strong className={refund.status === "succeeded" ? "text-[var(--mc-color-danger)]" : "text-muted-foreground"}>{formatMoney(refund.amount)}</strong></div><div className="grid gap-2 sm:grid-cols-[minmax(180px,.65fr)_1fr_auto] sm:items-end"><div><Label className="mb-1 block text-xs">售后问题</Label><AppSelect aria-label="售后问题" className="h-9 w-full rounded-xl border border-border bg-card px-3 text-sm" value={draft.reason} disabled={!canEdit} onChange={(event) => setDrafts((current) => ({ ...current, [refund.id]: { ...draft, reason: event.target.value as Draft["reason"] } }))}><option value="">选择问题类型</option>{REFUND_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</AppSelect></div><div><Label className="mb-1 block text-xs">处理备注（选填）</Label><Input aria-label="处理备注" maxLength={300} disabled={!canEdit} value={draft.note} onChange={(event) => setDrafts((current) => ({ ...current, [refund.id]: { ...draft, note: event.target.value } }))} placeholder="例如：已补发，跟进物流单号"/></div><Button size="sm" variant="outline" disabled={!canEdit || savingId === refund.id || !refund.connection_id} onClick={() => void saveIssue(refund)}><Save size={14}/>{savingId === refund.id ? "保存中" : "保存分类"}</Button></div></div>; })}</div>}
    </SectionCard>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">销售额和退款比率按最近已同步的订单与退款记录计算；平台模拟连接数据会显示“模拟数据”。DeepSeek 仅接收时间范围、条数和金额汇总，不会发送订单号、买家信息或备注。</p>
    <Dialog open={aiOpen} onOpenChange={setAiOpen}><DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Bot size={20} className="text-primary"/>DeepSeek 售后分析</DialogTitle><DialogDescription>根据当前店铺的售后汇总，识别高频问题并给出处理建议。只提交汇总数字，不提交订单号和客户信息。</DialogDescription></DialogHeader><div className="space-y-4"><div className="flex flex-wrap items-center gap-3"><span className="text-sm text-muted-foreground">分析周期</span><div className="flex gap-2">{([7, 30, 90] as const).map((days) => <Button key={days} size="sm" variant={aiPeriod === days ? "default" : "outline"} onClick={() => setAiPeriod(days)}>{days} 天</Button>)}</div></div>{aiError && <p role="alert" className="rounded-xl bg-[var(--mc-tint-red)] p-3 text-sm leading-5 text-[var(--mc-color-danger)]">{aiError} <Link href="/ai-settings" className="ml-1 font-semibold underline">前往 AI 设置配置 DeepSeek</Link></p>}{summary && <div className="rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-4 text-foreground"><MarkdownContent content={summary}/></div>}<div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--mc-tint-blue)] p-3 text-xs leading-5 text-muted-foreground"><span>密码有效期可在AI 设置中调整。</span><Button onClick={() => void startSummary()} disabled={aiBusy || !activeStoreId}><Sparkles size={15}/>{aiBusy ? "分析中…" : summary ? "重新分析" : "生成分析"}</Button></div></div></DialogContent></Dialog>
    {activeStoreId && <DeepSeekUnlockDialog storeId={activeStoreId} open={pinOpen} onOpenChange={setPinOpen} onUnlock={(apiKey) => requestSummary(apiKey)}/>}
  </>;
}
