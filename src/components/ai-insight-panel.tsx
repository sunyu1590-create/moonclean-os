"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, Clock3, RefreshCw, Sparkles } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { DeepSeekUnlockDialog } from "@/components/deepseek-unlock-dialog";
import { notifyFeedback } from "@/lib/feedback";
import { getCachedDeepSeekKey } from "@/lib/deepseek-key";
import { MarkdownContent } from "@/components/markdown-content";

type Feature = "dashboard" | "exceptions" | "advertising" | "products" | "finance" | "data" | "orders" | "inventory" | "tasks" | "pricing" | "product-insights" | "reports" | "integrations";
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
  const [pinOpen, setPinOpen] = useState(false);
  const contextKey = JSON.stringify(context);
  const cacheKey = activeStoreId ? `moonclean-ai-insight-v1:${activeStoreId}:${feature}` : "";

  async function generate(apiKey?: string) {
    if (mode !== "cloud" || !activeStoreId || busy) return;
    if (!apiKey) {
      setBusy(true);
      let cachedKey: string | null = null;
      try { cachedKey = await getCachedDeepSeekKey(activeStoreId); } catch { /* Ask for the PIN if the cached session cannot be checked. */ }
      setBusy(false);
      if (cachedKey) { await generate(cachedKey); return; }
      setPinOpen(true); return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/stores/${activeStoreId}/ai/insights`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, feature, context }),
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
      notifyFeedback({ kind: "success", title: "AI 建议已生成", description: "建议已显示在当前页面。" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "AI 建议生成失败，请稍后重试。";
      setError(message);
      notifyFeedback({ kind: "error", title: "AI 建议生成失败", description: message });
    } finally { setBusy(false); }
  }

  useEffect(() => {
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
    });
    return () => window.cancelAnimationFrame(frame);
  // contextKey intentionally represents the serialized, non-sensitive metric snapshot.
  }, [activeStoreId, autoRefresh, cacheKey, contextKey, feature, mode]);

  const formattedTime = generatedAt ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(generatedAt)) : "";
  return <section aria-label="DeepSeek 智能建议" className="mb-5 rounded-[20px] border border-border bg-[linear-gradient(135deg,var(--mc-tint-blue),var(--card)_62%,var(--mc-tint-blue))] p-4 shadow-[0_8px_26px_rgba(39,86,129,.055)] md:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><Bot size={18}/></span><div className="min-w-0"><h2 className="text-sm font-semibold text-foreground">DeepSeek 智能建议</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{autoRefresh ? "使用近 7 天脱敏汇总；密码有效期可在AI 设置中调整" : "根据当前页面的经营汇总提供参考建议"}</p></div></div>
      <div className="flex items-center gap-2">{formattedTime && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 size={12}/>{formattedTime}</span>}<Button type="button" size="sm" variant="outline" disabled={busy || mode !== "cloud" || !activeStoreId} onClick={() => void generate()}><RefreshCw size={13} className={busy ? "animate-spin" : ""}/>{busy ? "正在分析" : suggestion ? "重新生成" : "生成建议"}</Button></div>
    </div>
    {mode !== "cloud" ? <p className="mt-3 rounded-xl bg-card/75 px-3 py-2.5 text-xs leading-5 text-muted-foreground">本地数据不会发送给 AI。AI 分析需要云端店铺和 DeepSeek API Key；切换至云端后，可在 <Link href="/ai-settings" className="font-semibold text-primary">AI 设置</Link> 完成配置。</p> : error ? <p role="alert" className="mt-3 rounded-xl border border-border bg-[var(--mc-tint-red)] px-3 py-2.5 text-xs leading-5 text-[var(--mc-color-danger)]">{error} {error.includes("配置") && <Link href="/ai-settings" className="font-semibold underline">前往配置</Link>}</p> : suggestion ? <div aria-live="polite" className="mt-3 rounded-xl border border-border bg-card/75 px-3.5 py-3 text-xs text-muted-foreground"><MarkdownContent content={suggestion} className="text-xs leading-6"/></div> : <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles size={12}/>仅发送汇总数值、状态计数和缺失数据提示，不发送订单号、买家信息或密钥。</p>}
    {activeStoreId && <DeepSeekUnlockDialog storeId={activeStoreId} open={pinOpen} onOpenChange={setPinOpen} onUnlock={(apiKey) => generate(apiKey)}/>}
  </section>;
}
