"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bot, Clock3, RefreshCw, Sparkles } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { notifyFeedback } from "@/lib/feedback";

type Feature = "dashboard" | "advertising" | "products" | "finance" | "data" | "orders" | "inventory" | "tasks" | "pricing" | "product-insights" | "reports" | "integrations";
type InsightValue = number | boolean | "数据不足" | "成本数据不足" | "未填写";
type CacheEntry = { suggestion: string; generatedAt: string; contextKey: string };

export function AiInsightPanel({ feature, context, autoRefresh = false }: {
  feature: Feature;
  context: Record<string, InsightValue>;
  autoRefresh?: boolean;
}) {
  const { activeStoreId, mode } = useApp();
  const [suggestion, setSuggestion] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const contextKey = JSON.stringify(context);
  const cacheKey = activeStoreId ? `moonclean-ai-insight-v1:${activeStoreId}:${feature}` : "";

  const generate = useCallback(async (automatic = false) => {
    if (mode !== "cloud" || !activeStoreId || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/stores/${activeStoreId}/ai/insights`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, context }),
        cache: "no-store",
      });
      const result = await response.json() as { suggestion?: string; generatedAt?: string; error?: string };
      if (!response.ok || !result.suggestion || !result.generatedAt) throw new Error(result.error || "AI 建议生成失败，请稍后重试。");
      setSuggestion(result.suggestion);
      setGeneratedAt(result.generatedAt);
      if (cacheKey) {
        const entry: CacheEntry = { suggestion: result.suggestion, generatedAt: result.generatedAt, contextKey };
        try { localStorage.setItem(cacheKey, JSON.stringify(entry)); } catch { /* Current session still displays the result. */ }
      }
      if (!automatic) notifyFeedback({ kind: "success", title: "AI 建议已生成", description: "建议已显示在当前页面。" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "AI 建议生成失败，请稍后重试。";
      if (!automatic || !suggestion) setError(message);
      if (!automatic) notifyFeedback({ kind: "error", title: "AI 建议生成失败", description: message });
    } finally { setBusy(false); }
  }, [activeStoreId, busy, cacheKey, context, contextKey, feature, mode, suggestion]);

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      let cached: CacheEntry | null = null;
      if (cacheKey) {
        try {
          const parsed = JSON.parse(localStorage.getItem(cacheKey) || "null") as CacheEntry | null;
          if (parsed && typeof parsed.suggestion === "string" && typeof parsed.generatedAt === "string" && (autoRefresh || parsed.contextKey === contextKey)) cached = parsed;
        } catch { /* Ignore malformed local cache and request a fresh suggestion. */ }
      }
      if (cached) { setSuggestion(cached.suggestion); setGeneratedAt(cached.generatedAt); }
      else { setSuggestion(""); setGeneratedAt(""); }
      if (!autoRefresh || mode !== "cloud" || !activeStoreId) return;
      const age = cached ? Date.now() - Date.parse(cached.generatedAt) : Infinity;
      const wait = Number.isFinite(age) && age >= 0 && age < 10 * 60_000 ? 10 * 60_000 - age : 0;
      const refresh = async () => {
        if (cancelled) return;
        await generate(true);
        if (!cancelled) timer = window.setTimeout(() => { void refresh(); }, 10 * 60_000);
      };
      timer = window.setTimeout(() => { void refresh(); }, wait);
    });
    return () => { cancelled = true; window.cancelAnimationFrame(frame); if (timer) window.clearTimeout(timer); };
  // contextKey intentionally represents the serialized, non-sensitive metric snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoreId, autoRefresh, cacheKey, contextKey, feature, mode]);

  const formattedTime = generatedAt ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(generatedAt)) : "";
  return <section aria-label="DeepSeek 智能建议" className="mb-5 rounded-[20px] border border-[#dceaf6] bg-[linear-gradient(135deg,#f8fcff,#fff_62%,#f5fbff)] p-4 shadow-[0_8px_26px_rgba(39,86,129,.055)] md:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e7f3ff] text-[#3287d5]"><Bot size={18}/></span><div className="min-w-0"><h2 className="text-sm font-semibold text-[#20364b]">DeepSeek 智能建议</h2><p className="mt-0.5 text-[11px] text-[#8093a6]">{autoRefresh ? "根据近 7 天脱敏汇总自动生成，每 10 分钟更新" : "根据当前页面的经营汇总提供参考建议"}</p></div></div>
      <div className="flex items-center gap-2">{formattedTime && <span className="inline-flex items-center gap-1 text-[10px] text-[#8b9aaa]"><Clock3 size={12}/>{formattedTime}</span>}<Button type="button" size="sm" variant="outline" disabled={busy || mode !== "cloud" || !activeStoreId} onClick={() => void generate()}><RefreshCw size={13} className={busy ? "animate-spin" : ""}/>{busy ? "正在分析" : suggestion ? "重新生成" : "生成建议"}</Button></div>
    </div>
    {mode !== "cloud" ? <p className="mt-3 rounded-xl bg-white/75 px-3 py-2.5 text-xs leading-5 text-[#8193a5]">本地数据不会发送给 AI。AI 分析需要云端店铺和 DeepSeek API Key；切换至云端后，可在 <Link href="/settings" className="font-semibold text-[#3189e8]">系统设置</Link> 完成配置。</p> : error ? <p role="alert" className="mt-3 rounded-xl border border-[#f3dfe2] bg-[#fff5f5] px-3 py-2.5 text-xs leading-5 text-[#b95a63]">{error} {error.includes("配置") && <Link href="/settings" className="font-semibold underline">前往配置</Link>}</p> : suggestion ? <div aria-live="polite" className="mt-3 whitespace-pre-wrap rounded-xl border border-[#e7eff6] bg-white/75 px-3.5 py-3 text-xs leading-6 text-[#536a80]">{suggestion}</div> : <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#91a0af]"><Sparkles size={12}/>仅发送汇总数值、状态计数和缺失数据提示，不发送订单号、买家信息或密钥。</p>}
  </section>;
}
