"use client";

import JSZip from "jszip";
import { useRef, useState } from "react";
import { Archive, Download, LoaderCircle, Upload } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const BUCKET = "moonclean-service-attachments";
const MANIFEST_FILE = "moonclean-attachments.json";
type Store = { id: string; name: string };
type CaseRow = { id: string; store_id: string; attachment_paths: string[] };
type AttachmentEntry = {
  storeId: string;
  storeName: string;
  caseId: string;
  path: string;
  archivePath: string;
  size: number;
  contentType: string;
};
type AttachmentArchive = {
  format: "moonclean-os-attachments";
  formatVersion: 1;
  generatedAt: string;
  stores: Store[];
  files: AttachmentEntry[];
};
type Inventory = { stores: Store[]; cases: CaseRow[] };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function loadInventory(): Promise<Inventory> {
  const response = await fetch("/api/backup/attachments", { credentials: "same-origin", cache: "no-store" });
  const body = await response.json().catch(() => null) as Inventory & { error?: string } | null;
  if (!response.ok || !body) throw new Error(body?.error || "读取附件清单失败");
  return body;
}

function parseArchive(value: unknown): AttachmentArchive {
  const schema = z.object({
    format: z.literal("moonclean-os-attachments"),
    formatVersion: z.literal(1),
    generatedAt: z.iso.datetime(),
    stores: z.array(z.object({ id: z.uuid(), name: z.string().min(1).max(160) })).max(100),
    files: z.array(z.object({
      storeId: z.uuid(), storeName: z.string().min(1).max(160), caseId: z.uuid(),
      path: z.string().min(1).max(500), archivePath: z.string().regex(/^files\/\d{5}$/),
      size: z.number().int().nonnegative().max(10 * 1024 * 1024), contentType: z.string().max(200),
    })).max(2000),
  });
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("附件备份清单无效、版本不兼容，或包含超过 10 MB 的文件");
  const storeIds = new Set(parsed.data.stores.map((store) => store.id));
  const archivePaths = new Set<string>();
  for (const file of parsed.data.files) {
    if (!storeIds.has(file.storeId) || !file.path.startsWith(`${file.storeId}/cases/${file.caseId}/`) || file.path.includes("..") || archivePaths.has(file.archivePath)) {
      throw new Error("附件路径校验失败");
    }
    archivePaths.add(file.archivePath);
  }
  return parsed.data;
}

