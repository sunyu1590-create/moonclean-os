import type { SupabaseClient } from "@supabase/supabase-js";
import { MockPinduoduoAdapter, type MockEvent, type MockFault } from "@/integrations/pinduoduo/mock-adapter";
import { orderSchema, productSchema, refundSchema, type SyncKind } from "@/integrations/pinduoduo/types";

type Client = SupabaseClient;
export type SyncResult = { jobId: string; status: "success" | "partial_success" | "failed"; count: number; error?: string };

export async function runMockSync(
  db: Client, storeId: string, connectionId: string, kind: SyncKind,
  fault?: MockFault,
): Promise<SyncResult> {
  const { data: connection, error: connectionError } = await db.from("platform_connections")
    .select("id,store_id,mode,created_at").eq("id", connectionId).eq("store_id", storeId).single();
  if (connectionError || connection?.mode !== "mock") throw new Error("模拟连接不存在或无权访问");
  const { data: events, error: eventsError } = await db.from("mock_platform_events")
    .select("kind,external_id,payload,updated_at").eq("connection_id", connectionId);
  if (eventsError) throw eventsError;
  const adapter = new MockPinduoduoAdapter(connection.created_at, (events || []) as MockEvent[], fault);
  const { data: cursorRow, error: cursorError } = await db.from("sync_cursors")
    .select("cursor_value").eq("connection_id", connectionId).eq("kind", kind).maybeSingle();
  if (cursorError) throw cursorError;
  const { data: jobId, error: startError } = await db.rpc("start_mock_sync", {
    p_store: storeId, p_connection: connectionId, p_kind: kind,
  });
  if (startError) throw startError;
  const schema = kind === "orders" ? orderSchema : kind === "products" ? productSchema : refundSchema;
  let cursor: string | null = cursorRow?.cursor_value || null;
  let count = 0;
  try {
    for (let n = 0; n < 100; n++) {
      const options = { cursor, limit: 4 };
      const page = kind === "orders" ? await adapter.listOrders(options)
        : kind === "products" ? await adapter.listProducts(options)
        : await adapter.listRefunds(options);
      const records = page.records.map((record) => schema.parse(record));
      if (!records.length) break;
      const { error: batchError } = await db.rpc("apply_mock_batch", {
        p_job: jobId, p_records: records, p_cursor: page.nextCursor,
      });
      if (batchError) throw batchError;
      count += records.length;
      cursor = page.nextCursor;
      if (records.length < options.limit) break;
      if (n === 99) throw new Error("同步页数超过上限");
    }
    if (kind === "products") await autoMapSkus(db, storeId, connectionId);
    const { error } = await db.rpc("finish_mock_sync", {
      p_job: jobId, p_status: "success", p_error: null,
    });
    if (error) throw error;
    return { jobId, status: "success", count };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "模拟同步失败";
    const status = count ? "partial_success" : "failed";
    const { error: finishError } = await db.rpc("finish_mock_sync", { p_job: jobId, p_status: status, p_error: message });
    if (finishError) throw new Error(`同步失败且任务状态保存失败：${finishError.message}`);
    return { jobId, status, count, error: message };
  }
}

async function autoMapSkus(db: Client, storeId: string, connectionId: string) {
  const [external, internal, mapped] = await Promise.all([
    db.from("external_skus").select("id,sku_code,name").eq("connection_id",connectionId),
    db.from("skus").select("id,sku_code,sku_name").eq("store_id",storeId).eq("status","active"),
    db.from("platform_sku_mappings").select("external_sku_id,sku_id").eq("connection_id",connectionId),
  ]);
  if (external.error) throw external.error;
  if (internal.error) throw internal.error;
  if (mapped.error) throw mapped.error;
  const used = new Set((mapped.data || []).map((m) => m.sku_id));
  const linked = new Set((mapped.data || []).map((m) => m.external_sku_id));
  for (const item of external.data || []) {
    if (linked.has(item.id)) continue;
    const candidates = (internal.data || []).filter((sku) =>
      !used.has(sku.id) && (item.sku_code && sku.sku_code === item.sku_code ||
        sku.sku_name === item.name && item.name !== "标准装"),
    );
    if (candidates.length !== 1) continue;
    const { error } = await db.from("platform_sku_mappings").insert({
      store_id: storeId, connection_id: connectionId, external_sku_id: item.id,
      sku_id: candidates[0].id, match_kind: "auto",
    });
    if (error) throw error;
    used.add(candidates[0].id);
  }
}
