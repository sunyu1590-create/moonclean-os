"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Archive, ArchiveRestore, Bot, Check, ChevronDown, CircleAlert, Copy, Eraser, History, ImagePlus, KeyRound, LoaderCircle, Maximize2, MessageCircle, Minimize2, Pin, Plus, Search, Send, Settings2, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { DeepSeekUnlockDialog } from "@/components/deepseek-unlock-dialog";
import { MarkdownContent } from "@/components/markdown-content";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getCachedDeepSeekKey } from "@/lib/deepseek-key";
import { AiStreamStatus } from "@/components/ai-stream-status";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { notifyFeedback } from "@/lib/feedback";
import { useLanguage } from "@/components/language-provider";

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
const effortTextTone: Record<Effort, string> = { none: "text-slate-600", low: "text-teal-700", high: "text-blue-700", max: "text-violet-700" };
type ChatSource = { title: string; url: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string; model?: string; sources?: ChatSource[] };
const chatCategories = ["未分类", "随便聊聊", "学习", "创作", "灵感", "工作"] as const;
type ChatCategory = typeof chatCategories[number];
type ChatConversation = { id: string; title: string; category: ChatCategory; createdAt: string; updatedAt: string; messages: ChatMessage[]; pinned?: boolean; archivedAt?: string | null };
type HistorySource = "local" | "cloud";
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
  if (Array.isArray(rows)) return rows.filter((row): row is ChatConversation => Boolean(row) && typeof row === "object" && typeof (row as ChatConversation).id === "string" && typeof (row as ChatConversation).title === "string" && Array.isArray((row as ChatConversation).messages)).map((row) => ({ ...row, pinned: Boolean(row.pinned), archivedAt: typeof row.archivedAt === "string" ? row.archivedAt : null }));
  } catch { /* Migrate the previous single-thread chat below. */ }
  const legacyMessages = readMessages(legacyKey);
  if (!legacyMessages.length) return [];
  const firstQuestion = legacyMessages.find((message) => message.role === "user")?.content || "旧聊天记录";
  const createdAt = legacyMessages[0]?.createdAt || new Date().toISOString();
  return [{ id: crypto.randomUUID(), title: firstQuestion.slice(0, 60), category: "未分类", createdAt, updatedAt: legacyMessages.at(-1)?.createdAt || createdAt, messages: legacyMessages }];
}

function upsertConversation(rows: ChatConversation[], conversation: ChatConversation): ChatConversation[] {
  const existing = rows.find((row) => row.id === conversation.id);
  return [{ ...existing, ...conversation }, ...rows.filter((row) => row.id !== conversation.id)].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt));
}

