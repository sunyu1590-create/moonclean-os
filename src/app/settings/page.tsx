"use client";
import { useEffect, useState } from "react";
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
import type { AppSettings, Platform } from "@/lib/model";
export default function SettingsPage() {
  const { data, update, reset, mode, role, saving, exportBackup } = useApp();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
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
                <select
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
                </select>
              </div>
              <div>
                <Label>货币单位</Label>
                <select
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
                </select>
                <p className="mt-1 text-xs text-[#9aabba]">
                  只改变显示符号，不进行汇率换算。
                </p>
              </div>
              <div>
                <Label>店铺时区</Label>
                <select
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
                </select>
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
                ? "云端数据备份和本地迁移"
                : "数据保存在当前浏览器"
            }
            action={<ShieldCheck size={19} className="text-[#3b91eb]" />}
          >
            <div className="space-y-3">
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() =>
                  downloadText(
                    `moonclean-backup-${new Date().toISOString().slice(0, 10)}.json`,
                    exportBackup(),
                    "application/json",
                  )
                }
              >
                <Download size={16} />
                导出当前店铺 JSON
              </Button>
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
                  重置演示数据
                </Button>
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-[#9aabba]">
              {mode === "cloud"
                ? "云端数据不会静默回退到 localStorage。本地数据迁移需主动确认。"
                : "重置将覆盖当前浏览器的修改；建议先备份。"}
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
        </div>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重置为模拟数据？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作会覆盖当前浏览器保存的所有修改，无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void reset();
                setConfirm(false);
              }}
            >
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
