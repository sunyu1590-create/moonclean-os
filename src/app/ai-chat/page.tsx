"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Check, CircleAlert, Copy, Eraser, KeyRound, LoaderCircle, MessageCircle, Send, Settings2, Sparkles, WandSparkles } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { DeepSeekUnlockDialog } from "@/components/deepseek-unlock-dialog";
import { MarkdownContent } from "@/components/markdown-content";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getCachedDeepSeekKey } from "@/lib/deepseek-key";

const models = [
  { id: "deepseek-flash", name: "DeepSeek V4.1 Flash", note: "响应快，适合轻松对话" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", note: "更强的综合理解能力" },
] as const;
const efforts = [
  { id: "none", label: "关闭", detail: "直接回答" },
  { id: "low", label: "轻量", detail: "快速思考" },
  { id: "high", label: "均衡", detail: "默认推荐" },
  { id: "max", label: "深入", detail: "更充分推理" },
] as const;
type ModelId = typeof models[number]["id"];
type Effort = typeof efforts[number]["id"];
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string; model?: string };
const chatKey = (storeId: string, userId: string) => `moonclean-free-ai-chat-v1:${userId}:${storeId}`;
const preferenceKey = (storeId: string, userId: string) => `moonclean-free-ai-chat-preferences-v1:${userId}:${storeId}`;

function readMessages(key: string): ChatMessage[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(rows)) return [];
    return rows.filter((row): row is ChatMessage => Boolean(row) && typeof row === "object" && ["user", "assistant"].includes((row as ChatMessage).role) && typeof (row as ChatMessage).content === "string" && typeof (row as ChatMessage).id === "string");
  } catch { return []; }
}

