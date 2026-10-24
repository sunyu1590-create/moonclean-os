"use client";

import { useState } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeepSeekUnlockDialog } from "@/components/deepseek-unlock-dialog";
import { MarkdownContent } from "@/components/markdown-content";
import { getCachedDeepSeekKey } from "@/lib/deepseek-key";
import { notifyFeedback } from "@/lib/feedback";
import { readAiTextStream } from "@/lib/read-ai-stream";
import { AiStreamStatus } from "@/components/ai-stream-status";
import { useLanguage } from "@/components/language-provider";

export type AiNoteAction = "polish" | "suggest" | "summarize" | "title" | "todos" | "structure" | "tags" | "retrospective";
const actions: Array<[AiNoteAction, string]> = [
  ["polish", "AI 润色"], ["summarize", "总结笔记"], ["title", "生成标题"], ["todos", "提取待办"],
  ["structure", "整理段落"], ["tags", "建议标签"], ["retrospective", "生成运营复盘"], ["suggest", "运营建议"],
];

export function AiNoteTools({ storeId, enabled, title, content, onApply }: {
  storeId: string | null;
  enabled: boolean;
  title: string;
  content: string;
  onApply: (action: AiNoteAction, result: string) => void;
}) {
  const { language, t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<AiNoteAction | null>(null);
  const [pendingAction, setPendingAction] = useState<AiNoteAction | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [result, setResult] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [error, setError] = useState("");

  async function run(nextAction: AiNoteAction, apiKey: string) {
    if (!storeId || !content.trim() || busy) return;
    setBusy(true); setAction(nextAction); setError(""); setResult(""); setSourceContent(content);
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}/workspace/notes-ai`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, action: nextAction, title, content, language }), cache: "no-store",
      });
      let text = "";
      await readAiTextStream(response, delta => { text += delta; setResult(text); });
      if (!text.trim()) throw new Error("AI 未返回有效内容，请重试。");
      notifyFeedback({ kind: "success", title: `${actions.find(([key]) => key === nextAction)?.[1] || "AI 结果"}已生成`, description: "先检查预览，再选择是否应用。" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 处理失败，请重试。");
    } finally { setBusy(false); }
  }

  async function start(nextAction: AiNoteAction) {
    if (!enabled || !storeId || !content.trim() || busy) return;
    setBusy(true); setPendingAction(nextAction);
    let cachedKey: string | null = null;
    try { cachedKey = await getCachedDeepSeekKey(storeId); } catch { /* Open the PIN prompt if the cached session is unavailable. */ }
    if (cachedKey) await run(nextAction, cachedKey);
    else { setBusy(false); setPinOpen(true); }
  }

  const currentAction = t(actions.find(([key]) => key === action)?.[1] || "AI 结果");
  const applyLabel = t(action === "polish" || action === "structure" ? "应用到正文" : action === "title" ? "应用标题" : action === "tags" ? "应用标签" : "插入到笔记");
  const resultIsStale = Boolean(result) && sourceContent !== content;

  return <section className="rounded-xl border border-border bg-[var(--mc-tint-blue)]/45 p-3" aria-label={t("AI 笔记助手")}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-xs font-semibold text-foreground">{t("AI 笔记助手")}</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{t("生成结果先预览，确认后才会写入。")}</p></div>
      <details className="group relative"><summary aria-label={language === "en-US" ? "Open AI note actions" : "打开 AI 笔记操作"} className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[11px] font-medium text-foreground hover:bg-[var(--mc-tint-blue)]"><Sparkles size={14} className="text-primary"/>{t("AI 操作")}<ChevronDown size={13} className="text-muted-foreground transition-transform group-open:rotate-180"/></summary><div className="absolute right-0 top-9 z-30 grid min-w-44 gap-0.5 rounded-xl border border-border bg-card p-1.5 shadow-xl">{actions.map(([key, label]) => <Button key={key} type="button" size="sm" variant="ghost" className="justify-start" disabled={!enabled || busy || !content.trim() || content.length > 12000} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); void start(key); }}><Sparkles size={13}/>{busy && action === key ? t("生成中…") : t(label)}</Button>)}</div></details>
    </div>
    {!enabled && <p className="mt-2 text-[10px] text-muted-foreground">{t("切换到云端店铺并配置 DeepSeek 后可使用 AI 笔记功能。")}</p>}
    {enabled && content.length > 12000 && <p className="mt-2 text-[10px] text-muted-foreground">{language==="en-US"?"The note exceeds the 12,000-character AI limit. Shorten it before continuing.":"当前正文超过 AI 处理上限 12000 字，请先精简内容。"}</p>}
    <div className="mt-2"><AiStreamStatus active={busy && !pinOpen} hasText={Boolean(result)}/></div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-[var(--mc-tint-red)] p-3 text-xs leading-5 text-[var(--mc-color-danger)]">{error}</p>}
    {result && <div className="mt-3 rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-semibold">{currentAction} · 预览</p><span className="text-[10px] text-muted-foreground">{t("尚未写入")}</span></div>
      {resultIsStale && <p className="mb-2 text-[10px] leading-4 text-[var(--mc-color-warning)]">{language==="en-US"?"The source changed after generation. Regenerate to avoid replacing newer content.":"原文在生成后有改动。为避免覆盖新内容，请重新生成结果。"}</p>}
      <div className="max-h-72 overflow-y-auto rounded-lg bg-[var(--mc-tint-blue)]/40 p-3"><MarkdownContent content={result} className="text-xs leading-6"/></div>
      <div className="mt-3 flex flex-wrap justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setResult("")}>丢弃</Button><Button type="button" size="sm" variant="outline" disabled={resultIsStale} onClick={() => { onApply(action || "suggest", result); setResult(""); }}><Check size={14}/>{applyLabel}</Button></div>
    </div>}
    {storeId && <DeepSeekUnlockDialog storeId={storeId} open={pinOpen} onOpenChange={setPinOpen} onUnlock={apiKey => pendingAction ? run(pendingAction, apiKey) : undefined}/>}
  </section>;
}
