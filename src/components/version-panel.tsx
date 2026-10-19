"use client";

import { useCallback, useState } from "react";
import {
  ArrowUpCircle,
  ChevronDown,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/common";
import { APP_VERSION, RELEASE_NOTES } from "@/lib/release-notes";

interface VersionCheck {
  current: { version: string; shortCommit: string };
  latest: {
    version: string;
    shortCommit: string;
    date: string | null;
    message: string;
  };
  isLatest: boolean | null;
  source: "github-main" | "vercel-production";
}

export function VersionPanel() {
  const [result, setResult] = useState<VersionCheck | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState("");

  const checkUpdates = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/version", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "检查更新失败，请稍后重试。");
      setResult(body as VersionCheck);
      setCheckedAt(
        new Intl.DateTimeFormat("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "网络异常，暂时无法检查更新。请稍后重试。");
    } finally {
      setChecking(false);
    }
  }, []);

  return (
    <SectionCard
      title="版本与更新"
      sub="优先检查 GitHub main；GitHub 暂不可用时使用最新正式部署版本"
      action={<RefreshCw size={19} className="text-primary" />}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">当前版本</p>
            <p className="mt-1 font-semibold text-foreground">v{result?.current.version || APP_VERSION}</p>
            <p className="mt-1 text-xs text-muted-foreground">提交 {result?.current.shortCommit || (checking ? "检查中…" : "未检查")}</p>
          </div>
          {result && (
            <div>
              <p className="text-xs text-muted-foreground">{result.source === "github-main" ? "GitHub main 最新版本" : "最新正式部署版本（备用）"}</p>
              <p className="mt-1 font-semibold text-foreground">v{result.latest.version}</p>
              <p className="mt-1 text-xs text-muted-foreground">提交 {result.latest.shortCommit}</p>
            </div>
          )}
        </div>
        <Button type="button" variant="outline" onClick={() => void checkUpdates()} disabled={checking}>
          {checking ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {checking ? "检查中…" : "检查更新"}
        </Button>
      </div>

      {result && (
        <div className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm ${result.isLatest === true ? "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]" : result.isLatest === false ? "bg-[var(--mc-tint-orange)] text-[var(--mc-color-warning)]" : "bg-[var(--mc-tint-blue)] text-muted-foreground"}`}>
          {result.isLatest === true ? <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> : <ArrowUpCircle size={17} className="mt-0.5 shrink-0" />}
          <div>
            <p className="font-semibold">{result.isLatest === true ? "当前预览已是最新版本" : result.isLatest === false ? "当前预览不是最新版本" : "当前预览提交无法识别，暂时不能比较"}</p>
            {result.isLatest === false && <p className="mt-1">最新提交：{result.latest.message}</p>}
            <p className="mt-1 text-xs opacity-80">{checkedAt ? `最近检查 ${checkedAt}` : "已完成检查"}</p>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--mc-tint-red)] p-3 text-sm text-[var(--mc-color-danger)]">
          <CircleAlert size={17} className="mt-0.5 shrink-0" />{error}
        </p>
      )}
      {result && result.isLatest === false && (
        <div className="mt-4 rounded-xl border border-border bg-[var(--mc-tint-blue)] p-3 text-xs leading-6 text-muted-foreground">
          Codespaces 预览不会自动拉取代码。在终端运行 <code className="rounded bg-card px-1.5 py-0.5 text-foreground">git pull origin main</code> 和 <code className="rounded bg-card px-1.5 py-0.5 text-foreground">npm install</code>，然后重启 <code className="rounded bg-card px-1.5 py-0.5 text-foreground">npm run dev</code>。
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <details className="group rounded-2xl border border-border bg-[var(--mc-tint-blue)] p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <span>系统更新日志 <span className="ml-1 text-xs font-normal text-muted-foreground">{RELEASE_NOTES.length} 个版本</span></span>
            <ChevronDown size={17} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            {RELEASE_NOTES.map((release) => (
              <article key={release.version} className="border-l-2 border-border pl-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="text-sm font-semibold text-foreground">v{release.version} · {release.title}</h3>
                  <time className="text-xs text-muted-foreground">{release.date}</time>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
                  {release.changes.map((change) => <li key={change}>{change}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </details>
      </div>
    </SectionCard>
  );
}
