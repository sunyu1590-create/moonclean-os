"use client";
import { AppSelect } from "@/components/ui/app-select";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Download,
  RotateCcw,
  Save,
  ShieldCheck,
  Store,
  Target,
  UserRound,
  DatabaseZap,
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
export default function SettingsPage() {
  const { data, update, reset, mode, role, saving, exportBackup } = useApp();
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
  const canManage = mode === "local" || role === "owner" || role === "admin";
  useEffect(() => {
    if (data) queueMicrotask(() => setDraft(structuredClone(data.settings)));
  }, [data]);
  if (!data || !draft) return <p>正在加载数据…</p>;
  async function save() {
    if (!draft) return;
    if (!draft.store.name.trim()) {
      setError("请输入店铺名称");
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(draft.salesTarget)) {
      setError("请输入有效目标金额");
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
      await update((current) => ({ ...current, settings: draft }));
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
          <SectionCard
            title="店铺信息"
            sub="店铺时区决定经营日期与成本生效日期"
            action={<Store size={19} className="text-[#3b91eb]" />}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>店铺名称</Label>
                <Input
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
                  className="mt-2 flex h-9 w-full rounded-md border border-[#dfeaf4] bg-white px-3 text-sm"
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
                  className="mt-2 flex h-9 w-full rounded-md border border-[#dfeaf4] bg-white px-3 text-sm"
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
                <p className="mt-1 text-xs text-[#9aabba]">
                  只改变显示符号，不进行汇率换算。
                </p>
              </div>
              <div>
                <Label>店铺时区</Label>
                <AppSelect
                  disabled={!canManage}
                  className="mt-2 flex h-9 w-full rounded-md border border-[#dfeaf4] bg-white px-3 text-sm"
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
            action={<Target size={19} className="text-[#3b91eb]" />}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>月销售目标</Label>
                <Input
                  className="mt-2"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!canManage}
                  value={draft.salesTarget}
                  onChange={(e) =>
                    setDraft({ ...draft, salesTarget: e.target.value })
                  }
                />
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
            <p role="alert" className="text-sm text-[#e85d65]">
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
            action={<ShieldCheck size={19} className="text-[#3b91eb]" />}
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
              {localImportError && <p role="alert" className="text-xs leading-5 text-[#e85d65]">{localImportError}</p>}
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
              {backupMessage && (
                <p role="status" className="text-xs text-[#168a70]">
                  {backupMessage}
                </p>
              )}
              {backupError && (
                <p role="alert" className="text-xs text-[#e85d65]">
                  {backupError}
                </p>
              )}
              {mode === "cloud" ? (
                <Link
                  href="/migrate"
                  className="flex h-9 items-center gap-2 rounded-md border border-[#dfeaf4] px-3 text-sm hover:bg-[#f2f8ff]"
                >
                  <DatabaseZap size={16} />
                  迁移第一阶段本地数据
                </Link>
              ) : (
                <Button
                  className="w-full justify-start text-[#d15a62]"
                  variant="outline"
                  onClick={() => setConfirm(true)}
                >
                  <RotateCcw size={16} />
                  重置本地数据
                </Button>
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-[#9aabba]">
              {mode === "cloud"
                ? "完整备份包括业务记录、SKU 成本历史、订单、库存、成员关系与操作日志。出于安全考虑，登录密码和平台访问令牌不导出；迁移后需重新邀请成员并配置平台连接。"
                : "本地全量备份包含商品及 SKU 成本、经营日报、推广、待办、库存、设置和其他本地工作区数据。导入会替换当前本地工作区，并在替换前自动下载现有备份。云端订单、售后和平台连接数据不属于本地工作区。"}
            </p>
          </SectionCard>
          <SectionCard
            title="账号与权限"
            sub="身份由 Supabase Authentication 管理"
            action={<UserRound size={19} className="text-[#3b91eb]" />}
          >
            <p className="text-sm text-[#748a9e]">当前角色：{role || "店主"}</p>
            {mode === "cloud" && (
              <Link
                href="/account"
                className="mt-3 inline-block text-sm font-semibold text-[#3b91eb]"
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
          {localImportPreview && <div className="rounded-xl bg-[#f4f9fe] p-3 text-sm leading-6 text-[#526a80]">
            <p className="font-semibold text-[#172b45]">{localImportPreview.settings.store.name} · {localImportPreview.settings.store.platform === "pinduoduo" ? "拼多多" : localImportPreview.settings.store.platform === "douyin" ? "抖音电商" : "其他平台"}</p>
            <p>商品 {localImportPreview.products.length} 个，经营日报 {localImportPreview.daily.length} 条，推广记录 {localImportPreview.advertising.length} 条</p>
            <p>待办 {localImportPreview.tasks?.length || 0} 条，库存 SKU {localImportPreview.inventory?.length || 0} 个</p>
          </div>}
          {localImportError && <p role="alert" className="text-sm text-[#e85d65]">{localImportError}</p>}
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