export function AttachmentBackup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [targetStores, setTargetStores] = useState<Store[]>([]);
  const [archive, setArchive] = useState<AttachmentArchive | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  async function exportAttachments() {
    setBusy(true); setError(""); setMessage(""); setProgress("读取店铺附件清单…");
    try {
      const inventory = await loadInventory();
      const storesById = new Map(inventory.stores.map((store) => [store.id, store]));
      const refs = inventory.cases.flatMap((item) => (item.attachment_paths || []).map((path) => ({ storeId: item.store_id, caseId: item.id, path })));
      const zip = new JSZip();
      const files: AttachmentEntry[] = [];
      const client = createBrowserSupabaseClient();
      for (const [index, ref] of refs.entries()) {
        if (!ref.path.startsWith(`${ref.storeId}/cases/${ref.caseId}/`) || ref.path.includes("..")) throw new Error("数据库中的附件路径未通过安全校验");
        setProgress(`正在下载附件 ${index + 1}/${refs.length}…`);
        const { data, error: downloadError } = await client.storage.from(BUCKET).download(ref.path);
        if (downloadError || !data) throw new Error(`下载附件失败：${ref.path.split("/").pop()}`);
        const archivePath = `files/${String(index + 1).padStart(5, "0")}`;
        zip.file(archivePath, data);
        files.push({ storeId: ref.storeId, storeName: storesById.get(ref.storeId)?.name || ref.storeId, caseId: ref.caseId, path: ref.path, archivePath, size: data.size, contentType: data.type || "application/octet-stream" });
      }
      const includedStoreIds = new Set(files.map((file) => file.storeId));
      const manifest: AttachmentArchive = { format: "moonclean-os-attachments", formatVersion: 1, generatedAt: new Date().toISOString(), stores: inventory.stores.filter((store) => includedStoreIds.has(store.id)), files };
      zip.file(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
      setProgress("正在整理附件归档…");
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } }, ({ percent }) => setProgress(`正在打包附件 ${Math.floor(percent)}%…`));
      downloadBlob(blob, `moonclean-attachments-${new Date().toISOString().slice(0, 10)}.zip`);
      setMessage(`附件归档已下载，共 ${files.length} 个文件，${(blob.size / 1024 / 1024).toFixed(2)} MB。`);
      setProgress("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "附件备份失败"); setProgress("");
    } finally { setBusy(false); }
  }

  async function inspectArchive(file?: File) {
    setError(""); setMessage(""); setArchive(null);
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) { setError("附件归档不能超过 500 MB。"); return; }
    setBusy(true); setProgress("正在校验附件归档…");
    try {
      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file(MANIFEST_FILE);
      if (!manifestFile) throw new Error("压缩包中未找到 MoonClean 附件清单");
      const parsed = parseArchive(JSON.parse(await manifestFile.async("string")));
      const inventory = await loadInventory();
      const nextMapping: Record<string, string> = {};
      for (const source of parsed.stores) {
        const byId = inventory.stores.find((store) => store.id === source.id);
        const byName = inventory.stores.filter((store) => store.name === source.name);
        if (byId) nextMapping[source.id] = byId.id;
        else if (byName.length === 1) nextMapping[source.id] = byName[0].id;
        else nextMapping[source.id] = "";
      }
      setTargetStores(inventory.stores); setMapping(nextMapping); setArchive(parsed);
      setProgress("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取附件归档"); setProgress("");
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function importAttachments() {
    if (!archive) return;
    const missing = archive.stores.filter((store) => !mapping[store.id]);
    if (missing.length) { setError("请为归档中的每个店铺选择目标店铺。"); return; }
    if (!window.confirm(`将 ${archive.files.length} 个附件恢复到所选店铺。已有文件不会覆盖，继续吗？`)) return;
    setBusy(true); setError(""); setMessage("");
    const client = createBrowserSupabaseClient();
    const successful: { storeId: string; caseId: string; path: string }[] = [];
    const failures: string[] = [];
    setProgress("正在准备恢复附件…");
    try {
      const archiveBlob = archiveSource.current;
      if (!archiveBlob) throw new Error("附件文件已丢失，请重新选择归档");
      const sourceZip = await JSZip.loadAsync(archiveBlob);
      const inventory = await loadInventory();
      const existingCases = new Set(inventory.cases.map((item) => `${item.store_id}:${item.id}`));
      for (const [index, entry] of archive.files.entries()) {
        const targetStoreId = mapping[entry.storeId];
        const targetPath = `${targetStoreId}/${entry.path.split("/").slice(1).join("/")}`;
        if (!existingCases.has(`${targetStoreId}:${entry.caseId}`)) { failures.push(`${entry.path.split("/").pop()}: 目标店铺中找不到对应工单`); continue; }
        const archivedFile = sourceZip.file(entry.archivePath);
        if (!archivedFile) { failures.push(`${entry.path.split("/").pop()}: 压缩包内文件缺失`); continue; }
        const blob = await archivedFile.async("blob");
        if (blob.size !== entry.size) { failures.push(`${entry.path.split("/").pop()}: 文件大小与清单不符`); continue; }
        setProgress(`恢复附件 ${index + 1}/${archive.files.length}…`);
        const { error: uploadError } = await client.storage.from(BUCKET).upload(targetPath, blob, { contentType: entry.contentType, upsert: false });
        if (uploadError) {
          const { data: existing, error: readError } = await client.storage.from(BUCKET).download(targetPath);
          if (readError || !existing || existing.size !== blob.size) { failures.push(`${entry.path.split("/").pop()}: ${uploadError.message}`); continue; }
          const [a, b] = await Promise.all([existing.arrayBuffer(), blob.arrayBuffer()]);
          const existingBytes = new Uint8Array(a);
          const archivedBytes = new Uint8Array(b);
          if (existingBytes.some((byte, i) => byte !== archivedBytes[i])) { failures.push(`${entry.path.split("/").pop()}: 同路径已有不同内容，已跳过`); continue; }
        }
        successful.push({ storeId: targetStoreId, caseId: entry.caseId, path: targetPath });
      }
      const byCase = new Map<string, { storeId: string; caseId: string; paths: string[] }>();
      for (const item of successful) {
        const key = `${item.storeId}:${item.caseId}`;
        const group = byCase.get(key) || { storeId: item.storeId, caseId: item.caseId, paths: [] };
        group.paths.push(item.path); byCase.set(key, group);
      }
      if (byCase.size) {
        const response = await fetch("/api/backup/attachments", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cases: [...byCase.values()] }) });
        const result = await response.json().catch(() => ({})) as { updated?: number; attachedPaths?: number; failures?: { caseId: string; error: string }[]; error?: string };
        if (!response.ok && response.status !== 207) throw new Error(result.error || "保存工单附件关联失败");
        const failedCaseIds = new Set((result.failures || []).map((item) => item.caseId));
        for (const item of result.failures || []) failures.push(`工单 ${item.caseId}: ${item.error}`);
        const restoredCount = successful.filter((item) => !failedCaseIds.has(item.caseId)).length;
        setMessage(`附件恢复完成：成功 ${restoredCount} 个${failures.length ? `，失败 ${failures.length} 个` : "，全部成功"}。`);
        if (failures.length) setError(failures.slice(0, 8).join("；") + (failures.length > 8 ? "；更多错误已省略" : ""));
        setArchive(null); setProgress("");
        return;
      }
      const restoredCount = successful.length;
      setMessage(`附件恢复完成：成功 ${restoredCount} 个${failures.length ? `，失败 ${failures.length} 个` : "，全部成功"}。`);
      if (failures.length) setError(failures.slice(0, 8).join("；") + (failures.length > 8 ? "；更多错误已省略" : ""));
      setArchive(null); setProgress("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "附件恢复失败"); setProgress("");
    } finally { setBusy(false); }
  }

  const archiveSource = useRef<Blob | null>(null);
  return <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-2">
      <Button className="w-full justify-start" variant="outline" disabled={busy} onClick={() => void exportAttachments()}><Download size={16}/>{busy ? "正在处理附件…" : "单独导出售后附件"}</Button>
      <Button className="w-full justify-start" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={16}/>导入附件归档</Button>
    </div>
    <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; archiveSource.current = file || null; void inspectArchive(file); }}/>
    {progress && <p role="status" className="flex items-center gap-2 text-xs text-[#58728b]"><LoaderCircle size={14} className="animate-spin"/>{progress}</p>}
    {message && <p role="status" className="text-xs leading-5 text-[#168a70]">{message}</p>}
    {error && <p role="alert" className="text-xs leading-5 text-[#e85d65]">{error}</p>}
    {archive && <div className="space-y-3 rounded-xl border border-[#e3edf6] bg-[#f8fbfe] p-3">
      <div className="flex items-start gap-2"><Archive size={16} className="mt-0.5 text-[#3b91eb]"/><div className="text-xs leading-5 text-[#536b80]"><p className="font-semibold text-[#203a54]">已读取 {archive.files.length} 个附件</p><p>选择目标店铺；工单 ID 需与导入的业务数据一致。已有同路径文件不会被覆盖。</p></div></div>
      {archive.stores.map((store) => <label key={store.id} className="grid gap-1 text-xs text-[#60768b] sm:grid-cols-[1fr_1fr] sm:items-center"><span>{store.name}（源店铺）</span><select value={mapping[store.id] || ""} onChange={(event) => setMapping((current) => ({ ...current, [store.id]: event.target.value }))} className="h-9 rounded-lg border border-[#dce7f0] bg-white px-2 text-sm text-[#263e55]"><option value="">选择目标店铺</option>{targetStores.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>)}
      <Button disabled={busy} onClick={() => void importAttachments()}>{busy ? "正在恢复…" : "确认恢复附件"}</Button>
    </div>}
  </div>;
}