export default function AiChatPage() {
  const { language, t } = useLanguage();
  const { mode, activeStoreId, user } = useApp();
  const userId = user?.id || "anonymous";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ChatConversation[]>([]);
  const [historySource, setHistorySource] = useState<HistorySource>("local");
  const [historyBusy, setHistoryBusy] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [category, setCategory] = useState<ChatCategory>("随便聊聊");
  const [loadedStoreId, setLoadedStoreId] = useState("");
  const [draft, setDraft] = useState("");
  const [ocrImage, setOcrImage] = useState<File | null>(null);
  const [ocrPreview, setOcrPreview] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState("");
  const [model, setModel] = useState<ModelId>("deepseek-flash");
  const [effort, setEffort] = useState<Effort>("high");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteHistoryId, setDeleteHistoryId] = useState("");
  const [sending, setSending] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyView, setHistoryView] = useState<"active" | "archived">("active");
  const [historySearch, setHistorySearch] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [immersiveClosing, setImmersiveClosing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [effortPulse, setEffortPulse] = useState(0);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const ocrRequestRef = useRef(0);
  const immersiveTimerRef = useRef<number | null>(null);
  const historyRef = useRef<ChatConversation[]>([]);
  const historyScope = `${userId}:${activeStoreId || ""}`;
  const historyScopeRef = useRef(historyScope);
  historyScopeRef.current = historyScope;

  useEffect(() => {
    historyScopeRef.current = historyScope;
    return () => { if (historyScopeRef.current === historyScope) historyScopeRef.current = ""; };
  }, [historyScope]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!activeStoreId || mode !== "cloud") {
        setMessages([]); setConfigured(false); setLoadedStoreId(""); return;
      }
      if (historySource === "cloud") return;
      setLoadedStoreId("");
      const conversations = readHistory(historyKey(activeStoreId, userId), chatKey(activeStoreId, userId));
      historyRef.current = conversations;
      setHistory(conversations);
      setActiveConversationId(crypto.randomUUID());
      setCategory("随便聊聊");
      setMessages([]);
      try {
        const saved = JSON.parse(localStorage.getItem(preferenceKey(activeStoreId, userId)) || "null") as { model?: string; effort?: string; webSearch?: boolean } | null;
        if (models.some((item) => item.id === saved?.model)) setModel(saved!.model as ModelId);
        if (efforts.some((item) => item.id === saved?.effort)) setEffort(saved!.effort as Effort);
        setWebSearch(Boolean(saved?.webSearch));
      } catch { /* Keep the defaults when local preferences cannot be read. */ }
      setLoadedStoreId(activeStoreId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeStoreId, historySource, mode, userId]);

  useEffect(() => {
    if (historySource !== "cloud" || !activeStoreId || mode !== "cloud") return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setHistoryBusy(true);
      return fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/free-ai-chat`, { credentials: "same-origin", cache: "no-store" });
    })
      .then(async (response) => { const result = await response.json().catch(() => ({})) as { error?: string; conversations?: ChatConversation[] }; if (!response.ok) throw new Error(result.error || "读取云端对话失败"); return result; })
      .then((result) => { if (!cancelled) { const rows = Array.isArray(result.conversations) ? result.conversations : []; historyRef.current = rows; setHistory(rows); setLoadedStoreId(activeStoreId); } })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "读取云端对话失败"); })
      .finally(() => { if (!cancelled) setHistoryBusy(false); });
    return () => { cancelled = true; };
  }, [activeStoreId, historySource, mode]);

  useEffect(() => {
    if (!loadedStoreId || loadedStoreId !== activeStoreId || !activeConversationId || !messages.length) return;
    const firstQuestion = messages.find((message) => message.role === "user")?.content || "新对话";
    const conversation: ChatConversation = { id: activeConversationId, title: firstQuestion.slice(0, 60), category, createdAt: messages[0]?.createdAt || new Date().toISOString(), updatedAt: messages.at(-1)?.createdAt || new Date().toISOString(), messages };
    const timer = window.setTimeout(() => persistHistory(upsertConversation(historyRef.current, conversation)), 200);
    return () => window.clearTimeout(timer);
    // persistHistory synchronizes the latest conversation state for this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, activeStoreId, category, historySource, loadedStoreId, messages, userId]);

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

  useEffect(() => () => { if (ocrPreview) URL.revokeObjectURL(ocrPreview); }, [ocrPreview]);

  useEffect(() => {
    ocrRequestRef.current += 1;
    const frame = window.requestAnimationFrame(() => {
      setOcrImage(null); setOcrPreview(""); setOcrText(""); setOcrBusy(false); setOcrProgress(0); setOcrError("");
      if (ocrInputRef.current) ocrInputRef.current.value = "";
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeStoreId, mode]);

  useEffect(() => {
    if (!activeStoreId || loadedStoreId !== activeStoreId) return;
    try { localStorage.setItem(preferenceKey(activeStoreId, userId), JSON.stringify({ model, effort, webSearch })); } catch { /* Preferences remain active for this session. */ }
  }, [activeStoreId, effort, loadedStoreId, model, userId, webSearch]);

  const currentModel = useMemo(() => models.find((item) => item.id === model) || models[0], [model]);
  const effortIndex = Math.max(0, efforts.findIndex((item) => item.id === effort));
  const busy = sending || preparing;
  const visibleHistory = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase();
    return history.filter((conversation) => Boolean(conversation.archivedAt) === (historyView === "archived") && (!query || conversation.title.toLocaleLowerCase().includes(query) || conversation.messages.some((message) => message.content.toLocaleLowerCase().includes(query))));
  }, [history, historySearch, historyView]);

  useEffect(() => {
    if (!immersive) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") exitImmersive();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; };
  // This listener only needs to track whether immersive mode is mounted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersive]);

  useEffect(() => () => { if (immersiveTimerRef.current) window.clearTimeout(immersiveTimerRef.current); }, []);

  function enterImmersive() {
    if (immersiveTimerRef.current) window.clearTimeout(immersiveTimerRef.current);
    setImmersiveClosing(false);
    setImmersive(true);
  }

  function exitImmersive() {
    if (!immersive || immersiveClosing) return;
    setImmersiveClosing(true);
    immersiveTimerRef.current = window.setTimeout(() => {
      setImmersive(false);
      setImmersiveClosing(false);
      immersiveTimerRef.current = null;
    }, 220);
  }

  function saveCurrentConversation() {
    if (!messages.length || !activeConversationId) return;
    const title = messages.find((message) => message.role === "user")?.content || "新对话";
    const current: ChatConversation = { id: activeConversationId, title: title.slice(0, 60), category, createdAt: messages[0]?.createdAt || new Date().toISOString(), updatedAt: messages.at(-1)?.createdAt || new Date().toISOString(), messages };
    persistHistory(upsertConversation(historyRef.current, current));
  }

  function persistHistory(next: ChatConversation[]) {
    const previous = historyRef.current;
    historyRef.current = next;
    setHistory(next);
    if (!activeStoreId) return;
    if (historySource === "local") {
      try { localStorage.setItem(historyKey(activeStoreId, userId), JSON.stringify(next)); } catch { /* Keep history available in memory when local storage is full. */ }
      return;
    }
    const previousById = new Map(previous.map((item) => [item.id, item]));
    const nextById = new Map(next.map((item) => [item.id, item]));
    for (const item of next) if (JSON.stringify(previousById.get(item.id)) !== JSON.stringify(item)) {
      void fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/free-ai-chat`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) }).then(async (response) => { if (!response.ok) { const result = await response.json().catch(() => ({})) as { error?: string }; setError(result.error || "保存云端对话失败"); } }).catch(() => setError("网络异常，云端对话未能保存。"));
    }
    for (const item of previous) if (!nextById.has(item.id)) void fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/free-ai-chat?id=${encodeURIComponent(item.id)}`, { method: "DELETE", credentials: "same-origin" }).catch(() => setError("网络异常，云端对话未能删除。"));
  }

  function switchHistorySource(next: HistorySource) {
    if (next === historySource) return;
    saveCurrentConversation();
    setMessages([]); setActiveConversationId(crypto.randomUUID()); setCategory("随便聊聊"); setError("");
    historyRef.current = []; setHistory([]); setLoadedStoreId("");
    setHistorySource(next);
  }

  function togglePinnedConversation(id: string) {
    persistHistory(historyRef.current.map((conversation) => conversation.id === id ? { ...conversation, pinned: !conversation.pinned } : conversation).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt)));
  }

  function toggleArchivedConversation(id: string) {
    const conversation = historyRef.current.find((item) => item.id === id);
    if (!conversation) return;
    const previousArchivedAt = conversation.archivedAt || null;
    const nextArchivedAt = previousArchivedAt ? null : new Date().toISOString();
    const scopeAtArchive = historyScope;
    persistHistory(historyRef.current.map((item) => item.id === id ? { ...item, archivedAt: nextArchivedAt } : item));
    notifyFeedback({
      kind: "success",
      title: nextArchivedAt ? "对话已归档" : "对话已恢复",
      description: nextArchivedAt ? "已移入归档，可在短时间内撤销。" : "已回到当前对话列表。",
      action: {
        label: "撤销",
        onClick: () => {
          if (historyScopeRef.current !== scopeAtArchive) return;
          persistHistory(historyRef.current.map((item) => item.id === id ? { ...item, archivedAt: previousArchivedAt } : item));
          notifyFeedback({ kind: "success", title: nextArchivedAt ? "已撤销归档" : "已撤销恢复" });
        },
      },
    });
  }

  function deleteHistoryConversation() {
    if (!deleteHistoryId) return;
    const deletedConversation = historyRef.current.find((conversation) => conversation.id === deleteHistoryId);
    persistHistory(historyRef.current.filter((conversation) => conversation.id !== deleteHistoryId));
    if (activeConversationId === deleteHistoryId) {
      setMessages([]); setActiveConversationId(crypto.randomUUID()); setCategory("随便聊聊"); setError("");
    }
    setDeleteHistoryId("");
    notifyFeedback({ kind: "success", title: "对话已删除", description: deletedConversation ? `“${deletedConversation.title}”已从${historySource === "cloud" ? "云端" : "本设备"}移除。` : "聊天记录已移除。" });
  }

  function startNewChat() {
    saveCurrentConversation();
    setActiveConversationId(crypto.randomUUID()); setCategory("随便聊聊"); setMessages([]); setDraft(""); setError("");
    notifyFeedback({ kind: "success", title: "已开始新对话", description: "之前的聊天已保存在历史记录中。" });
  }

  async function recognizeImage(file: File) {
    if (!file.type.startsWith("image/")) { setOcrError("请选择图片文件（JPG、PNG 或 WebP）。"); return; }
    if (file.size > 10 * 1024 * 1024) { setOcrError("图片不能超过 10 MB，请先压缩后再试。"); return; }
    if (ocrPreview) URL.revokeObjectURL(ocrPreview);
    setOcrImage(file);
    setOcrPreview(URL.createObjectURL(file));
    setOcrText("");
    setOcrError("");
    setOcrProgress(0);
    setOcrBusy(true);
    const requestId = ++ocrRequestRef.current;
    let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker(["chi_sim", "eng"], 1, {
        logger: (message) => {
          if (requestId === ocrRequestRef.current && message.status === "recognizing text") setOcrProgress(Math.round(message.progress * 100));
        },
      });
      const result = await worker.recognize(file);
      if (requestId !== ocrRequestRef.current) return;
      const text = result.data.text.trim().slice(0, 12000);
      if (!text) throw new Error("这张图片没有识别到文字，请换一张更清晰的图片。");
      setOcrText(text);
      setOcrProgress(100);
    } catch (cause) {
      if (requestId === ocrRequestRef.current) setOcrError(cause instanceof Error ? cause.message : "图片识别失败，请检查网络后重试。");
    } finally {
      if (worker) { try { await worker.terminate(); } catch { /* The recognition result or error is already captured. */ } }
      if (requestId === ocrRequestRef.current) setOcrBusy(false);
    }
  }

  function removeOcrImage() {
    ocrRequestRef.current += 1;
    if (ocrPreview) URL.revokeObjectURL(ocrPreview);
    setOcrImage(null); setOcrPreview(""); setOcrText(""); setOcrBusy(false); setOcrProgress(0); setOcrError("");
    if (ocrInputRef.current) ocrInputRef.current.value = "";
  }

  function openConversation(conversation: ChatConversation) {
    setActiveConversationId(conversation.id); setCategory(conversation.category); setMessages(conversation.messages); setError(""); setHistoryOpen(false);
  }

  function changeConversationCategory(id: string, nextCategory: ChatCategory) {
    persistHistory(history.map((item) => item.id === id ? { ...item, category: nextCategory } : item));
    if (id === activeConversationId) setCategory(nextCategory);
  }

  async function sendWithKey(apiKey: string) {
    const question = draft.trim();
    const content = [question, ocrText.trim() ? `【图片 OCR 识别文字】\n${ocrText.trim()}\n\n请结合以上识别文字回答我的问题。` : ""].filter(Boolean).join("\n\n");
    if (!content || busy || ocrBusy || !activeStoreId) return;
    setSending(true); setError(""); setDraft("");
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content, createdAt: new Date().toISOString() };
    const assistantMessage: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "", createdAt: new Date().toISOString(), model };
    const nextMessages = [...messages, userMessage, assistantMessage];
    setMessages(nextMessages);
    if (ocrImage) removeOcrImage();
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/ai/chat`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model, reasoningEffort: effort, webSearch, language, messages: [...messages, userMessage].map(({ role, content: messageContent }) => ({ role, content: messageContent })) }),
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
      let sources: ChatSource[] = [];
      try {
        const encodedSources = response.headers.get("X-Web-Search-Sources");
        if (encodedSources) {
          const decoded: unknown = JSON.parse(decodeURIComponent(encodedSources));
          if (Array.isArray(decoded)) sources = decoded.filter((source): source is ChatSource => Boolean(source) && typeof source.title === "string" && typeof source.url === "string" && ["http:", "https:"].includes(new URL(source.url).protocol));
        }
      } catch { /* A malformed optional citations header does not discard the answer. */ }
      setMessages([...nextMessages.slice(0, -1), { ...assistantMessage, content: answer, ...(sources.length ? { sources } : {}) }]);
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
    if ((!draft.trim() && !ocrText.trim()) || busy || ocrBusy) return;
    if (ocrImage && !ocrText.trim()) { setError("这张图片还没有可用的识别文字，请重试识别或先移除图片。"); return; }
    if (mode !== "cloud" || !activeStoreId) { setError("AI 聊天需要先切换到云端店铺。"); return; }
    setPreparing(true); setError("");
    notifyFeedback({ kind: "info", title: webSearch ? "正在联网搜索" : "正在发送", description: webSearch ? "正在检索网页并安全连接 AI 服务…" : "正在安全连接 AI 服务…" });
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
    persistHistory(nextHistory); setMessages([]); setActiveConversationId(crypto.randomUUID()); setCategory("随便聊聊"); setError(""); setClearOpen(false);
    if (activeStoreId) localStorage.removeItem(chatKey(activeStoreId, userId));
    notifyFeedback({ kind: "success", title: "当前聊天已清空" });
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id); window.setTimeout(() => setCopiedId(""), 1600);
    } catch { setError("剪贴板不可用，请检查浏览器权限。"); }
  }

  const page = <div className={immersive ? `ai-chat-immersive fixed inset-0 z-40 flex h-[100dvh] w-screen flex-col overflow-hidden bg-background px-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${immersiveClosing ? "ai-chat-immersive-closing" : ""}` : "mx-auto max-w-6xl max-md:-mx-5 max-md:-mt-5"}>
    <div className="mb-3 hidden items-center justify-between gap-2 px-5 md:mb-5 md:flex md:px-0"><div className="min-w-0"><p className="flex items-center gap-2 text-[11px] font-semibold tracking-[.15em] text-primary before:h-px before:w-5 before:bg-primary">{t("AI CHAT / 自由对话")}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{t("AI 聊天")}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("自由选择模型和推理强度。这个聊天窗口不读取店铺经营数据。")}</p></div><div className="flex shrink-0 gap-2"><Link href="/ai-settings" aria-label="AI 设置" className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-[var(--mc-tint-blue)] hover:text-primary md:size-auto md:px-3"><Settings2 size={16}/><span className="hidden md:inline">{t("AI 设置")}</span></Link><Button variant="outline" size="icon-sm" aria-label="清空聊天" title="清空聊天" onClick={() => setClearOpen(true)} disabled={!messages.length || busy}><Eraser size={15}/></Button></div></div>

    <section aria-label="AI 聊天窗口" className={immersive ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-card" : "flex h-[calc(100dvh-400px)] min-h-[430px] flex-col overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_16px_50px_rgba(31,57,82,.075)] max-md:h-[calc(100dvh-145px)] max-md:w-full max-md:rounded-none max-md:border-x-0 max-md:border-b-0 md:min-h-[65dvh] md:rounded-[24px]"}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[var(--mc-tint-blue)]/45 px-3 py-2.5 md:px-5 md:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-sm sm:grid"><MessageCircle size={17}/></span>
          <div className="min-w-0"><h2 className="truncate text-sm font-semibold">{category}</h2>{!immersive && <p className="truncate text-[10px] text-muted-foreground">{currentModel.name} · 推理{efforts.find((item) => item.id === effort)?.label}</p>}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {!immersive && <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium sm:inline-flex ${configured ? "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]" : "bg-card text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${configured ? "bg-[var(--mc-color-success)]" : "bg-muted-foreground"}`}/>{mode !== "cloud" ? "需要云端店铺" : configured ? "密钥已就绪" : "待配置 DeepSeek"}</span>}
          {!immersive && <Button variant="outline" size="icon-sm" aria-label="聊天历史" title="聊天历史" onClick={() => { saveCurrentConversation(); setHistoryOpen(true); }} className="size-9"><History size={16}/></Button>}
          {!immersive && <Button variant="outline" size="icon-sm" aria-label="新建聊天" title="新建聊天" onClick={startNewChat} disabled={busy} className="size-9"><Plus size={17}/></Button>}
          <Button variant="outline" size="icon-sm" aria-label={immersive ? "退出沉浸模式" : "沉浸模式"} title={immersive ? "退出沉浸模式" : "沉浸模式"} onClick={immersive ? exitImmersive : enterImmersive} className="size-9">{immersive ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</Button>
        </div>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 md:py-6">
        {mode === "cloud" && activeStoreId && loadedStoreId !== activeStoreId ? <p role="status" className="py-12 text-center text-xs text-muted-foreground">{t("正在读取这台设备的聊天内容…")}</p> : mode !== "cloud" ? <div className="mx-auto max-w-md rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-5 text-center"><KeyRound size={23} className="mx-auto text-primary"/><h3 className="mt-3 text-sm font-semibold">{t("先切换到云端店铺")}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("自由聊天使用当前店铺保存的 DeepSeek 密钥；不会读取店铺经营数据。")}</p></div> : !configured && messages.length === 0 ? <div className="mx-auto max-w-xl py-12 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary"><Sparkles size={24}/></span><h3 className="mt-4 text-base font-semibold">{t("想聊点什么？")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("先到 AI 设置保存 DeepSeek Key，就可以开始自由对话。")}</p><Link href="/ai-settings" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><KeyRound size={15}/>{t("配置 AI 密钥")}</Link></div> : messages.length === 0 ? <div className="mx-auto max-w-2xl py-10 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--mc-tint-blue)] text-primary"><Sparkles size={24}/></span><h3 className="mt-4 text-base font-semibold">{t("随心开始一段对话")}</h3><p className="mt-1 text-xs text-muted-foreground">{t("可以问问题、聊兴趣、写故事、头脑风暴，或试试不同模型与推理强度。")}</p><div className="mt-5 flex flex-wrap justify-center gap-2">{["讲个短一点的科幻故事", "给我设计一个周末小游戏", "解释一下为什么天空是蓝色的", "来一轮脑筋急转弯"].map((prompt) => <button key={prompt} type="button" onClick={() => setDraft(prompt)} className="rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-[var(--mc-tint-blue)] hover:text-primary">{prompt}</button>)}</div></div> : messages.map((message) => <article key={message.id} className={`group flex gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`${message.role === "user" ? "max-w-[92%]" : "w-full max-w-full sm:w-auto sm:max-w-[82%]"} min-w-0 rounded-2xl px-3.5 py-3 sm:px-4 ${message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-[var(--mc-tint-blue)]/45 text-foreground"}`}>{message.role === "assistant" && <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground"><Bot size={12}/>DeepSeek · {message.model || model}</div>}{message.role === "assistant" ? message.content ? <MarkdownContent content={message.content} className="text-base leading-7"/>: sending ? <span className="py-1"><AiStreamStatus active hasText={false}/></span> : <p className="text-xs text-muted-foreground">暂无回复内容</p> : <p className="whitespace-pre-wrap break-words text-base leading-7">{message.content}</p>}{message.sources && message.sources.length > 0 && <div className="mt-3 border-t border-border/70 pt-2"><p className="mb-1.5 text-[10px] font-semibold text-muted-foreground">{t("联网参考来源")}</p><div className="space-y-1">{message.sources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-primary hover:underline">[{index + 1}] {source.title}</a>)}</div></div>}{message.role === "assistant" && message.content && <button type="button" onClick={() => void copyMessage(message)} className="mt-2 flex min-h-7 items-center gap-1 text-[10px] text-muted-foreground opacity-70 transition-opacity hover:text-primary group-hover:opacity-100">{copiedId === message.id ? <Check size={12}/> : <Copy size={12}/>}{copiedId === message.id ? t("已复制") : t("复制回复")}</button>}</div></article>)}
        {error && <p role="alert" className="mx-auto flex max-w-2xl items-start gap-2 rounded-xl bg-[var(--mc-tint-red)] p-3 text-xs leading-5 text-[var(--mc-color-danger)]"><CircleAlert size={15} className="mt-0.5 shrink-0"/>{error}</p>}
        <div ref={endRef}/>
      </div>
      <form onSubmit={(event) => void submit(event)} className="border-t border-border bg-card/95 p-3 sm:p-4">
        <div className="relative">
          {ocrImage && <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-[var(--mc-tint-blue)]/45 p-2.5">
            {ocrPreview && <Image src={ocrPreview} alt="待识别图片预览" width={48} height={48} unoptimized className="size-12 shrink-0 rounded-lg border border-border object-cover"/>}
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-foreground">{ocrImage.name}</p><p role={ocrError ? "alert" : "status"} className={`mt-0.5 text-[10px] ${ocrError ? "text-[var(--mc-color-danger)]" : "text-muted-foreground"}`}>{ocrError || (ocrBusy ? ocrProgress ? `正在识别图片文字 ${ocrProgress}%` : "正在加载识别组件…" : `已识别 ${ocrText.length.toLocaleString()} 个字符 · 发送后交给 AI 分析`)}</p><p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">原图留在本机；发送时只提交识别出的文字。</p>{ocrBusy && <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{width:`${Math.max(5,ocrProgress)}%`}}/></div>}</div>
            <button type="button" aria-label="移除图片" title="移除图片" onClick={removeOcrImage} disabled={ocrBusy||busy} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"><X size={15}/></button>
          </div>}
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleInputKeyDown} disabled={busy || mode !== "cloud"} rows={2} placeholder={mode !== "cloud" ? "切换到云端店铺后开始聊天…" : "发消息给 DeepSeek…"} className="min-h-[112px] max-h-40 resize-none rounded-2xl border-border bg-background py-3 pb-14 pr-3 text-sm leading-6"/>
          <div className="ai-chat-composer-footer absolute bottom-2 left-3 right-3 z-20 flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[10px] text-muted-foreground">Enter 发送</span>
            <input ref={ocrInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file=event.target.files?.[0]; if(file) void recognizeImage(file); event.target.value=""; }}/>
            <Button type="button" variant="outline" aria-label="上传图片并识别文字" title="上传图片并识别文字" disabled={busy||ocrBusy||mode!=="cloud"} onClick={()=>ocrInputRef.current?.click()} className="h-8 shrink-0 gap-1.5 rounded-xl px-2.5 text-[11px]"><ImagePlus size={14}/><span className="hidden sm:inline">图片 OCR</span></Button>
            <span className="ai-chat-composer-mode min-w-0 flex-1 truncate text-[10px] text-muted-foreground" title={`${currentModel.name} · ${category} · ${efforts.find((item) => item.id === effort)?.label} · ${webSearch ? "联网搜索已开启" : "联网搜索已关闭"}`}>{currentModel.name.replace("DeepSeek ", "")} · {efforts.find((item) => item.id === effort)?.label}{webSearch ? " · 联网" : ""}</span>
            <Button type="button" variant="outline" aria-label="更多聊天设置" aria-expanded={moreOpen} aria-controls="ai-chat-more-settings" onClick={() => setMoreOpen((open) => !open)} className="h-8 shrink-0 whitespace-nowrap rounded-xl px-2.5 text-[11px]"><SlidersHorizontal size={14}/>更多<ChevronDown size={13} className={`transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}/></Button>
            <Button type="submit" aria-label={busy ? "正在发送消息" : "发送消息"} disabled={busy || ocrBusy || (!draft.trim() && !ocrText.trim()) || mode !== "cloud"} className="size-10 shrink-0 rounded-xl p-0 transition-all duration-200 active:scale-90 disabled:opacity-60">{busy ? <LoaderCircle size={17} className="animate-spin"/> : <Send size={16} className="transition-transform duration-200 group-hover:translate-x-0.5"/>}</Button>
            {moreOpen && <div id="ai-chat-more-settings" className="ai-chat-more-panel space-y-3 rounded-2xl border border-border bg-[var(--mc-tint-blue)]/80 p-3 shadow-[0_18px_46px_rgba(31,57,82,.18)] backdrop-blur-2xl" aria-label="更多聊天设置">
              <div className="grid grid-cols-2 gap-2">
                <AppSelect aria-label="选择模型" value={model} disabled={busy} onChange={(event) => setModel(event.target.value as ModelId)} className="h-9 min-w-0 rounded-xl border border-border bg-background px-2.5 text-xs font-medium sm:px-3 sm:text-sm"><option value="deepseek-flash">V4.1 Flash</option><option value="deepseek-v4-pro">V4 Pro</option></AppSelect>
                <AppSelect aria-label="聊天分类" value={category} disabled={busy} onChange={(event) => setCategory(event.target.value as ChatCategory)} className="h-9 min-w-0 rounded-xl border border-border bg-background px-2.5 text-xs font-medium"><option value="未分类">未分类</option>{chatCategories.filter((item) => item !== "未分类").map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect>
              </div>
              <div className={`web-search-setting ${webSearch ? "is-enabled" : ""}`} data-enabled={webSearch}>
                <span className="web-search-icon" aria-hidden="true"><Search size={16}/><i/></span>
                <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-xs font-semibold">联网搜索{webSearch && <span className="web-search-live">实时</span>}</span><span className="mt-0.5 block truncate text-[10px] leading-4 text-muted-foreground">搜索网页并附来源 · 可能产生额外费用</span></span>
                <Switch label="联网搜索" checked={webSearch} disabled={busy} onCheckedChange={setWebSearch} />
              </div>
              <fieldset disabled={busy}>
                <legend className="mb-1.5 flex w-full items-center justify-between text-[10px] font-medium text-muted-foreground"><span>推理强度</span><span>{efforts.find((item) => item.id === effort)?.detail}</span></legend>
                <div className="reasoning-control relative grid grid-cols-4 rounded-xl border border-border bg-background/80 p-1" data-effort={effort} role="group" aria-label="推理强度">
                  <span aria-hidden="true" className="reasoning-indicator pointer-events-none absolute inset-y-1 left-1 w-[calc(25%-2px)] rounded-lg shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `translateX(${effortIndex * 100}%)` }}>
                    <span key={effortPulse} className="reasoning-sheen"/>
                    {effort !== "none" && <><i/><i/><i/></>}
                  </span>
                  {efforts.map((item) => <button key={item.id} type="button" aria-pressed={effort === item.id} onClick={() => { setEffort(item.id); setEffortPulse((pulse) => pulse + 1); }} className={`reasoning-choice relative z-10 min-h-9 rounded-lg px-1 text-[10px] font-medium transition-colors duration-200 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${effort === item.id ? effortTextTone[item.id] : "text-muted-foreground hover:text-foreground"}`}><span key={effort === item.id ? effort : "idle"} className={effort === item.id ? "reasoning-choice-label" : ""}>{item.label}</span></button>)}
                </div>
              </fieldset>
              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{currentModel.note}</span>{immersive && <div className="flex gap-2"><button type="button" onClick={() => { saveCurrentConversation(); setHistoryOpen(true); }} className="font-medium text-primary">聊天历史</button><button type="button" onClick={startNewChat} disabled={busy} className="font-medium text-primary disabled:opacity-50">新建聊天</button></div>}</div>
            </div>}
          </div>
        </div>
      </form>
    </section>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
      <DialogContent className="max-h-[min(86dvh,760px)] overflow-hidden rounded-[24px] border border-border bg-card p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>聊天历史</DialogTitle>
          <DialogDescription>{historySource === "cloud" ? "云端对话保存到当前账号和店铺，可在其他设备继续查看。" : "本机对话只保存在当前浏览器；清理浏览器数据后可能无法恢复。"}归档可撤销；删除前会二次确认。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 border-b border-border p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1" role="group" aria-label="对话保存位置">
            <button type="button" aria-pressed={historySource === "local"} onClick={() => switchHistorySource("local")} className={`min-h-9 rounded-lg px-3 text-xs font-medium ${historySource === "local" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>本机对话</button>
            <button type="button" aria-pressed={historySource === "cloud"} onClick={() => switchHistorySource("cloud")} className={`min-h-9 rounded-lg px-3 text-xs font-medium ${historySource === "cloud" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>云端对话</button>
          </div>
          {historyBusy && <p role="status" className="text-xs text-muted-foreground">正在加载云端对话…</p>}
          <label className="relative block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="搜索标题或聊天内容" aria-label="搜索聊天历史" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"/>
          </label>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
            <button type="button" aria-pressed={historyView === "active"} onClick={() => setHistoryView("active")} className={`min-h-9 rounded-lg px-3 text-xs font-medium ${historyView === "active" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>当前对话 · {history.filter((item) => !item.archivedAt).length}</button>
            <button type="button" aria-pressed={historyView === "archived"} onClick={() => setHistoryView("archived")} className={`min-h-9 rounded-lg px-3 text-xs font-medium ${historyView === "archived" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>已归档 · {history.filter((item) => Boolean(item.archivedAt)).length}</button>
          </div>
        </div>
        <div className="max-h-[52dvh] space-y-2 overflow-y-auto p-3 sm:p-4">
          {visibleHistory.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">{history.length === 0 ? "还没有保存的聊天记录" : historyView === "archived" ? "没有匹配的归档对话" : "没有匹配的当前对话"}</div> : visibleHistory.map((conversation) => (
                <article key={conversation.id} className="ai-chat-history-item rounded-2xl border border-border bg-background p-3">
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => openConversation(conversation)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">{conversation.pinned && <Pin size={13} className="shrink-0 text-primary"/>}{conversation.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{conversation.category} · {new Date(conversation.updatedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {conversation.messages.filter((message) => message.role === "user").length} 条消息</span>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button variant="ghost" size="icon-sm" aria-label={conversation.pinned ? "取消置顶" : "置顶对话"} title={conversation.pinned ? "取消置顶" : "置顶对话"} aria-pressed={Boolean(conversation.pinned)} onClick={() => togglePinnedConversation(conversation.id)} className={`history-action-button history-pin-button ${conversation.pinned ? "text-primary" : "text-muted-foreground"}`}><Pin size={15}/></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={conversation.archivedAt ? "恢复对话" : "归档对话"} title={conversation.archivedAt ? "恢复对话" : "归档对话"} data-archived={Boolean(conversation.archivedAt)} onClick={() => toggleArchivedConversation(conversation.id)} className="history-action-button history-archive-button text-muted-foreground">{conversation.archivedAt ? <ArchiveRestore size={15}/> : <Archive size={15}/>}</Button>
                  <Button variant="ghost" size="icon-sm" aria-label="删除对话" title="删除对话" onClick={() => setDeleteHistoryId(conversation.id)} className="history-action-button history-delete-button text-muted-foreground hover:text-[var(--mc-color-danger)]"><Trash2 size={15}/></Button>
                </div>
              </div>
              <AppSelect aria-label={`更改“${conversation.title}”分类`} value={conversation.category} onChange={(event) => changeConversationCategory(conversation.id, event.target.value as ChatCategory)} className="mt-2 h-8 w-full rounded-xl border border-border bg-card px-2 text-xs sm:w-40">{chatCategories.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect>
            </article>
          ))}
        </div>
        <div className="flex justify-end border-t border-border p-3"><Button onClick={() => { setHistoryOpen(false); startNewChat(); }}><Plus size={16}/>新建聊天</Button></div>
      </DialogContent>
    </Dialog>
    {activeStoreId && <DeepSeekUnlockDialog storeId={activeStoreId} open={unlockOpen} onOpenChange={setUnlockOpen} onUnlock={(apiKey) => sendWithKey(apiKey)}/>}
    <AlertDialog open={Boolean(deleteHistoryId)} onOpenChange={(open) => { if (!open) setDeleteHistoryId(""); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除“{history.find((conversation) => conversation.id === deleteHistoryId)?.title || "这段历史对话"}”？</AlertDialogTitle><AlertDialogDescription>删除后将从当前设备和店铺的本地历史中永久移除，无法撤销。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>返回</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); deleteHistoryConversation(); }}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={clearOpen} onOpenChange={setClearOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>清空这段聊天？</AlertDialogTitle><AlertDialogDescription>当前浏览器保存的聊天内容会被删除，不能撤回。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>返回</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); clearChat(); }}>清空聊天</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
  return immersive ? createPortal(page, document.body) : page;
}
