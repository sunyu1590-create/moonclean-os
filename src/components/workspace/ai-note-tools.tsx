"use client";

import { useState } from "react";
import { Check, ChevronDown, Lightbulb, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeepSeekUnlockDialog } from "@/components/deepseek-unlock-dialog";
import { MarkdownContent } from "@/components/markdown-content";
import { getCachedDeepSeekKey } from "@/lib/deepseek-key";
import { notifyFeedback } from "@/lib/feedback";
import { readAiTextStream } from "@/lib/read-ai-stream";
import { AiStreamStatus } from "@/components/ai-stream-status";

type Action = "polish" | "suggest";

export function AiNoteTools({ storeId, enabled, title, content, onApply }: {
  storeId: string | null;
  enabled: boolean;
  title: string;
  content: string;
  onApply: (action: Action, result: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function run(nextAction: Action, apiKey: string) {
    if (!storeId || !content.trim() || busy) return;
    setBusy(true); setAction(nextAction); setError(""); setResult("");
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}/workspace/notes-ai`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, action: nextAction, title, content }), cache: "no-store",
      });
      let text = "";
      await readAiTextStream(response, (delta) => { text += delta; setResult(text); });
      if (!text.trim()) throw new Error("AI 未返回有效内容，请重试。");
      notifyFeedback({ kind: "success", title: nextAction === "polish" ? "润色预览已生成" : "AI 建议已生成", description: "确认后才会写入当前笔记。" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 处理失败，请重试。");
    } finally { setBusy(false); }
  }

  async function start(nextAction: Action) {
    if (!enabled || !storeId || !content.trim() || busy) return;
    setBusy(true);
    setPendingAction(nextAction);
    let cachedKey: string | null = null;
    try { cachedKey = await getCachedDeepSeekKey(storeId); } catch { /* Open the PIN prompt if the cached session is unavailable. */ }
    if (cachedKey) await run(nextAction, cachedKey);
    else { setBusy(false); setPinOpen(true); }
  }

  return <section className="rounded-2xl border border-border bg-[var(--mc-tint-blue)]/55 p-3 sm:p-4" aria-label="AI 笔记工具">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-xs font-semibold text-foreground">AI 笔记助手</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">生成 Markdown 润色或行动建议，确认后写入笔记。</p></div>
      <details className="group relative"><summary aria-label="打开 AI 笔记选项" className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-[var(--mc-tint-blue)]"><Sparkles size={14} className="text-primary"/>AI 选项<ChevronDown size={13} className="text-muted-foreground transition-transform group-open:rotate-180"/></summary><div className="absolute right-0 top-10 z-20 grid min-w-40 gap-1 rounded-xl border border-border bg-card p-2 shadow-lg"><Button type="button" size="sm" variant="ghost" disabled={!enabled || busy || !content.trim() || content.length > 12000} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void start("polish"); }}><WandSparkles size={14}/>{busy && action === "polish" ? "润色中…" : "AI 润色"}</Button><Button type="button" size="sm" variant="ghost" disabled={!enabled || busy || !content.trim() || content.length > 12000} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); void start("suggest"); }}><Lightbulb size={14}/>{busy && action === "suggest" ? "整理建议…" : "AI 建议"}</Button></div></details>
    </div>
    {!enabled && <p className="mt-2 text-[10px] text-muted-foreground">切换到云端店铺并配置 DeepSeek 后可使用 AI 笔记功能。</p>}
    {enabled && content.length > 12000 && <p className="mt-2 text-[10px] text-muted-foreground">当前正文超过 AI 处理上限 12000 字，请先精简内容。</p>}
    <div className="mt-2"><AiStreamStatus active={busy && !pinOpen} hasText={Boolean(result)}/></div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-[var(--mc-tint-red)] p-3 text-xs leading-5 text-[var(--mc-color-danger)]">{error}</p>}
    {result && <div className="mt-3 rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-semibold">{action === "polish" ? "润色预览" : "行动建议"}</p><span className="text-[10px] text-muted-foreground">尚未写入笔记</span></div>
      <div className="max-h-72 overflow-y-auto rounded-lg bg-[var(--mc-tint-blue)]/50 p-3"><MarkdownContent content={result} className="text-xs leading-6"/></div>
      <div className="mt-3 flex flex-wrap justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setResult("")}>丢弃</Button><Button type="button" size="sm" variant="outline" onClick={() => { onApply(action || "suggest", result); setResult(""); }}><Check size={14}/>{action === "polish" ? "替换正文" : "插入建议并预览"}</Button></div>
    </div>}
    {storeId && <DeepSeekUnlockDialog storeId={storeId} open={pinOpen} onOpenChange={setPinOpen} onUnlock={(apiKey) => pendingAction ? run(pendingAction, apiKey) : undefined}/>}
  </section>;
}
