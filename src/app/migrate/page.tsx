"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DatabaseZap,
  FileDown,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useApp } from "@/components/app-provider";
import { PageHead, SectionCard, downloadText } from "@/components/common";
import { Button } from "@/components/ui/button";
import { hasLocalData, parseAppData, readLocalRaw } from "@/lib/repository";
import { previewMigration, type MigrationPreview } from "@/lib/migration";
import type { AppData } from "@/lib/model";
type Result = {
  kind: string;
  sourceId: string;
  status: "success" | "skipped" | "failed";
  message?: string;
};
export default function MigratePage() {
  const { data, mode, stores, activeStoreId, role, retry, switchStore } =
    useApp();
  const [local, setLocal] = useState<AppData | null>(null);
  const [target, setTarget] = useState("");
  const [imported, setImported] = useState<
    { source_kind: string; source_id: string }[]
  >([]);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (hasLocalData())
          setLocal(parseAppData(JSON.parse(readLocalRaw() || "null")));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "本地数据无法解析");
      }
    });
  }, []);
  useEffect(() => {
    if (activeStoreId) queueMicrotask(() => setTarget(activeStoreId));
  }, [activeStoreId]);
  useEffect(() => {
    if (!target || mode !== "cloud") return;
    let active = true;
    fetch(`/api/stores/${target}/import`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setImported(body.records || []);
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "检查历史导入失败");
      });
    return () => {
      active = false;
    };
  }, [target, mode]);
  useEffect(() => {
    if (local && data && target === activeStoreId)
      queueMicrotask(() => setPreview(previewMigration(local, data, imported)));
  }, [local, data, target, activeStoreId, imported]);
  async function run() {
    if (!local || !target || mode !== "cloud") return;
    setBusy(true);
    setError("");
    setResults(null);
    downloadText(
      `moonclean-local-backup-${new Date().toISOString().slice(0, 10)}.json`,
      readLocalRaw() || "",
      "application/json",
    );
    try {
      const response = await fetch(`/api/stores/${target}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: local.version,
          products: local.products,
          daily: local.daily,
          advertising: local.advertising,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "导入失败");
      setResults(body.results);
      await retry();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导入失败");
    } finally {
      setBusy(false);
    }
  }
  if (mode === "local")
    return (
      <div className="glass-card p-6">
        当前为本地演示模式。配置 Supabase
        并切换到云端模式后，可迁移此浏览器中的本地数据。
      </div>
    );
  return (
    <>
      <PageHead
        eyebrow="MIGRATION / 本地数据迁移"
        title="把本地经营数据带到云端"
        description="预览、选择店铺并确认导入。原始 localStorage 数据不会被删除。"
      />
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <SectionCard
          title="迁移预览"
          sub="先检测当前浏览器中的第一阶段记录"
          action={<DatabaseZap size={19} className="text-[#3b91eb]" />}
        >
          {!local ? (
            <p className="text-sm text-[#8296a9]">
              {error || "未检测到第一阶段本地数据。"}
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["商品", local.products.length],
                  ["经营日", local.daily.length],
                  ["推广日", local.advertising.length],
                ].map(([label, count]) => (
                  <div key={label} className="rounded-xl bg-[#f2f8ff] p-4">
                    <p className="text-xs text-[#8399ae]">{label}</p>
                    <p className="mt-2 text-xl font-bold number">{count}</p>
                  </div>
                ))}
              </div>
              <div>
                <label htmlFor="target-store" className="text-sm font-semibold">
                  目标店铺
                </label>
                <select
                  id="target-store"
                  className="mt-2 h-10 w-full rounded-lg border border-[#dce9f5] bg-white px-3 text-sm"
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    void switchStore(e.target.value);
                  }}
                >
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name} · {store.role}
                    </option>
                  ))}
                </select>
              </div>
              {preview && (
                <>
                  <p className="text-sm text-[#71889d]">
                    此前已导入 {preview.alreadyImported}{" "}
                    条；再次提交会自动跳过。
                  </p>
                  {preview.duplicateDates.length > 0 && (
                    <p className="rounded-xl bg-[#fff7f2] p-3 text-sm text-[#b57655]">
                      目标店铺已有相同日期：
                      {preview.duplicateDates.slice(0, 8).join("、")}
                      {preview.duplicateDates.length > 8 ? "等" : ""}
                      。这些记录会报告失败，不会覆盖。
                    </p>
                  )}
                  {preview.duplicateProducts.length > 0 && (
                    <p className="rounded-xl bg-[#fff7f2] p-3 text-sm text-[#b57655]">
                      目标店铺存在同名同类商品：
                      {preview.duplicateProducts.join("、")}
                      。请先核对，系统不会自动合并。
                    </p>
                  )}
                  {preview.errors.map((item) => (
                    <p
                      key={item}
                      role="alert"
                      className="text-sm text-[#e85d65]"
                    >
                      {item}
                    </p>
                  ))}
                </>
              )}
              {error && (
                <p role="alert" className="text-sm text-[#e85d65]">
                  {error}
                </p>
              )}
              <Button
                disabled={
                  busy ||
                  !preview ||
                  preview.errors.length > 0 ||
                  role === "viewer" ||
                  !stores.some((s) => s.id === target && s.role !== "viewer")
                }
                onClick={() => void run()}
              >
                <FileDown size={16} />
                {busy ? "正在逐条导入…" : "下载备份并确认导入"}
              </Button>
              <p className="text-xs leading-5 text-[#9aabba]">
                导入按商品、经营日、推广日顺序执行；每条记录使用稳定来源 ID
                防重复。成功与失败会分别列出。
              </p>
            </div>
          )}
        </SectionCard>
        <div className="space-y-5">
          <SectionCard title="数据保护" sub="导入前和导入后">
            <div className="space-y-3 text-sm text-[#70879b]">
              <p className="flex gap-2">
                <ShieldCheck size={17} className="shrink-0 text-[#16a085]" />
                先下载完整本地 JSON 备份
              </p>
              <p className="flex gap-2">
                <ShieldCheck size={17} className="shrink-0 text-[#16a085]" />
                本地记录始终保留，不自动清除
              </p>
              <p className="flex gap-2">
                <ShieldCheck size={17} className="shrink-0 text-[#16a085]" />
                重复提交按来源 ID 跳过
              </p>
            </div>
          </SectionCard>
          {results && (
            <SectionCard title="导入结果" sub="每条记录的处理状态">
              <div className="mb-3 flex gap-4 text-sm">
                <span className="positive">
                  成功 {results.filter((r) => r.status === "success").length}
                </span>
                <span>
                  跳过 {results.filter((r) => r.status === "skipped").length}
                </span>
                <span className="negative">
                  失败 {results.filter((r) => r.status === "failed").length}
                </span>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {results.map((r, index) => (
                  <div
                    key={`${r.kind}-${r.sourceId}-${index}`}
                    className="flex items-start gap-2 border-b border-[#edf2f7] pb-2 text-xs"
                  >
                    {r.status === "failed" ? (
                      <AlertCircle
                        size={14}
                        className="shrink-0 text-[#e85d65]"
                      />
                    ) : (
                      <CheckCircle2
                        size={14}
                        className="shrink-0 text-[#16a085]"
                      />
                    )}
                    <span className="break-all">
                      {r.kind} · {r.sourceId} · {r.status}
                      {r.message ? ` · ${r.message}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          <Link href="/data" className="text-sm font-semibold text-[#3b91eb]">
            前往数据中心 →
          </Link>
        </div>
      </div>
    </>
  );
}
