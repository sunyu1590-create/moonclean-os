"use client";

import { useEffect, useState } from "react";
import { Upload } from "tus-js-client";
import { Activity, CloudDownload, CloudUpload, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { supabaseConfig } from "@/lib/supabase/config";
import { matchesCloudLoadTestGrant } from "@/lib/cloud-load-test-access";

const BUCKET = "moonclean-load-test";
const PART_BYTES = 50_000_000;
const PART_COUNT = 4;
const TOTAL_BYTES = PART_BYTES * PART_COUNT;
const PART_NAMES = Array.from({ length: PART_COUNT }, (_, index) => `part-${String(index + 1).padStart(2, "0")}.bin`);

type Result = { seconds: number; megabytesPerSecond: number };

function makeSyntheticPart() {
  const chunks: ArrayBuffer[] = [];
  let remaining = PART_BYTES;
  while (remaining > 0) {
    const bytes = new Uint8Array(Math.min(65_536, remaining));
    crypto.getRandomValues(bytes);
    chunks.push(bytes.buffer as ArrayBuffer);
    remaining -= bytes.byteLength;
  }
  return new Blob(chunks, { type: "application/octet-stream" });
}

function uploadPart(file: Blob, path: string, accessToken: string, onProgress: (sent: number) => void) {
  const config = supabaseConfig();
  if (!config) return Promise.reject(new Error("尚未配置 Supabase 项目地址和 Publishable Key。"));
  const storageUrl = new URL(config.url);
  if (storageUrl.hostname.endsWith(".supabase.co")) {
    storageUrl.hostname = storageUrl.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  storageUrl.pathname = "/storage/v1/upload/resumable";
  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: storageUrl.toString(),
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: config.key,
      },
      metadata: {
        bucketName: BUCKET,
        objectName: path,
        contentType: "application/octet-stream",
        cacheControl: "0",
      },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      onProgress: (sent) => onProgress(sent),
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

export function CloudLoadTest({ userId }: { userId: string }) {
  const [accessGranted, setAccessGranted] = useState(false);
  const [runId, setRunId] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) return () => { cancelled = true; };
    void (async () => {
      try {
        const client = createBrowserSupabaseClient();
        const { data: access, error: accessError } = await client
          .from("moonclean_load_test_access")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (accessError) throw accessError;
        if (!matchesCloudLoadTestGrant(userId, access?.user_id)) return;
        if (cancelled) return;
        setAccessGranted(true);
        const savedRunId = localStorage.getItem(`moonclean-load-test:${userId}`) || "";
        const { data: folders, error: foldersError } = await client.storage.from(BUCKET).list(userId, { limit: 100 });
        if (foldersError) throw foldersError;
        const candidates = [...new Set([
          savedRunId,
          ...(folders || []).map((folder) => folder.name).filter((name) => /^[0-9a-f-]{36}$/i.test(name)),
        ].filter(Boolean))];
        for (const candidate of candidates) {
          const { data: files, error: listError } = await client.storage.from(BUCKET).list(`${userId}/${candidate}`, { limit: 10 });
          if (listError) throw listError;
          if (cancelled) return;
          if (PART_NAMES.every((name) => files?.some((file) => file.name === name))) {
            setRunId(candidate);
            localStorage.setItem(`moonclean-load-test:${userId}`, candidate);
            return;
          }
        }
        localStorage.removeItem(`moonclean-load-test:${userId}`);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "无法连接云端测试存储。");
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function deleteRun(targetRunId: string) {
    if (!userId || !targetRunId) return;
    const client = createBrowserSupabaseClient();
    const { error: removeError } = await client.storage.from(BUCKET).remove(PART_NAMES.map((name) => `${userId}/${targetRunId}/${name}`));
    if (removeError) throw removeError;
    localStorage.removeItem(`moonclean-load-test:${userId}`);
    setRunId("");
    setResult(null);
    setStatus("测试文件已从云端删除。");
  }

  async function createTestFiles() {
    setBusy(true);
    setProgress(0);
    setError("");
    setResult(null);
    setStatus("正在生成并上传虚拟测试数据…");
    let newRunId = "";
    try {
      if (!userId) throw new Error("正在验证登录状态，请稍后重试。");
      const client = createBrowserSupabaseClient();
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error("登录状态已失效，请重新登录后再测试。");
      if (runId) await deleteRun(runId);
      newRunId = crypto.randomUUID();
      let sentTotal = 0;
      for (const [index, name] of PART_NAMES.entries()) {
        const file = makeSyntheticPart();
        await uploadPart(file, `${userId}/${newRunId}/${name}`, sessionData.session.access_token, (sent) => {
          setProgress(Math.min(100, Math.round(((sentTotal + sent) / TOTAL_BYTES) * 100)));
        });
        sentTotal += file.size;
        setProgress(Math.round((sentTotal / TOTAL_BYTES) * 100));
        setStatus(`已上传第 ${index + 1}/${PART_COUNT} 个分片。`);
      }
      localStorage.setItem(`moonclean-load-test:${userId}`, newRunId);
      setRunId(newRunId);
      setStatus("200 MB 虚拟测试数据已就绪，可开始测量云端读取时间。");
    } catch (cause) {
      if (newRunId) {
        try { await deleteRun(newRunId); } catch { /* Keep the original upload error visible. */ }
      }
      setError(cause instanceof Error ? cause.message : "测试文件上传失败，请重试。");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function measureDownload() {
    if (!userId || !runId) return;
    setBusy(true);
    setProgress(0);
    setError("");
    setResult(null);
    setStatus("正在读取云端测试数据…");
    try {
      const client = createBrowserSupabaseClient();
      const start = performance.now();
      let loadedBytes = 0;
      for (const name of PART_NAMES) {
        const { data, error: downloadError } = await client.storage.from(BUCKET).download(`${userId}/${runId}/${name}`);
        if (downloadError) throw downloadError;
        if (!data || data.size !== PART_BYTES) throw new Error("云端测试文件大小不完整，请重新生成后再测。");
        await data.arrayBuffer();
        loadedBytes += data.size;
        setProgress(Math.round((loadedBytes / TOTAL_BYTES) * 100));
      }
      const seconds = (performance.now() - start) / 1000;
      setResult({ seconds, megabytesPerSecond: (TOTAL_BYTES / 1_000_000) / seconds });
      setStatus("云端读取完成。速度包含当前网络与浏览器环境的影响。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "云端读取失败，请重试。");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  if (!accessGranted || !userId) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-3" aria-labelledby="cloud-load-test-title">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--mc-tint-blue)] text-primary"><Activity size={17} /></span>
        <div className="min-w-0 flex-1">
          <h3 id="cloud-load-test-title" className="text-xs font-semibold text-foreground">云端加载能力测试</h3>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">生成 200 MB 虚拟数据并上传到你的私有测试空间，分为 4 个 50 MB 文件。测试数据与业务资料隔离。</p>
        </div>
      </div>
      {(busy || progress > 0) && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} /></div>}
      {status && <p className="mt-3 text-xs text-muted-foreground" role="status">{busy && <LoaderCircle size={13} className="mr-1 inline animate-spin" />}{status}{result && <> 用时 {result.seconds.toFixed(2)} 秒，平均 {result.megabytesPerSecond.toFixed(2)} MB/s。</>}</p>}
      {error && <p className="mt-3 text-xs text-[var(--mc-color-danger)]" role="alert">{error}</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button className="w-full justify-start" variant="outline" disabled={busy || !userId} onClick={() => void createTestFiles()}><CloudUpload size={15} />生成并上传 200 MB</Button>
        <Button className="w-full justify-start" variant="outline" disabled={busy || !runId} onClick={() => void measureDownload()}><CloudDownload size={15} />测量云端读取</Button>
        {runId && <Button className="w-full justify-start sm:col-span-2" variant="ghost" disabled={busy} onClick={() => void deleteRun(runId).catch((cause) => setError(cause instanceof Error ? cause.message : "删除测试文件失败。"))}><Trash2 size={15} />删除云端测试文件</Button>}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">文件会保留在你的私有测试空间，直到点击删除。下载计时会完整读取 200 MB 数据。</p>
    </section>
  );
}
