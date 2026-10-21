"use client";
import { AppSelect } from "@/components/ui/app-select";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  RotateCcw,
  Save,
  ShieldCheck,
  Store,
  Target,
  UserRound,
  DatabaseZap,
  Sparkles,
  Activity,
  ChevronDown,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { TeamPanel } from "@/components/team-panel";
import { VersionPanel } from "@/components/version-panel";
import { PageHead, SectionCard, downloadText } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AppData, AppSettings, Platform } from "@/lib/model";
import { parseAppData } from "@/lib/repository";
import { DEBUG_METRICS, PERFORMANCE_DEBUG_EVENT, PERFORMANCE_DEBUG_METRICS_EVENT, readPerformanceDebugEnabled, readPerformanceDebugMetrics, setPerformanceDebugEnabled, setPerformanceDebugMetrics, type DebugMetricId } from "@/lib/debug-preferences";
import { notifyFeedback } from "@/lib/feedback";
import { AttachmentBackup } from "@/components/attachment-backup";
import { readDeepSeekKey, removeDeepSeekKey, saveDeepSeekKey as saveLocalDeepSeekKey } from "@/lib/deepseek-key";
export default function SettingsPage() {
  const { data, update, reset, mode, role, saving, exportBackup, activeStoreId } = useApp();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupError, setBackupError] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const localFileRef = useRef<HTMLInputElement>(null);
  const [localImportPreview, setLocalImportPreview] = useState<AppData | null>(null);
  const [localImportError, setLocalImportError] = useState("");
  const [localImportBusy, setLocalImportBusy] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugOptionsOpen, setDebugOptionsOpen] = useState(false);
  const [debugMetrics, setDebugMetrics] = useState<DebugMetricId[]>([]);
  const [deepSeekKey, setDeepSeekKey] = useState("");
  const [deepSeekState, setDeepSeekState] = useState<{ configured: boolean; source: string; canSave: boolean; updatedAt?: string | null; error?: string } | null>(null);
  const [deepSeekBusy, setDeepSeekBusy] = useState(false);
  const [deepSeekMessage, setDeepSeekMessage] = useState("");
  const canManage = mode === "local" || role === "owner" || role === "admin";
  useEffect(() => {
    if (data) queueMicrotask(() => setDraft(structuredClone(data.settings)));
  }, [data]);
  useEffect(() => {
    const updateDebug = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setDebugEnabled(typeof detail === "boolean" ? detail : readPerformanceDebugEnabled());
    };
    const frame = window.requestAnimationFrame(() => setDebugEnabled(readPerformanceDebugEnabled()));
    const metricsFrame = window.requestAnimationFrame(() => setDebugMetrics(readPerformanceDebugMetrics()));
    const updateMetrics = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setDebugMetrics(Array.isArray(detail) ? detail as DebugMetricId[] : readPerformanceDebugMetrics());
    };
    window.addEventListener(PERFORMANCE_DEBUG_EVENT, updateDebug);
    window.addEventListener("storage", updateDebug);
    window.addEventListener(PERFORMANCE_DEBUG_METRICS_EVENT, updateMetrics);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(metricsFrame);
      window.removeEventListener(PERFORMANCE_DEBUG_EVENT, updateDebug);
      window.removeEventListener("storage", updateDebug);
      window.removeEventListener(PERFORMANCE_DEBUG_METRICS_EVENT, updateMetrics);
    };
  }, []);
  useEffect(() => {
    if (mode !== "cloud" || !activeStoreId || !canManage) {
      const frame = window.requestAnimationFrame(() => setDeepSeekState(null));
      return () => window.cancelAnimationFrame(frame);
    }
    const frame = window.requestAnimationFrame(() => setDeepSeekState({ configured: Boolean(readDeepSeekKey(activeStoreId)), source: "browser", canSave: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeStoreId, canManage, mode]);
  if (!data || !draft) return <p>正在加载数据…</p>;
  async function saveDeepSeekKey() {
    if (!activeStoreId || !deepSeekKey.trim()) { setDeepSeekMessage("请先粘贴 DeepSeek API Key。"); return; }
    setDeepSeekBusy(true); setDeepSeekMessage("");
    try {
      if (!saveLocalDeepSeekKey(activeStoreId, deepSeekKey)) throw new Error("浏览器无法保存密钥，请检查当前浏览器的存储设置。");
      setDeepSeekKey(""); setDeepSeekMessage("已保存到当前浏览器。下次 AI 请求时会直接使用。");
      setDeepSeekState({ configured: true, source: "browser", canSave: true });
      notifyFeedback({ kind: "success", title: "DeepSeek 配置已保存", description: "密钥保存在当前浏览器中。" });
    } catch (cause) { const message = cause instanceof Error ? cause.message : "DeepSeek 配置失败"; setDeepSeekMessage(message); notifyFeedback({ kind: "error", title: "DeepSeek 配置失败", description: message }); }
    finally { setDeepSeekBusy(false); }
  }
  async function deleteDeepSeekKey() {
    if (!activeStoreId) return;
    setDeepSeekBusy(true); setDeepSeekMessage("");
    try {
      removeDeepSeekKey(activeStoreId);
      setDeepSeekState({ configured: false, source: "unset", canSave: true });
      setDeepSeekMessage("已从当前浏览器删除 DeepSeek Key。");
      notifyFeedback({ kind: "success", title: "DeepSeek 配置已删除", description: "密钥已从当前浏览器移除。" });
    } catch (cause) { const message = cause instanceof Error ? cause.message : "删除配置失败"; setDeepSeekMessage(message); notifyFeedback({ kind: "error", title: "删除配置失败", description: message }); }
    finally { setDeepSeekBusy(false); }
  }
  async function save() {
    if (!draft) return;
    if (!draft.store.name.trim()) {
      setError("请输入店铺名称");
      return;
    }
    const normalizedTarget = draft.salesTarget.replace(/[，,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(normalizedTarget)) {
      setError("月销售目标请填写数字，可使用千位逗号，最多保留两位小数。");
      return;
    }
    if (
      !Number.isFinite(draft.marginAlert) ||
      draft.marginAlert < 0 ||
      draft.marginAlert > 100
    ) {
      setError("利润预警阈值应为 0–100%");
      return;
    }
    try {
      const nextSettings = { ...draft, salesTarget: normalizedTarget };
      await update((current) => ({ ...current, settings: nextSettings }));
      setDraft(nextSettings);
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }
  }
  async function downloadFullBackup() {
    setBackupBusy(true);
    setBackupMessage("");
    setBackupError("");
    try {
      const response = await fetch("/api/backup", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || `备份失败（${response.status}）`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `moonclean-full-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupMessage("完整云端备份已生成并开始下载。");
    } catch (cause) {
      setBackupError(cause instanceof Error ? cause.message : "备份失败，请重试");
    } finally {
      setBackupBusy(false);
    }
  }
  async function inspectLocalBackup(file: File | undefined) {
    setLocalImportError("");
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("备份文件不能超过 20 MB。");
      const parsed = parseAppData(JSON.parse(await file.text()));
      const duplicateDates = (items: { date: string }[]) => new Set(items.map((item) => item.date)).size !== items.length;
      if (duplicateDates(parsed.daily) || duplicateDates(parsed.advertising)) {
        throw new Error("备份中存在重复日期的经营或推广记录，请修复文件后再导入。");
      }
      setLocalImportPreview(parsed);
    } catch (cause) {
      setLocalImportError(cause instanceof Error ? `无法导入：${cause.message}` : "无法读取备份文件，请确认文件格式正确。");
    }
  }
  async function restoreLocalBackup() {
    if (!localImportPreview) return;
    setLocalImportBusy(true);
    setLocalImportError("");
    try {
      const date = new Date().toISOString().slice(0, 10);
      downloadText(`moonclean-local-before-restore-${date}.json`, exportBackup(), "application/json");
      await update(() => localImportPreview);
      setBackupMessage("本地全量备份已导入，原工作区备份也已开始下载。");
      setLocalImportPreview(null);
    } catch (cause) {
      setLocalImportError(cause instanceof Error ? cause.message : "导入失败，原有数据未确认更新。");
    } finally {
      setLocalImportBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="PREFERENCES / 系统设置"
        title="让工作空间贴合你的店铺"
        description="管理店铺资料、经营目标、团队角色与数据备份。"
      />
      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <SectionCard title="动效设置" sub="统一管理全站动效档位、页面切换方式及系统动态效果偏好。" action={<Sparkles size={19} className="text-primary" />}>
            <Link href="/motion" className="group flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-3.5 transition-colors hover:bg-card sm:p-4">
              <span><strong className="block text-sm text-foreground">打开动效设置模块</strong><span className="mt-1 block text-xs text-muted-foreground">动效档位、页面切换和系统减少动态效果状态</span></span>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-primary"><ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5"/></span>
            </Link>
          </SectionCard>
          <SectionCard title="性能调试浮窗" sub="仅在当前浏览器显示，不会上传店铺业务数据。默认收起调试内容，点击悬浮胶囊查看。" action={<Activity size={19} className="text-primary" />}>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-3 sm:p-4">
              <div className="min-w-0"><strong className="block text-sm text-foreground">悬浮运行状态胶囊</strong><p className="mt-1 text-[10px] leading-4 text-muted-foreground sm:text-xs">显示页面帧率、JS 堆、视口、网络、长任务与动效档位；硬件刷新率按浏览器能力显示。</p></div>
              <button type="button" role="switch" aria-label="启用性能调试浮窗" aria-checked={debugEnabled} onClick={() => { const next = !readPerformanceDebugEnabled(); setPerformanceDebugEnabled(next); notifyFeedback({ kind: "success", title: next ? "性能调试已开启" : "性能调试已关闭", description: next ? "悬浮胶囊已显示，面板默认收起。" : "当前设备的调试浮窗已隐藏。" }); }} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${debugEnabled ? "bg-primary" : "bg-[var(--mc-tint-blue)]"}`}><span className={`absolute top-1 size-5 rounded-full bg-card shadow-sm transition-transform ${debugEnabled ? "translate-x-6" : "translate-x-1"}`}/></button>
            </div>
            <button type="button" aria-expanded={debugOptionsOpen} onClick={() => setDebugOptionsOpen((open) => !open)} className="mt-3 flex min-h-10 w-full items-center justify-between rounded-xl border border-border bg-card px-3 text-left text-xs font-medium text-muted-foreground hover:bg-[var(--mc-tint-blue)]">
              <span>{debugOptionsOpen ? "收起调试选项" : "调试选项（自定义显示内容）"}</span>
              <ChevronDown size={16} className={`transition-transform ${debugOptionsOpen ? "rotate-180" : ""}`} />
            </button>
            {debugOptionsOpen && <div className="mt-2 rounded-xl bg-[var(--mc-tint-blue)] p-2.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DEBUG_METRICS.map(({ id, label }) => <label key={id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-2.5 text-[10px] text-muted-foreground sm:text-xs"><input type="checkbox" checked={debugMetrics.includes(id)} onChange={(event) => { const next = event.target.checked ? [...debugMetrics, id] : debugMetrics.filter((item) => item !== id); setDebugMetrics(next); setPerformanceDebugMetrics(next); }} className="size-3.5 accent-[#3b91eb]"/>{label}</label>)}
              </div>
              <p className="mt-2 text-[10px] leading-4 text-muted-foreground">FPS 为网页绘制估算值；Safari、手机浏览器等通常不提供硬件内存或真实刷新率。</p>
            </div>}
          </SectionCard>
          <SectionCard title="DeepSeek API 接入" sub="输入密钥后保存在当前浏览器；调用 AI 时由 MoonClean 服务转发至 DeepSeek，不写入 Supabase。" action={<Sparkles size={19} className="text-primary" />}>
            {mode !== "cloud" ? <p className="rounded-xl bg-[var(--mc-tint-blue)] p-3 text-sm leading-6 text-muted-foreground">切换到云端店铺后，可在这里配置 DeepSeek API Key。</p> : role === "viewer" ? <p className="rounded-xl bg-[var(--mc-tint-blue)] p-3 text-sm leading-6 text-muted-foreground">仅店铺所有者或管理员可以管理 AI API 密钥。</p> : <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--mc-tint-blue)] p-3"><span className={`size-2 rounded-full ${deepSeekState?.configured ? "bg-[var(--mc-color-success)]" : "bg-[var(--mc-tint-blue)]"}`}/><span className="text-sm font-medium text-muted-foreground">{deepSeekState?.configured ? "当前浏览器已配置" : "尚未配置"}</span></div>
              <div><Label htmlFor="deepseek-api-key">DeepSeek API Key</Label><Input id="deepseek-api-key" type="password" autoComplete="new-password" value={deepSeekKey} onChange={(event) => setDeepSeekKey(event.target.value)} disabled={deepSeekBusy} placeholder={deepSeekState?.configured ? "已保存在本浏览器；输入新 Key 可替换" : "粘贴 DeepSeek API Key"} className="mt-1.5"/></div>
              <div className="flex flex-wrap items-center gap-2"><Button type="button" loading={deepSeekBusy} onClick={() => void saveDeepSeekKey()} disabled={deepSeekBusy || !deepSeekKey.trim()}>{deepSeekBusy ? "正在保存…" : "保存密钥"}</Button>{deepSeekState?.configured && <Button type="button" variant="outline" disabled={deepSeekBusy} onClick={() => void deleteDeepSeekKey()}>删除已保存密钥</Button>}<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="text-xs font-medium text-primary underline underline-offset-2">前往 DeepSeek 创建 API Key</a></div>
              {deepSeekState?.error && <p role="alert" className="rounded-xl bg-[var(--mc-tint-orange)] p-3 text-xs leading-5 text-[var(--mc-color-warning)]">{deepSeekState.error}</p>}
              {deepSeekMessage && <p role={deepSeekMessage.includes("已保存") || deepSeekMessage.includes("已删除") ? "status" : "alert"} className={`rounded-xl p-3 text-xs leading-5 ${deepSeekMessage.includes("已保存") || deepSeekMessage.includes("已删除") ? "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]" : "bg-[var(--mc-tint-red)] text-[var(--mc-color-danger)]"}`}>{deepSeekMessage}</p>}
              <p className="text-[10px] leading-5 text-muted-foreground">密钥仅保存在当前浏览器的本地存储；首次使用后才会验证。换浏览器或清理网站数据后需要重新输入。发起 AI 请求时，密钥会随请求经 MoonClean 服务转发到 DeepSeek。</p>
            </div>}
          </SectionCard>
          <SectionCard
            title="店铺信息"
            sub="店铺时区决定经营日期与成本生效日期"
            action={<Store size={19} className="text-primary" />}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="store-name-setting">店铺名称</Label>
                <Input
                  id="store-name-setting"
                  className="mt-2"
                  value={draft.store.name}
                  disabled={!canManage}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      store: { ...draft.store, name: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label>经营平台</Label>
                <AppSelect
                  disabled={!canManage}
                  className="mt-2 flex h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
                  value={draft.store.platform}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      store: {
                        ...draft.store,
                        platform: e.target.value as Platform,
                      },
                    })
                  }
                >
                  <option value="pinduoduo">拼多多</option>
                  <option value="douyin">抖音电商</option>
                  <option value="other">其他平台</option>
                </AppSelect>
              </div>
              <div>
                <Label>货币单位</Label>
                <AppSelect
                  disabled={!canManage}
                  className="mt-2 flex h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
                  value={draft.store.currency}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      store: {
                        ...draft.store,
                        currency: e.target.value as "CNY" | "USD",
                      },
                    })
                  }
                >
                  <option value="CNY">人民币（CNY / ¥）</option>
                  <option value="USD">美元（USD / $）</option>
                </AppSelect>
                <p className="mt-1 text-xs text-muted-foreground">
                  只改变显示符号，不进行汇率换算。
                </p>
              </div>
              <div>
                <Label>店铺时区</Label>
                <AppSelect
                  disabled={!canManage}
                  className="mt-2 flex h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
                  value={draft.store.timezone || "Asia/Shanghai"}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      store: { ...draft.store, timezone: e.target.value },
                    })
                  }
                >
                  <option value="Asia/Shanghai">
                    中国标准时间（Asia/Shanghai）
                  </option>
                  <option value="Asia/Hong_Kong">香港时间</option>
                  <option value="UTC">UTC</option>
                </AppSelect>
              </div>
            </div>
          </SectionCard>
          <SectionCard
            title="经营目标与预警"
            sub="总览会展示目标进度与低利润提醒"
            action={<Target size={19} className="text-primary" />}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="monthly-sales-target">月销售目标</Label>
                <Input
                  id="monthly-sales-target"
                  className="mt-2"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={!canManage}
                  value={draft.salesTarget}
                  onChange={(e) => { setDraft({ ...draft, salesTarget: e.target.value }); setError(""); setSaved(false); }}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">按每月填写，支持千位逗号，例如 100,000；保存后自动规范为纯数字。</p>
                {!canManage && <p className="mt-1 text-xs text-[var(--mc-color-warning)]">当前角色没有修改经营目标的权限，请联系店主或管理员。</p>}
              </div>
              <div>
                <Label>利润率预警阈值（%）</Label>
                <Input
                  className="mt-2"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={!canManage}
                  value={draft.marginAlert}
                  onChange={(e) =>
                    setDraft({ ...draft, marginAlert: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </SectionCard>
          {error && (
            <p role="alert" className="text-sm text-[var(--mc-color-danger)]">
              {error}
            </p>
          )}
          {canManage && (
            <Button disabled={saving} onClick={() => void save()}>
              <Save size={16} />
              {saving ? "保存中…" : saved ? "已保存" : "保存设置"}
            </Button>
          )}
          {mode === "cloud" && <TeamPanel />}
        </div>
        <div className="space-y-5">
          <SectionCard
            title="数据管理"
            sub={
              mode === "cloud"
                ? "备份全部自有店铺的云端业务数据，便于迁移和留档"
                : "数据保存在当前浏览器"
            }
            action={<ShieldCheck size={19} className="text-primary" />}
          >
            <div className="space-y-3">
              {mode === "local" && <input ref={(node) => { localFileRef.current = node; }} type="file" accept=".json,application/json" className="hidden" onChange={(event) => { void inspectLocalBackup(event.target.files?.[0]); event.target.value = ""; }} />}
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() =>
                  downloadText(
                    `moonclean-${mode === "local" ? "local-full" : "backup"}-${new Date().toISOString().slice(0, 10)}.json`,
                    exportBackup(),
                    "application/json",
                  )
                }
              >
                <Download size={16} />
                {mode === "local" ? "导出本地全量备份" : "导出当前店铺轻量 JSON"}
              </Button>
              {mode === "local" && <Button className="w-full justify-start" variant="outline" onClick={() => localFileRef.current?.click()}><DatabaseZap size={16} />导入本地全量备份</Button>}
              {localImportError && <p role="alert" className="text-xs leading-5 text-[var(--mc-color-danger)]">{localImportError}</p>}
              {mode === "cloud" && role === "owner" && (
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  disabled={backupBusy}
                  onClick={() => void downloadFullBackup()}
                >
                  <DatabaseZap size={16} />
                  {backupBusy ? "正在备份全部云端数据…" : "备份全部云端数据"}
                </Button>
              )}
              {mode === "cloud" && role === "owner" && (
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="mb-2 text-xs font-semibold text-foreground">售后附件迁移</p>
                  <AttachmentBackup />
                </div>
              )}
              {backupMessage && (
                <p role="status" className="text-xs text-[var(--mc-color-success)]">
                  {backupMessage}
                </p>
              )}
              {backupError && (
                <p role="alert" className="text-xs text-[var(--mc-color-danger)]">
                  {backupError}
                </p>
              )}
              {mode === "cloud" ? (
                <Link
                  href="/migrate"
                  className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-[var(--mc-tint-blue)]"
                >
                  <DatabaseZap size={16} />
                  迁移第一阶段本地数据
                </Link>
              ) : (
                <Button
                  className="w-full justify-start text-[var(--mc-color-danger)]"
                  variant="outline"
                  onClick={() => setConfirm(true)}
                >
                  <RotateCcw size={16} />
                  重置本地数据
                </Button>
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {mode === "cloud"
                ? "完整 JSON 备份包括业务记录和售后附件路径；附件文件可用下方单独 ZIP 导出与恢复。登录密码和平台访问令牌不导出，迁移后需重新邀请成员并配置平台连接。"
                : "本地全量备份包含商品及 SKU 成本、经营日报、推广、待办、库存、设置和其他本地工作区数据。导入会替换当前本地工作区，并在替换前自动下载现有备份。云端订单、售后和平台连接数据不属于本地工作区。"}
            </p>
          </SectionCard>
          <SectionCard
            title="账号与权限"
            sub="身份由 Supabase Authentication 管理"
            action={<UserRound size={19} className="text-primary" />}
          >
            <p className="text-sm text-muted-foreground">当前角色：{role || "店主"}</p>
            {mode === "cloud" && (
              <Link
                href="/account"
                className="mt-3 inline-block text-sm font-semibold text-primary"
              >
                管理当前账号 →
              </Link>
            )}
          </SectionCard>
          <VersionPanel />
        </div>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空并重置本地数据？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作会清除当前设备保存的商品、经营记录、推广、待办和库存数据，并创建一个空白本地工作区，无法撤销。请先导出备份。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetBusy}
              onClick={(event) => {
                event.preventDefault();
                setResetBusy(true);
                void reset().then(() => {
                  setError("");
                  setSaved(false);
                  setConfirm(false);
                }).catch((cause: unknown) => {
                  setError(cause instanceof Error ? cause.message : "重置失败，请先检查本地存储空间。");
                }).finally(() => setResetBusy(false));
              }}
            >
              {resetBusy ? "正在清除…" : "确认重置"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!localImportPreview} onOpenChange={(open) => { if (!open && !localImportBusy) setLocalImportPreview(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认导入本地全量备份？</AlertDialogTitle>
            <AlertDialogDescription>文件已通过格式、版本和重复日期校验。导入会替换当前浏览器的本地工作区；开始替换前，系统会先下载当前数据备份。</AlertDialogDescription>
          </AlertDialogHeader>
          {localImportPreview && <div className="rounded-xl bg-[var(--mc-tint-blue)] p-3 text-sm leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground">{localImportPreview.settings.store.name} · {localImportPreview.settings.store.platform === "pinduoduo" ? "拼多多" : localImportPreview.settings.store.platform === "douyin" ? "抖音电商" : "其他平台"}</p>
            <p>商品 {localImportPreview.products.length} 个，经营日报 {localImportPreview.daily.length} 条，推广记录 {localImportPreview.advertising.length} 条</p>
            <p>待办 {localImportPreview.tasks?.length || 0} 条，库存 SKU {localImportPreview.inventory?.length || 0} 个</p>
          </div>}
          {localImportError && <p role="alert" className="text-sm text-[var(--mc-color-danger)]">{localImportError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={localImportBusy}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={localImportBusy || !localImportPreview} onClick={(event) => { event.preventDefault(); void restoreLocalBackup(); }}>
              {localImportBusy ? "正在备份并导入…" : "备份当前数据并导入"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
