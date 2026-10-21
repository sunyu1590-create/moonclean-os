"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Check, CircleAlert, Copy, Eraser, History, KeyRound, LoaderCircle, Maximize2, MessageCircle, Minimize2, Plus, Send, Settings2, Sparkles } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { DeepSeekUnlockDialog } from "@/components/deepseek-unlock-dialog";
import { MarkdownContent } from "@/components/markdown-content";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getCachedDeepSeekKey } from "@/lib/deepseek-key";
import { AiStreamStatus } from "@/components/ai-stream-status";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notifyFeedback } from "@/lib/feedback";

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
const chatCategories = ["未分类", "随便聊聊", "学习", "创作", "灵感", "工作"] as const;
type ChatCategory = typeof chatCategories[number];
type ChatConversation = { id: string; title: string; category: ChatCategory; createdAt: string; updatedAt: string; messages: ChatMessage[] };
const chatKey = (storeId: string, userId: string) => `moonclean-free-ai-chat-v1:${userId}:${storeId}`;
const historyKey = (storeId: string, userId: string) => `moonclean-free-ai-chat-history-v1:${userId}:${storeId}`;
const preferenceKey = (storeId: string, userId: string) => `moonclean-free-ai-chat-preferences-v1:${userId}:${storeId}`;

function readMessages(key: string): ChatMessage[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(rows)) return [];
    return rows.filter((row): row is ChatMessage => Boolean(row) && typeof row === "object" && ["user", "assistant"].includes((row as ChatMessage).role) && typeof (row as ChatMessage).content === "string" && typeof (row as ChatMessage).id === "string");
  } catch { return []; }
}

function readHistory(key: string, legacyKey: string): ChatConversation[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (Array.isArray(rows)) return rows.filter((row): row is ChatConversation => Boolean(row) && typeof row === "object" && typeof (row as ChatConversation).id === "string" && typeof (row as ChatConversation).title === "string" && Array.isArray((row as ChatConversation).messages));
  } catch { /* Migrate the previous single-thread chat below. */ }
  const legacyMessages = readMessages(legacyKey);
  if (!legacyMessages.length) return [];
  const firstQuestion = legacyMessages.find((message) => message.role === "user")?.content || "旧聊天记录";
  const createdAt = legacyMessages[0]?.createdAt || new Date().toISOString();
  return [{ id: crypto.randomUUID(), title: firstQuestion.slice(0, 60), category: "未分类", createdAt, updatedAt: legacyMessages.at(-1)?.createdAt || createdAt, messages: legacyMessages }];
}

