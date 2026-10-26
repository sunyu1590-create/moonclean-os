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
import { readAiTextStream } from "@/lib/read-ai-stream";
import { AiStreamStatus } from "@/components/ai-stream-status";
import { useLanguage } from "@/components/language-provider";
import { CACHE_PREFERENCES_EVENT, getCacheProfile, isCacheEnabled, writeBoundedAiCache } from "@/lib/cache-preferences";

type Feature = "dashboard" | "exceptions" | "advertising" | "products" | "finance" | "data" | "orders" | "inventory" | "tasks" | "pricing" | "product-insights" | "reports" | "integrations";
type InsightValue = number | boolean | "数据不足" | "成本数据不足" | "未填写";
type CacheEntry = { suggestion: string; generatedAt: string; contextKey: string };

export function AiInsightPanel({ feature, context, autoRefresh = false, connected = false }: {
  feature: Feature;
  context: Record<string, InsightValue>;
  autoRefresh?: boolean;
  connected?: boolean;
}) {
  const { activeStoreId, mode } = useApp();
  const { language, t } = useLanguage();
  const [suggestion, setSuggestion] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [cachePolicyRevision, setCachePolicyRevision] = useState(0);
  const contextKey = JSON.stringify(context);
  const cacheKey = activeStoreId ? `moonclean-ai-insight-v2:${activeStoreId}:${feature}` : "";
  const dataCacheEnabled = isCacheEnabled("data");

  useEffect(() => {
    const update = () => setCachePolicyRevision(value => value + 1);
    window.addEventListener(CACHE_PREFERENCES_EVENT, update);
    return () => window.removeEventListener(CACHE_PREFERENCES_EVENT, update);
  }, []);

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
        body: JSON.stringify({ apiKey, feature, context, language }),
        cache: "no-store",
      });
      let streamed = "";
      const result = await readAiTextStream(
        response,
        (delta) => { streamed += delta; setSuggestion(streamed); },
        (replacement) => { streamed = replacement; setSuggestion(replacement); },
      );
      if (!streamed.trim() || typeof result?.generatedAt !== "string") throw new Error("AI 建议生成失败，请稍后重试。");
      setGeneratedAt(result.generatedAt);
      if (cacheKey && dataCacheEnabled) {
        const entry: CacheEntry = { suggestion: streamed, generatedAt: result.generatedAt, contextKey };
        writeBoundedAiCache(cacheKey, entry);
      } else if (cacheKey) try { localStorage.removeItem(cacheKey); } catch { /* Keep the generated result in the current page. */ }
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
      if (cacheKey && dataCacheEnabled) {
        try {
          const parsed = JSON.parse(localStorage.getItem(cacheKey) || "null") as CacheEntry | null;
          const age = parsed ? Date.now() - Date.parse(parsed.generatedAt) : Infinity;
          if (parsed && typeof parsed.suggestion === "string" && typeof parsed.generatedAt === "string" && age >= 0 && age < getCacheProfile().aiResultTtlMs && (autoRefresh || parsed.contextKey === contextKey)) cached = parsed;
        } catch { /* Ignore malformed local cache and request a fresh suggestion. */ }
      } else if (cacheKey) try { localStorage.removeItem(cacheKey); } catch { /* The AI result is not reused when caching is disabled. */ }
      if (cached) { setSuggestion(cached.suggestion); setGeneratedAt(cached.generatedAt); }
      else { setSuggestion(""); setGeneratedAt(""); }
    });
    return () => window.cancelAnimationFrame(frame);
  // contextKey intentionally represents the serialized, non-sensitive metric snapshot.
  }, [activeStoreId, autoRefresh, cacheKey, contextKey, feature, mode, dataCacheEnabled, cachePolicyRevision]);

  const formattedTime = generatedAt ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(generatedAt)) : "";
  return <section aria-label="DeepSeek 智能建议" className={connected ? "rounded-none border-0 border-t border-border bg-card p-4 shadow-none md:p-5" : "mb-5 rounded-[20px] border border-border bg-[linear-gradient(135deg,var(--mc-tint-blue),var(--card)_62%,var(--mc-tint-blue))] p-4 shadow-[0_8px_26px_rgba(39,86,129,.055)] md:p-5"}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><Bot size={18}/></span><div className="min-w-0"><h2 className="text-sm font-semibold text-foreground">{t("DeepSeek 智能建议")}</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{autoRefresh ? "使用近 7 天脱敏汇总；密码有效期可在AI 设置中调整" : t("根据当前页面的经营汇总提供参考建议")}</p></div></div>
      <div className="flex items-center gap-2">{formattedTime && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 size={12}/>{formattedTime}</span>}<Button type="button" size="sm" variant="outline" disabled={busy || mode !== "cloud" || !activeStoreId} onClick={() => void generate()}><RefreshCw size={13} className={busy ? "animate-spin" : ""}/>{busy ? t("正在分析") : suggestion ? t("重新生成") : t("生成建议")}</Button></div>
    </div>
    {mode !== "cloud" ? <p className="mt-3 rounded-xl bg-card/75 px-3 py-2.5 text-xs leading-5 text-muted-foreground">本地数据不会发送给 AI。AI 分析需要云端店铺和 DeepSeek API Key；切换至云端后，可在 <Link href="/ai-settings" className="font-semibold text-primary">AI 设置</Link> 完成配置。</p> : error ? <p role="alert" className="mt-3 rounded-xl border border-border bg-[var(--mc-tint-red)] px-3 py-2.5 text-xs leading-5 text-[var(--mc-color-danger)]">{error} {error.includes("配置") && <Link href="/ai-settings" className="font-semibold underline">前往配置</Link>}</p> : <><div className="mt-3"><AiStreamStatus active={busy} hasText={Boolean(suggestion)}/></div>{suggestion ? <div aria-live="polite" className="mt-2 rounded-xl border border-border bg-card/75 px-3.5 py-3 text-xs text-muted-foreground"><MarkdownContent content={suggestion} className="text-xs leading-6"/></div> : <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles size={12}/>{t("仅发送汇总数值、状态计数和缺失数据提示，不发送订单号、买家信息或密钥。")}</p>}</>}
    {activeStoreId && <DeepSeekUnlockDialog storeId={activeStoreId} open={pinOpen} onOpenChange={setPinOpen} onUnlock={(apiKey) => generate(apiKey)}/>}
  </section>;
}
