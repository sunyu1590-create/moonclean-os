"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowRight, Bot, Check, ChevronRight, CircleAlert, Clock3,
  Database, ExternalLink, FileText, KeyRound, RefreshCw,
  ShieldCheck, Sparkles, Store, Trash2, Workflow,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";
import { PinPad } from "@/components/ui/pin-pad";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { notifyFeedback } from "@/lib/feedback";
import {
  clearCachedDeepSeekKey, DEEPSEEK_UNLOCK_DURATIONS, encryptDeepSeekKey,
  getDeepSeekUnlockDuration, setDeepSeekUnlockDuration,
  type DeepSeekUnlockDuration,
} from "@/lib/deepseek-key";
import type { WorkspaceRow } from "@/lib/workspace";

const features = [
  { title: "AI 运营助手", description: "围绕经营、商品、成本、推广和实验进行连续问答；回答支持折叠、分类与收纳。", href: "/copilot", icon: Bot, inputs: "近 30 日经营汇总、商品与成本、实验、竞品、置顶备忘录、审核话术及当前会话最近消息。" },
  { title: "AI 经营建议", description: "在总览、商品、推广、财务、库存、订单等页面按需生成指标建议。", href: "/dashboard", icon: Sparkles, inputs: "只发送当前页面明确允许的脱敏汇总指标，不传商品明细或自由文本。" },
  { title: "备忘录 AI 润色与建议", description: "根据当前笔记生成 Markdown 润色稿或行动建议，确认后再应用。", href: "/notes", icon: FileText, inputs: "仅在主动点击后发送当前笔记标题和正文，返回内容先预览，不会自动覆盖。" },
  { title: "售后分析与客服辅助", description: "基于同步订单与退款汇总分析售后问题，也可辅助拟定客服回复。", href: "/service", icon: Workflow, inputs: "售后总结发送去标识化订单、退款和问题分类汇总；客服辅助按对应页面操作发送必要文本。" },
  { title: "经营异常诊断", description: "对数据缺口与异常提醒给出优先级和核查动作。", href: "/dashboard", icon: Activity, inputs: "当前异常类型、覆盖情况和经营汇总；建议是辅助判断，不会自动修改经营数据。" },
];

