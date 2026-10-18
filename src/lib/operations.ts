import { z } from "zod";

export const inventorySchema = z.object({
  skuId: z.uuid(),
  quantity: z.number().int().min(0).max(100000000),
  threshold: z.number().int().min(0).max(100000000),
  note: z.string().trim().min(1).max(240),
});
export const taskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().max(1000),
  priority: z.enum(["low", "normal", "high"]),
  status: z.enum(["todo", "doing", "done"]),
  dueDate: z.iso.date().nullable(),
  recommendationKey: z.string().regex(/^[a-z0-9_-]{1,80}$/).nullable().optional(),
  recommendationBaseline: z.object({
    captured_at: z.iso.date(), coverage_days: z.number().int().min(0).max(7),
    net_sales: z.string().regex(/^\d+(\.\d{1,2})?$/), profit: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
    roas: z.number().nullable(), refund_rate: z.number().nullable(),
  }).nullable().optional(),
});
export type OperationTask = {
  id: string; title: string; detail: string; priority: "low" | "normal" | "high";
  status: "todo" | "doing" | "done"; due_date: string | null;
  created_at: string; updated_at: string;
  completed_at?: string | null;
  recommendation_key?: string | null;
  recommendation_baseline?: {
    captured_at: string; coverage_days: number; net_sales: string;
    profit: string; roas: number | null; refund_rate: number | null;
  } | null;
};
export type InventoryBalance = { sku_id: string; quantity: number; low_stock_threshold: number; updated_at: string };
export type InventoryMovement = { id: string; sku_id: string; quantity_before: number; quantity_after: number; delta: number; note: string; created_at: string };

export async function operationsRequest<T>(storeId: string, resource: string, body?: unknown, method = "GET"): Promise<T> {
  const response = await fetch(`/api/stores/${encodeURIComponent(storeId)}/${resource}`, {
    method, credentials: "same-origin", cache: "no-store",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
  return payload as T;
}