export default function AiChatPage() {
  const { mode, activeStoreId, user } = useApp();
  const userId = user?.id || "anonymous";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadedStoreId, setLoadedStoreId] = useState("");
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState<ModelId>("deepseek-flash");
  const [effort, setEffort] = useState<Effort>("high");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!activeStoreId || mode !== "cloud") {
        setMessages([]); setConfigured(false); setLoadedStoreId(""); return;
      }
      setLoadedStoreId("");
      setMessages(readMessages(chatKey(activeStoreId, userId)));
      try {
        const saved = JSON.parse(localStorage.getItem(preferenceKey(activeStoreId, userId)) || "null") as { model?: string; effort?: string } | null;
        if (models.some((item) => item.id === saved?.model)) setModel(saved!.model as ModelId);
        if (efforts.some((item) => item.id === saved?.effort)) setEffort(saved!.effort as Effort);
      } catch { /* Keep the defaults when local preferences cannot be read. */ }
      setLoadedStoreId(activeStoreId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeStoreId, mode, userId]);

  useEffect(() => {
    if (loadedStoreId && loadedStoreId === activeStoreId) {
      try { localStorage.setItem(chatKey(loadedStoreId, userId), JSON.stringify(messages)); } catch { /* Keep the current conversation in memory if local storage is full. */ }
    }
  }, [activeStoreId, loadedStoreId, messages, userId]);

  useEffect(() => {
    if (!activeStoreId || mode !== "cloud") {
      const frame = window.requestAnimationFrame(() => setConfigured(false));
      return () => window.cancelAnimationFrame(frame);
    }
    let cancelled = false;
    fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/ai/deepseek`, { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.json())
      .then((result: { configured?: boolean }) => { if (!cancelled) setConfigured(Boolean(result.configured)); })
      .catch(() => { if (!cancelled) setConfigured(false); });
    return () => { cancelled = true; };
  }, [activeStoreId, mode]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  useEffect(() => {
    if (!activeStoreId || loadedStoreId !== activeStoreId) return;
    try { localStorage.setItem(preferenceKey(activeStoreId, userId), JSON.stringify({ model, effort })); } catch { /* Preferences remain active for this session. */ }
  }, [activeStoreId, effort, loadedStoreId, model, userId]);

  const currentModel = useMemo(() => models.find((item) => item.id === model) || models[0], [model]);

  async function sendWithKey(apiKey: string) {
    const content = draft.trim();
    if (!content || sending || !activeStoreId) return;
    setSending(true); setError(""); setDraft("");
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content, createdAt: new Date().toISOString() };
    const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "", createdAt: new Date().toISOString(), model };
    const nextMessages = [...messages, userMessage, assistantMessage];
    setMessages(nextMessages);
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/ai/chat`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model, reasoningEffort: effort, messages: [...messages, userMessage].map(({ role, content: messageContent }) => ({ role, content: messageContent })) }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || "AI 回复失败，请重试。");
      }
      if (!response.body) throw new Error("浏览器无法读取 AI 流式回复。");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n");
        buffer = events.pop() || "";
        for (const line of events) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") { finished = true; break; }
          try {
            const event = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; error?: { message?: string } };
            const delta = event.choices?.[0]?.delta?.content;
            if (typeof delta === "string") {
              answer += delta;
              setMessages([...nextMessages.slice(0, -1), { ...assistantMessage, content: answer }]);
            }
            if (event.error?.message) throw new Error(event.error.message);
          } catch (cause) {
            if (cause instanceof SyntaxError) continue;
            throw cause;
          }
        }
      }
      if (!answer.trim()) throw new Error("模型没有返回文本内容，请检查所选模型和账号权限。");
      setConfigured(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "AI 回复失败，请重试。";
      setError(message);
      setMessages(nextMessages.slice(0, -1));
    } finally { setSending(false); }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || sending) return;
    if (mode !== "cloud" || !activeStoreId) { setError("AI 聊天需要先切换到云端店铺。"); return; }
    const key = await getCachedDeepSeekKey(activeStoreId);
    if (key) await sendWithKey(key);
    else setUnlockOpen(true);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault(); void submit();
    }
  }

  function clearChat() {
    setMessages([]); setError(""); setClearOpen(false);
    if (activeStoreId) localStorage.removeItem(chatKey(activeStoreId, userId));
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id); window.setTimeout(() => setCopiedId(""), 1600);
    } catch { setError("剪贴板不可用，请检查浏览器权限。"); }
  }

  return <div className="mx-auto max-w-6xl">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[.15em] text-primary before:h-px before:w-5 before:bg-primary">AI CHAT / 自由对话</p><h1 className="page-title">AI 聊天</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">自由选择模型和推理强度。这个聊天窗口不读取店铺经营数据。</p></div><div className="flex gap-2"><Link href="/ai-settings" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-[var(--mc-tint-blue)]"><Settings2 size={16}/>AI 设置</Link><Button variant="outline" onClick={() => setClearOpen(true)} disabled={!messages.length || sending}><Eraser size={15}/>清空聊天</Button></div></div>

    <section className="mb-4 grid gap-4 rounded-2xl border border-border bg-card/85 p-4 shadow-[0_8px_28px_rgba(31,57,82,.06)] backdrop-blur-xl md:grid-cols-[minmax(230px,1.1fr)_minmax(0,1.4fr)] md:p-5">
      <div><Label htmlFor="free-chat-model" className="flex items-center gap-2"><Bot size={15} className="text-primary"/>选择模型</Label><AppSelect id="free-chat-model" value={model} disabled={sending} onChange={(event) => setModel(event.target.value as ModelId)} className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-medium"><option value="deepseek-flash">DeepSeek V4.1 Flash</option><option value="deepseek-v4-pro">DeepSeek V4 Pro</option></AppSelect><p className="mt-1.5 text-[11px] text-muted-foreground">{currentModel.note} · 以 DeepSeek API 当前可用模型为准</p></div>
      <fieldset disabled={sending} className="min-w-0"><legend className="mb-2 flex items-center gap-2 text-sm font-medium"><WandSparkles size={15} className="text-primary"/>推理强度</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{efforts.map((item) => <button key={item.id} type="button" aria-pressed={effort === item.id} onClick={() => setEffort(item.id)} className={`min-h-11 rounded-xl border px-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${effort === item.id ? "border-primary/50 bg-[var(--mc-tint-blue)] text-primary shadow-sm" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}><span className="flex items-center justify-between gap-1 text-xs font-semibold">{item.label}{effort === item.id && <Check size={13}/>}</span><span className="mt-0.5 block text-[10px] opacity-80">{item.detail}</span></button>)}</div></fieldset>
    </section>

    <section aria-label="AI 聊天窗口" className="flex min-h-[65dvh] flex-col overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_16px_50px_rgba(31,57,82,.075)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--mc-tint-blue)]/45 px-4 py-3 md:px-5"><div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-card text-primary shadow-sm"><MessageCircle size={17}/></span><div><h2 className="text-sm font-semibold">随便聊聊</h2><p className="text-[10px] text-muted-foreground">{model} · 推理{efforts.find((item) => item.id === effort)?.label}</p></div></div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${configured ? "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]" : "bg-card text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${configured ? "bg-[var(--mc-color-success)]" : "bg-muted-foreground"}`}/>{mode !== "cloud" ? "需要云端店铺" : configured ? "密钥已就绪" : "待配置 DeepSeek"}</span></header>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5 md:py-6">
        {mode === "cloud" && activeStoreId && loadedStoreId !== activeStoreId ? <p role="status" className="py-12 text-center text-xs text-muted-foreground">正在读取这台设备的聊天内容…</p> : mode !== "cloud" ? <div className="mx-auto max-w-md rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-5 text-center"><KeyRound size={23} className="mx-auto text-primary"/><h3 className="mt-3 text-sm font-semibold">先切换到云端店铺</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">自由聊天使用当前店铺保存的 DeepSeek 密钥；不会读取店铺经营数据。</p></div> : !configured && messages.length === 0 ? <div className="mx-auto max-w-xl py-12 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary"><Sparkles size={24}/></span><h3 className="mt-4 text-base font-semibold">想聊点什么？</h3><p className="mt-1 text-xs text-muted-foreground">先到 AI 设置保存 DeepSeek Key，就可以开始自由对话。</p><Link href="/ai-settings" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><KeyRound size={15}/>配置 AI 密钥</Link></div> : messages.length === 0 ? <div className="mx-auto max-w-2xl py-10 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary"><Sparkles size={24}/></span><h3 className="mt-4 text-base font-semibold">随心开始一段对话</h3><p className="mt-1 text-xs text-muted-foreground">可以问问题、聊兴趣、写故事、头脑风暴，或试试不同模型与推理强度。</p><div className="mt-5 flex flex-wrap justify-center gap-2">{["讲个短一点的科幻故事", "给我设计一个周末小游戏", "解释一下为什么天空是蓝色的", "来一轮脑筋急转弯"].map((prompt) => <button key={prompt} type="button" onClick={() => setDraft(prompt)} className="rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-[var(--mc-tint-blue)] hover:text-primary">{prompt}</button>)}</div></div> : messages.map((message) => <article key={message.id} className={`group flex gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[92%] min-w-0 rounded-2xl px-3.5 py-3 sm:max-w-[82%] sm:px-4 ${message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-[var(--mc-tint-blue)]/45 text-foreground"}`}><div className={`mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold ${message.role === "user" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{message.role === "user" ? "你" : <><Bot size={12}/>DeepSeek · {message.model || model}</>}</div>{message.role === "assistant" ? message.content ? <MarkdownContent content={message.content} className="text-sm leading-6"/> : sending ? <span className="inline-flex items-center gap-2 py-1 text-xs text-muted-foreground"><LoaderCircle size={14} className="animate-spin"/>正在思考…</span> : <p className="text-xs text-muted-foreground">暂无回复内容</p> : <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>}{message.role === "assistant" && message.content && <button type="button" onClick={() => void copyMessage(message)} className="mt-2 flex min-h-7 items-center gap-1 text-[10px] text-muted-foreground opacity-70 transition-opacity hover:text-primary group-hover:opacity-100">{copiedId === message.id ? <Check size={12}/> : <Copy size={12}/>}{copiedId === message.id ? "已复制" : "复制回复"}</button>}</div></article>)}
        {error && <p role="alert" className="mx-auto flex max-w-2xl items-start gap-2 rounded-xl bg-[var(--mc-tint-red)] p-3 text-xs leading-5 text-[var(--mc-color-danger)]"><CircleAlert size={15} className="mt-0.5 shrink-0"/>{error}</p>}
        <div ref={endRef}/>
      </div>
      <form onSubmit={(event) => void submit(event)} className="border-t border-border bg-card/90 p-3 sm:p-4"><div className="relative"><Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleInputKeyDown} disabled={sending || mode !== "cloud"} rows={3} placeholder={mode !== "cloud" ? "切换到云端店铺后开始聊天…" : "输入消息，按 Enter 发送，Shift + Enter 换行…"} className="min-h-20 resize-y rounded-2xl border-border bg-background py-3 pr-14 text-sm leading-6"/><Button type="submit" aria-label="发送消息" disabled={sending || !draft.trim() || mode !== "cloud"} className="absolute bottom-2.5 right-2.5 size-9 rounded-xl p-0"><Send size={16}/></Button></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>聊天内容保存在当前浏览器，不会混入 Copilot 经营对话，也不会自动发送店铺数据。</span><span>Enter 发送 · Shift + Enter 换行</span></div></form>
    </section>
    {activeStoreId && <DeepSeekUnlockDialog storeId={activeStoreId} open={unlockOpen} onOpenChange={setUnlockOpen} onUnlock={(apiKey) => sendWithKey(apiKey)}/>}
    <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>清空这段聊天？</AlertDialogTitle><AlertDialogDescription>当前浏览器保存的聊天内容会被删除，不能撤回。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>返回</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); clearChat(); }}>清空聊天</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