function formatTime(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function AiSettingsPage() {
  const { mode, activeStoreId, role } = useApp();
  const canManage = mode === "cloud" && (role === "owner" || role === "admin");
  const [status, setStatus] = useState<"loading" | "configured" | "missing" | "locked" | "error">("loading");
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [usageStatus, setUsageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [apiKey, setApiKey] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState<DeepSeekUnlockDuration>("3d");
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeStoreId || mode !== "cloud") { setStatus("missing"); setRows([]); setUsageStatus("ready"); return; }
    setStatus("loading"); setUsageStatus("loading");
    const [credentialResult, usageResult] = await Promise.allSettled([
      fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/ai/deepseek`, { credentials: "same-origin", cache: "no-store" }).then(async (response) => {
        const result = await response.json() as { configured?: boolean; locked?: boolean; error?: string };
        if (!response.ok) throw new Error(result.error || "AI 配置读取失败");
        return result;
      }),
      fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/workspace/copilot-usage`, { credentials: "same-origin", cache: "no-store" }).then(async (response) => {
        const result = await response.json() as { rows?: WorkspaceRow[]; error?: string };
        if (!response.ok) throw new Error(result.error || "调用记录读取失败");
        return result.rows || [];
      }),
    ]);
    if (credentialResult.status === "fulfilled") {
      const result = credentialResult.value;
      setStatus(result.locked ? "locked" : result.configured ? "configured" : "missing");
    } else setStatus("error");
    if (usageResult.status === "fulfilled") { setRows(usageResult.value); setUsageStatus("ready"); }
    else { setRows([]); setUsageStatus("error"); }
  }, [activeStoreId, mode]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refresh();
      if (activeStoreId) setDuration(getDeepSeekUnlockDuration(activeStoreId));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeStoreId, refresh]);

  const usage = useMemo(() => ({
    count: rows.length,
    success: rows.filter((row) => row.outcome === "success").length,
    failed: rows.filter((row) => row.outcome === "failed").length,
    tokens: rows.reduce((sum, row) => sum + Number(row.prompt_tokens || 0) + Number(row.completion_tokens || 0), 0),
    lastSuccess: rows.find((row) => row.outcome === "success")?.created_at,
  }), [rows]);

  async function saveKey() {
    if (!activeStoreId || !apiKey.trim()) { setMessage("请先粘贴 DeepSeek API Key。"); return; }
    if (!/^\d{4}$/.test(pin)) { setMessage("请设置四位数字密码。"); return; }
    if (pin !== pinConfirm) { setMessage("两次输入的密码不一致。"); return; }
    setBusy(true); setMessage("");
    try {
      const envelope = await encryptDeepSeekKey(apiKey, pin);
      const response = await fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/ai/deepseek`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envelope) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "云端保存失败");
      await clearCachedDeepSeekKey(activeStoreId);
      setApiKey(""); setPin(""); setPinConfirm(""); setStatus("configured");
      setMessage("密钥已加密保存到当前云端店铺。首次使用时会要求输入 PIN。");
      notifyFeedback({ kind: "success", title: "AI 密钥已保存", description: "密钥在浏览器端加密，云端只保存密文。" });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "DeepSeek 配置失败";
      setMessage(detail); notifyFeedback({ kind: "error", title: "AI 配置失败", description: detail });
    } finally { setBusy(false); }
  }

  async function clearKey() {
    if (!activeStoreId) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/ai/deepseek`, { method: "DELETE", credentials: "same-origin" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "清除云端配置失败");
      await clearCachedDeepSeekKey(activeStoreId);
      setStatus("missing"); setApiKey(""); setPin(""); setPinConfirm("");
      setMessage("已清除云端密钥与 PIN 保护，可重新配置。");
      notifyFeedback({ kind: "success", title: "AI 密钥已清除" });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "删除配置失败";
      setMessage(detail); notifyFeedback({ kind: "error", title: "删除配置失败", description: detail });
    } finally { setBusy(false); setConfirmClear(false); }
  }

  const statusLabel = status === "loading" ? "正在检查" : status === "configured" ? "密钥已加密保存" : status === "locked" ? "PIN 错误次数用尽 · 密钥已销毁" : status === "error" ? "无法读取配置" : "尚未连接";
  const statusTone = status === "configured" ? "text-[var(--mc-color-success)] bg-[var(--mc-tint-green)]" : status === "error" || status === "locked" ? "text-[var(--mc-color-danger)] bg-[var(--mc-tint-red)]" : "text-muted-foreground bg-[var(--mc-tint-blue)]";

  return <>
    <PageHead eyebrow="AI WORKSPACE / AI 设置" title="AI 设置" description="集中管理 AI 连接、安全解锁、功能入口、数据使用方式与调用记录。" action={<Link href="/copilot" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-[var(--mc-tint-blue)]"><Bot size={16} className="text-primary"/>打开 AI 运营助手<ArrowRight size={15}/></Link>} />

    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <div className="glass-card flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><Store size={19}/></span><div className="min-w-0"><p className="text-[11px] text-muted-foreground">作用范围</p><p className="truncate text-sm font-semibold">{mode === "cloud" ? "当前云端店铺" : "本地模式"}</p></div></div>
      <div className="glass-card flex items-center gap-3 p-4"><span className={`grid size-10 place-items-center rounded-xl ${statusTone}`}><KeyRound size={19}/></span><div className="min-w-0"><p className="text-[11px] text-muted-foreground">DeepSeek 连接</p><p className="truncate text-sm font-semibold">{statusLabel}</p></div></div>
      <div className="glass-card flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><Activity size={19}/></span><div className="min-w-0"><p className="text-[11px] text-muted-foreground">最近成功调用</p><p className="truncate text-sm font-semibold">{formatTime(usage.lastSuccess)}</p></div></div>
    </div>

    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
      <div className="space-y-5">
        <SectionCard title="服务连接" sub="当前支持 DeepSeek；模型由服务端部署配置决定。保存时不向 DeepSeek 发起验证请求。" action={<Sparkles size={19} className="text-primary"/>}>
          {mode !== "cloud" ? <div className="rounded-2xl bg-[var(--mc-tint-blue)] p-4 text-sm leading-6 text-muted-foreground">AI 服务使用当前云端店铺身份和权限。切换到云端店铺后即可配置；本地演示数据不会发送给 AI。</div> : !canManage ? <div className="rounded-2xl bg-[var(--mc-tint-blue)] p-4 text-sm leading-6 text-muted-foreground">你可以使用已配置的 AI 功能；只有店铺所有者或管理员可以新增、替换或清除 API Key。</div> : <div className="space-y-4">
            <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${statusTone}`}><span className="size-2 rounded-full bg-current"/><span>{statusLabel}</span><button type="button" onClick={() => void refresh()} aria-label="刷新 AI 配置状态" className="ml-auto rounded-lg p-1 transition-colors hover:bg-card"><RefreshCw size={15}/></button></div>
            <div><Label htmlFor="ai-deepseek-key">DeepSeek API Key</Label><Input id="ai-deepseek-key" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={busy} placeholder={status === "configured" ? "输入新 Key 以替换当前密钥" : "粘贴 DeepSeek API Key"} className="mt-1.5"/></div>
            <div className="grid gap-4 md:grid-cols-2"><div><Label>设置四位数字 PIN</Label><div className="mt-1.5"><PinPad value={pin} onChange={setPin} disabled={busy} label="设置四位数字 PIN"/></div></div><div><Label>再次输入 PIN</Label><div className="mt-1.5"><PinPad value={pinConfirm} onChange={setPinConfirm} disabled={busy} label="再次输入四位 PIN"/></div></div></div>
            <div><Label htmlFor="ai-unlock-duration">重新验证频率</Label><AppSelect id="ai-unlock-duration" value={duration} disabled={!activeStoreId || busy} onChange={(event) => { const next = event.target.value as DeepSeekUnlockDuration; setDuration(next); if (activeStoreId) void setDeepSeekUnlockDuration(activeStoreId, next); }} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground">{DEEPSEEK_UNLOCK_DURATIONS.map((item) => <option key={item.value} value={item.value}>{item.value === "per-call" ? "每次调用都输入" : item.label}</option>)}</AppSelect><p className="mt-1 text-[11px] leading-5 text-muted-foreground">保存在当前浏览器，到期后重新输入 PIN；调整频率会立即结束当前解锁状态。</p></div>
            <div className="flex flex-wrap items-center gap-2"><Button type="button" loading={busy} onClick={() => void saveKey()} disabled={busy || !apiKey.trim() || pin.length !== 4 || pinConfirm.length !== 4}>{status === "configured" ? "更换密钥并重设 PIN" : "保存密钥"}</Button>{status === "configured" || status === "locked" ? <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmClear(true)}><Trash2 size={15}/>忘记 PIN / 清除密钥</Button> : null}<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 px-2 text-xs font-medium text-primary underline underline-offset-2">创建 API Key<ExternalLink size={12}/></a></div>
            {message && <p role={message.includes("已保存") || message.includes("已清除") ? "status" : "alert"} className={`rounded-xl p-3 text-xs leading-5 ${message.includes("已保存") || message.includes("已清除") ? "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]" : "bg-[var(--mc-tint-red)] text-[var(--mc-color-danger)]"}`}>{message}</p>}
          </div>}
          <div className="mt-4 flex gap-2 rounded-xl border border-border bg-card/70 p-3 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary"/><p>PIN 不会发送到服务器。浏览器使用 PIN 派生 AES-GCM 密钥后再将密文保存到当前店铺；累计输错五次会销毁密钥。解锁期仅在本机浏览器保存不可导出的加密密钥句柄。</p></div>
        </SectionCard>

        <SectionCard title="AI 功能目录" sub="仅列出当前产品中已经接入的能力；功能是否可用还取决于云端店铺权限和密钥状态。" action={<Workflow size={19} className="text-primary"/>}>
          <div className="space-y-2.5">{features.map(({ title, description, href, icon: Icon, inputs }) => <article key={title} className="rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-[var(--mc-tint-blue)]/40 sm:p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><Icon size={17}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{title}</h3><span className="rounded-full bg-[var(--mc-tint-green)] px-2 py-0.5 text-[10px] font-medium text-[var(--mc-color-success)]">已接入</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p><details className="group mt-2"><summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-primary">数据范围说明<ChevronRight size={13} className="transition-transform group-open:rotate-90"/></summary><p className="mt-1.5 rounded-lg bg-[var(--mc-tint-blue)] p-2.5 text-[11px] leading-5 text-muted-foreground">{inputs}</p></details></div><Link href={href} aria-label={`打开${title}`} className="grid size-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-[var(--mc-tint-blue)] hover:text-primary"><ArrowRight size={16}/></Link></div></article>)}</div>
        </SectionCard>
      </div>

      <div className="space-y-5">
        <SectionCard title="用量与诊断" sub="显示当前店铺 Copilot 最近 500 条服务端调用记录。" action={<Activity size={19} className="text-primary"/>}>
          <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-[var(--mc-tint-blue)] p-3"><p className="text-[10px] text-muted-foreground">记录调用</p><p className="number mt-1 text-xl font-semibold">{usageStatus === "ready" ? usage.count : "—"}</p></div><div className="rounded-xl bg-[var(--mc-tint-green)] p-3"><p className="text-[10px] text-muted-foreground">成功</p><p className="number mt-1 text-xl font-semibold text-[var(--mc-color-success)]">{usageStatus === "ready" ? usage.success : "—"}</p></div><div className="rounded-xl bg-[var(--mc-tint-red)] p-3"><p className="text-[10px] text-muted-foreground">失败</p><p className="number mt-1 text-xl font-semibold text-[var(--mc-color-danger)]">{usageStatus === "ready" ? usage.failed : "—"}</p></div><div className="rounded-xl bg-[var(--mc-tint-blue)] p-3"><p className="text-[10px] text-muted-foreground">累计 Token</p><p className="number mt-1 text-xl font-semibold">{usageStatus === "ready" ? usage.tokens.toLocaleString("zh-CN") : "—"}</p></div></div>
          {usageStatus === "loading" ? <p role="status" className="mt-3 text-xs text-muted-foreground">正在读取调用记录…</p> : usageStatus === "error" ? <div className="mt-3 flex gap-2 rounded-xl bg-[var(--mc-tint-orange)] p-3 text-xs leading-5 text-muted-foreground"><CircleAlert size={15} className="mt-0.5 shrink-0"/>调用记录暂时无法读取；这不影响其他 AI 功能。</div> : rows.length === 0 ? <p className="mt-3 rounded-xl bg-[var(--mc-tint-blue)] p-3 text-xs leading-5 text-muted-foreground">暂无 Copilot 调用记录。其他 AI 页面目前不会写入统一调用日志，因此这里不会统计它们。</p> : <div className="mt-3 space-y-2">{rows.slice(0, 6).map((row) => <div key={row.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5"><span className={`size-2 shrink-0 rounded-full ${row.outcome === "success" ? "bg-[var(--mc-color-success)]" : "bg-[var(--mc-color-danger)]"}`}/><span className="min-w-0 flex-1 truncate text-xs font-medium">{row.outcome === "success" ? "请求完成" : `请求失败${row.error_code ? ` · ${String(row.error_code)}` : ""}`}</span><span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(row.created_at)}</span></div>)}</div>}
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-border p-3 text-[10px] leading-5 text-muted-foreground"><Clock3 size={14} className="mt-0.5 shrink-0"/><p>调用记录可能包含请求状态、时长和 Token 数，不含 API Key 或提示词正文。统计受当前日志保留策略与 500 条读取上限影响。</p></div>
        </SectionCard>

        <SectionCard title="数据与隐私" sub="AI 只在你主动使用功能时处理所需内容。" action={<Database size={19} className="text-primary"/>}>
          <div className="space-y-3 text-xs leading-5 text-muted-foreground"><div className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[var(--mc-color-success)]"/><p><strong className="text-foreground">密钥保护：</strong>云端保存 AES-GCM 密文；PIN 不上传，DeepSeek Key 不会回显到设置页。</p></div><div className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[var(--mc-color-success)]"/><p><strong className="text-foreground">按需发送：</strong>经营分析使用功能所需的汇总；笔记工具只有在点击润色或建议后才发送当前标题与正文。</p></div><div className="flex gap-2"><CircleAlert size={15} className="mt-0.5 shrink-0 text-[var(--mc-color-warning)]"/><p><strong className="text-foreground">服务路径：</strong>部分请求经 MoonClean 服务端转发到 DeepSeek。密钥在调用期间用于请求，不写入调用日志。</p></div><div className="flex gap-2"><CircleAlert size={15} className="mt-0.5 shrink-0 text-[var(--mc-color-warning)]"/><p><strong className="text-foreground">历史留存：</strong>Copilot 对话保存在当前云端店铺；笔记 AI 的请求和结果不另存，除非你主动保存。AI 输出需人工复核。</p></div></div>
        </SectionCard>

        <Link href="/settings" className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-[var(--mc-tint-blue)]"><span><strong className="block text-sm">系统设置</strong><span className="mt-1 block text-xs text-muted-foreground">店铺信息、团队、经营目标和数据备份</span></span><span className="grid size-9 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><ChevronRight size={17} className="transition-transform group-hover:translate-x-0.5"/></span></Link>
      </div>
    </div>

    <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>清除当前店铺 AI 密钥？</AlertDialogTitle><AlertDialogDescription>云端密文、PIN 失败计数和本机解锁缓存都会被清除。之后需要重新输入 API Key 并设置新的四位 PIN。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>取消</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void clearKey(); }}>{busy ? "正在清除…" : "确认清除密钥"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