function upsertConversation(rows: ChatConversation[], conversation: ChatConversation): ChatConversation[] {
  return [conversation, ...rows.filter((row) => row.id !== conversation.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export default function AiChatPage() {
  const { mode, activeStoreId, user } = useApp();
  const userId = user?.id || "anonymous";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [category, setCategory] = useState<ChatCategory>("随便聊聊");
  const [loadedStoreId, setLoadedStoreId] = useState("");
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState<ModelId>("deepseek-flash");
  const [effort, setEffort] = useState<Effort>("high");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!activeStoreId || mode !== "cloud") {
        setMessages([]); setConfigured(false); setLoadedStoreId(""); return;
      }
      setLoadedStoreId("");
      const conversations = readHistory(historyKey(activeStoreId, userId), chatKey(activeStoreId, userId));
      setHistory(conversations);
      setActiveConversationId(crypto.randomUUID());
      setCategory("随便聊聊");
      setMessages([]);
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
    if (!loadedStoreId || loadedStoreId !== activeStoreId || !activeConversationId || !messages.length) return;
    const firstQuestion = messages.find((message) => message.role === "user")?.content || "新对话";
    const conversation: ChatConversation = { id: activeConversationId, title: firstQuestion.slice(0, 60), category, createdAt: messages[0]?.createdAt || new Date().toISOString(), updatedAt: messages.at(-1)?.createdAt || new Date().toISOString(), messages };
    const timer = window.setTimeout(() => {
      setHistory((current) => {
        const next = upsertConversation(current, conversation);
        try { localStorage.setItem(historyKey(activeStoreId, userId), JSON.stringify(next)); } catch { /* Keep history available in memory if storage is full. */ }
        return next;
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [activeConversationId, activeStoreId, category, loadedStoreId, messages, userId]);

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
  const effortIndex = Math.max(0, efforts.findIndex((item) => item.id === effort));
  const busy = sending || preparing;

  function saveCurrentConversation() {
    if (!messages.length || !activeConversationId) return;
    const title = messages.find((message) => message.role === "user")?.content || "新对话";
    const current: ChatConversation = { id: activeConversationId, title: title.slice(0, 60), category, createdAt: messages[0]?.createdAt || new Date().toISOString(), updatedAt: messages.at(-1)?.createdAt || new Date().toISOString(), messages };
    setHistory((rows) => {
      const next = upsertConversation(rows, current);
      if (activeStoreId) try { localStorage.setItem(historyKey(activeStoreId, userId), JSON.stringify(next)); } catch { /* Keep the active conversation in memory. */ }
      return next;
    });
  }

  function startNewChat() {
    saveCurrentConversation();
    setActiveConversationId(crypto.randomUUID()); setCategory("随便聊聊"); setMessages([]); setDraft(""); setError("");
    notifyFeedback({ kind: "success", title: "已开始新对话", description: "之前的聊天已保存在历史记录中。" });
  }

  function openConversation(conversation: ChatConversation) {
    setActiveConversationId(conversation.id); setCategory(conversation.category); setMessages(conversation.messages); setError(""); setHistoryOpen(false);
  }

  function changeConversationCategory(id: string, nextCategory: ChatCategory) {
    setHistory((current) => {
      const next = current.map((item) => item.id === id ? { ...item, category: nextCategory } : item);
      if (activeStoreId) try { localStorage.setItem(historyKey(activeStoreId, userId), JSON.stringify(next)); } catch { /* Retain the update for this session. */ }
      return next;
    });
    if (id === activeConversationId) setCategory(nextCategory);
  }

  async function sendWithKey(apiKey: string) {
    const content = draft.trim();
    if (!content || busy || !activeStoreId) return;
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
      notifyFeedback({ kind: "success", title: "消息已发送", description: "AI 正在回复，内容会实时显示。" });
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
      notifyFeedback({ kind: "error", title: "发送失败", description: message });
    } finally { setSending(false); setPreparing(false); }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || busy) return;
    if (mode !== "cloud" || !activeStoreId) { setError("AI 聊天需要先切换到云端店铺。"); return; }
    setPreparing(true); setError("");
    notifyFeedback({ kind: "info", title: "正在发送", description: "正在安全连接 AI 服务…" });
    try {
      const key = await getCachedDeepSeekKey(activeStoreId);
      if (key) await sendWithKey(key);
      else { setPreparing(false); setUnlockOpen(true); }
    } catch (cause) {
      setPreparing(false);
      const message = cause instanceof Error ? cause.message : "读取密钥失败，请重试。";
      setError(message); notifyFeedback({ kind: "error", title: "发送失败", description: message });
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault(); void submit();
    }
  }

  function clearChat() {
    const nextHistory = history.filter((conversation) => conversation.id !== activeConversationId);
    setHistory(nextHistory); setMessages([]); setActiveConversationId(crypto.randomUUID()); setCategory("随便聊聊"); setError(""); setClearOpen(false);
    if (activeStoreId) { localStorage.setItem(historyKey(activeStoreId, userId), JSON.stringify(nextHistory)); localStorage.removeItem(chatKey(activeStoreId, userId)); }
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id); window.setTimeout(() => setCopiedId(""), 1600);
    } catch { setError("剪贴板不可用，请检查浏览器权限。"); }
  }

  return <div className={immersive ? "fixed inset-0 z-[70] flex flex-col bg-background px-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : "mx-auto max-w-6xl max-md:-mx-5 max-md:-mt-5"}>
    <div className="mb-3 hidden items-center justify-between gap-2 px-5 md:mb-5 md:flex md:px-0"><div className="min-w-0"><p className="flex items-center gap-2 text-[11px] font-semibold tracking-[.15em] text-primary before:h-px before:w-5 before:bg-primary">AI CHAT / 自由对话</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">AI 聊天</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">自由选择模型和推理强度。这个聊天窗口不读取店铺经营数据。</p></div><div className="flex shrink-0 gap-2"><Link href="/ai-settings" aria-label="AI 设置" className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-[var(--mc-tint-blue)] hover:text-primary md:size-auto md:px-3"><Settings2 size={16}/><span className="hidden md:inline">AI 设置</span></Link><Button variant="outline" size="icon-sm" aria-label="清空聊天" title="清空聊天" onClick={() => setClearOpen(true)} disabled={!messages.length || busy}><Eraser size={15}/></Button></div></div>

    <section aria-label="AI 聊天窗口" className={immersive ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-card" : "flex h-[calc(100dvh-400px)] min-h-[430px] flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_16px_50px_rgba(31,57,82,.075)] max-md:h-[calc(100dvh-240px)] max-md:w-full max-md:rounded-none max-md:border-x-0 max-md:border-b-0 md:min-h-[65dvh] md:rounded-[24px]"}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--mc-tint-blue)]/45 px-3 py-2.5 md:px-5 md:py-3"><div className="flex min-w-0 items-center gap-2"><span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-sm sm:grid"><MessageCircle size={17}/></span><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{category}</h2><p className="truncate text-[10px] text-muted-foreground">{currentModel.name} · 推理{efforts.find((item) => item.id === effort)?.label}</p></div></div><div className="flex items-center gap-1.5"><span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium sm:inline-flex ${configured ? "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]" : "bg-card text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${configured ? "bg-[var(--mc-color-success)]" : "bg-muted-foreground"}`}/>{mode !== "cloud" ? "需要云端店铺" : configured ? "密钥已就绪" : "待配置 DeepSeek"}</span><Button variant="outline" size="icon-sm" aria-label="聊天历史" title="聊天历史" onClick={() => { saveCurrentConversation(); setHistoryOpen(true); }} className="size-9"><History size={16}/></Button><Button variant="outline" size="icon-sm" aria-label="新建聊天" title="新建聊天" onClick={startNewChat} disabled={busy} className="size-9"><Plus size={17}/></Button><Button variant="outline" size="icon-sm" aria-label={immersive ? "退出沉浸模式" : "沉浸模式"} title={immersive ? "退出沉浸模式" : "沉浸模式"} onClick={() => setImmersive((value) => !value)} className="size-9">{immersive ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</Button></div></header>
      <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 md:py-6">
        {mode === "cloud" && activeStoreId && loadedStoreId !== activeStoreId ? <p role="status" className="py-12 text-center text-xs text-muted-foreground">正在读取这台设备的聊天内容…</p> : mode !== "cloud" ? <div className="mx-auto max-w-md rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-5 text-center"><KeyRound size={23} className="mx-auto text-primary"/><h3 className="mt-3 text-sm font-semibold">先切换到云端店铺</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">自由聊天使用当前店铺保存的 DeepSeek 密钥；不会读取店铺经营数据。</p></div> : !configured && messages.length === 0 ? <div className="mx-auto max-w-xl py-12 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary"><Sparkles size={24}/></span><h3 className="mt-4 text-base font-semibold">想聊点什么？</h3><p className="mt-1 text-xs text-muted-foreground">先到 AI 设置保存 DeepSeek Key，就可以开始自由对话。</p><Link href="/ai-settings" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><KeyRound size={15}/>配置 AI 密钥</Link></div> : messages.length === 0 ? <div className="mx-auto max-w-2xl py-10 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary"><Sparkles size={24}/></span><h3 className="mt-4 text-base font-semibold">随心开始一段对话</h3><p className="mt-1 text-xs text-muted-foreground">可以问问题、聊兴趣、写故事、头脑风暴，或试试不同模型与推理强度。</p><div className="mt-5 flex flex-wrap justify-center gap-2">{["讲个短一点的科幻故事", "给我设计一个周末小游戏", "解释一下为什么天空是蓝色的", "来一轮脑筋急转弯"].map((prompt) => <button key={prompt} type="button" onClick={() => setDraft(prompt)} className="rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-[var(--mc-tint-blue)] hover:text-primary">{prompt}</button>)}</div></div> : messages.map((message) => <article key={message.id} className={`group flex gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`${message.role === "user" ? "max-w-[92%]" : "w-full max-w-full sm:w-auto sm:max-w-[82%]"} min-w-0 rounded-2xl px-3.5 py-3 sm:px-4 ${message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-[var(--mc-tint-blue)]/45 text-foreground"}`}><div className={`mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold ${message.role === "user" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{message.role === "user" ? "你" : <><Bot size={12}/>DeepSeek · {message.model || model}</>}</div>{message.role === "assistant" ? message.content ? <MarkdownContent content={message.content} className="text-base leading-7"/>: sending ? <span className="py-1"><AiStreamStatus active hasText={false}/></span> : <p className="text-xs text-muted-foreground">暂无回复内容</p> : <p className="whitespace-pre-wrap break-words text-base leading-7">{message.content}</p>}{message.role === "assistant" && message.content && <button type="button" onClick={() => void copyMessage(message)} className="mt-2 flex min-h-7 items-center gap-1 text-[10px] text-muted-foreground opacity-70 transition-opacity hover:text-primary group-hover:opacity-100">{copiedId === message.id ? <Check size={12}/> : <Copy size={12}/>}{copiedId === message.id ? "已复制" : "复制回复"}</button>}</div></article>)}
        {error && <p role="alert" className="mx-auto flex max-w-2xl items-start gap-2 rounded-xl bg-[var(--mc-tint-red)] p-3 text-xs leading-5 text-[var(--mc-color-danger)]"><CircleAlert size={15} className="mt-0.5 shrink-0"/>{error}</p>}
        <div ref={endRef}/>
      </div>
      <form onSubmit={(event) => void submit(event)} className="border-t border-border bg-card/95 p-3 sm:p-4">
        <div className="relative">
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleInputKeyDown} disabled={busy || mode !== "cloud"} rows={3} placeholder={mode !== "cloud" ? "切换到云端店铺后开始聊天…" : "发消息给 DeepSeek…"} className="min-h-20 max-h-36 resize-none rounded-2xl border-border bg-background py-3 pr-14 text-sm leading-6"/>
          <Button type="submit" aria-label={busy ? "正在发送消息" : "发送消息"} disabled={busy || !draft.trim() || mode !== "cloud"} className="absolute bottom-2.5 right-2.5 size-10 rounded-xl p-0 transition-all duration-200 active:scale-90 disabled:opacity-60">{busy ? <LoaderCircle size={17} className="animate-spin"/> : <Send size={16} className="transition-transform duration-200 group-hover:translate-x-0.5"/>}</Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <AppSelect aria-label="选择模型" value={model} disabled={busy} onChange={(event) => setModel(event.target.value as ModelId)} className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-2.5 text-xs font-medium sm:flex-none sm:min-w-48 sm:px-3 sm:text-sm"><option value="deepseek-flash">V4.1 Flash</option><option value="deepseek-v4-pro">V4 Pro</option></AppSelect>
          <AppSelect aria-label="聊天分类" value={category} disabled={busy} onChange={(event) => setCategory(event.target.value as ChatCategory)} className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-2.5 text-xs font-medium sm:flex-none sm:min-w-36"><option value="未分类">未分类</option>{chatCategories.filter((item) => item !== "未分类").map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect>
          <span className="hidden text-[10px] text-muted-foreground lg:inline">{currentModel.note}</span>
        </div>
        <fieldset disabled={busy} className="mt-2">
          <legend className="sr-only">推理强度</legend>
          <div className="relative grid grid-cols-4 rounded-xl border border-border bg-muted/55 p-1" role="group" aria-label="推理强度">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-1 left-1 w-[calc(25%-2px)] rounded-lg border border-primary/20 bg-card shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `translateX(${effortIndex * 100}%)` }}/>
            {efforts.map((item) => <button key={item.id} type="button" aria-pressed={effort === item.id} onClick={() => setEffort(item.id)} className={`relative z-10 min-h-8 rounded-lg px-1 text-[10px] font-medium transition-colors duration-200 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${effort === item.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}
          </div>
        </fieldset>
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{efforts.find((item) => item.id === effort)?.detail}</span><span className="hidden sm:inline">Enter 发送 · Shift + Enter 换行</span></div>
      </form>
    </section>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="max-h-[min(82dvh,720px)] overflow-hidden rounded-[24px] border border-border bg-card p-0 sm:max-w-xl"><DialogHeader className="border-b border-border px-5 py-4"><DialogTitle>聊天历史</DialogTitle><DialogDescription>每次进入聊天都会开启新对话，历史记录仅保存在这台设备和当前店铺。</DialogDescription></DialogHeader><div className="max-h-[60dvh] space-y-2 overflow-y-auto p-3 sm:p-4">{history.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">还没有保存的聊天记录</div> : history.map((conversation) => <div key={conversation.id} className="flex items-center gap-2 rounded-2xl border border-border bg-background p-3"><button type="button" onClick={() => openConversation(conversation)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{conversation.title}</span><span className="mt-1 block text-xs text-muted-foreground">{conversation.category} · {new Date(conversation.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {conversation.messages.filter((message) => message.role === "user").length} 条消息</span></button><AppSelect aria-label={`更改“${conversation.title}”分类`} value={conversation.category} onChange={(event) => changeConversationCategory(conversation.id, event.target.value as ChatCategory)} className="h-9 w-24 shrink-0 rounded-xl border border-border bg-card px-2 text-xs">{chatCategories.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></div>)}</div><div className="flex justify-end border-t border-border p-3"><Button onClick={() => { setHistoryOpen(false); startNewChat(); }}><Plus size={16}/>新建聊天</Button></div></DialogContent></Dialog>
    {activeStoreId && <DeepSeekUnlockDialog storeId={activeStoreId} open={unlockOpen} onOpenChange={setUnlockOpen} onUnlock={(apiKey) => sendWithKey(apiKey)}/>}
    <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>清空这段聊天？</AlertDialogTitle><AlertDialogDescription>当前浏览器保存的聊天内容会被删除，不能撤回。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>返回</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); clearChat(); }}>清空聊天</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
