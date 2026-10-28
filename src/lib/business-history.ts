import type { AdvertisingMetric, AppData, DailyMetric } from "@/lib/model";

export type BusinessMetricType = "daily" | "advertising" | "sku_daily" | "sku_cost";
export type BusinessRevisionAction = "baseline" | "insert" | "update" | "delete";
export type BusinessRevision = {
  id: string;
  business_date: string;
  metric_type: BusinessMetricType;
  source_record_id: string;
  action: BusinessRevisionAction;
  before_values: Record<string, unknown> | null;
  after_values: Record<string, unknown> | null;
  changed_by?: string | null;
  created_at: string;
};

const revisionKey = (storeId: string) => `moonclean-business-history-v1:${storeId}`;
const MAX_LOCAL_REVISIONS = 10_000;

function rowsById<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function revisionsForChange<T extends { id: string; date: string }>(
  type: BusinessMetricType,
  beforeRows: T[],
  afterRows: T[],
): BusinessRevision[] {
  const before = rowsById(beforeRows);
  const after = rowsById(afterRows);
  const now = new Date().toISOString();
  const revisions: BusinessRevision[] = [];
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const previous = before.get(id);
    const next = after.get(id);
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    revisions.push({
      id: crypto.randomUUID(),
      business_date: next?.date || previous!.date,
      metric_type: type,
      source_record_id: id,
      action: previous ? next ? "update" : "delete" : "insert",
      before_values: previous ? previous as unknown as Record<string, unknown> : null,
      after_values: next ? next as unknown as Record<string, unknown> : null,
      created_at: now,
    });
  }
  return revisions;
}

export function appendLocalBusinessRevisions(storeId: string, before: AppData, after: AppData) {
  if (typeof window === "undefined") return;
  try {
    const previous = JSON.parse(window.localStorage.getItem(revisionKey(storeId)) || "[]") as BusinessRevision[];
    const added = [
      ...revisionsForChange<DailyMetric>("daily", before.daily, after.daily),
      ...revisionsForChange<AdvertisingMetric>("advertising", before.advertising, after.advertising),
      ...revisionsForChange("sku_daily", before.skuDaily || [], after.skuDaily || []),
      ...revisionsForChange("sku_cost", localSkuCosts(before), localSkuCosts(after)),
    ];
    if (added.length) window.localStorage.setItem(revisionKey(storeId), JSON.stringify([...previous, ...added].slice(-MAX_LOCAL_REVISIONS)));
  } catch {
    // Local history is optional; data saving must still succeed when browser storage is full.
  }
}

export function ensureLocalBusinessBaselines(storeId: string, data: AppData) {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(revisionKey(storeId)) !== null) return;
    const now = new Date().toISOString();
    const revisions: BusinessRevision[] = [
      ...data.daily.map((row) => ({ id: crypto.randomUUID(), business_date: row.date, metric_type: "daily" as const, source_record_id: row.id, action: "baseline" as const, before_values: null, after_values: row as unknown as Record<string, unknown>, created_at: now })),
      ...data.advertising.map((row) => ({ id: crypto.randomUUID(), business_date: row.date, metric_type: "advertising" as const, source_record_id: row.id, action: "baseline" as const, before_values: null, after_values: row as unknown as Record<string, unknown>, created_at: now })),
      ...(data.skuDaily || []).map((row) => ({ id: crypto.randomUUID(), business_date: row.date, metric_type: "sku_daily" as const, source_record_id: row.id, action: "baseline" as const, before_values: null, after_values: row as unknown as Record<string, unknown>, created_at: now })),
      ...localSkuCosts(data).map((row) => ({ id: crypto.randomUUID(), business_date: row.date, metric_type: "sku_cost" as const, source_record_id: row.id, action: "baseline" as const, before_values: null, after_values: row as unknown as Record<string, unknown>, created_at: now })),
    ];
    window.localStorage.setItem(revisionKey(storeId), JSON.stringify(revisions.slice(-MAX_LOCAL_REVISIONS)));
  } catch {
    // Local history is optional; browsing the records remains available.
  }
}

function localSkuCosts(data: AppData) {
  return (data.products || []).flatMap((product) => product.skus.flatMap((sku) => (sku.costHistory || []).map((version) => ({
    id: `${sku.id}:${version.effectiveFrom}`,
    date: version.effectiveFrom,
    skuId: sku.id,
    production: version.cost.production,
    packaging: version.cost.packaging,
    logistics: version.cost.logistics,
    platform: version.cost.platform,
  }))));
}

export function readLocalBusinessRevisions(storeId: string, from: string, to: string): BusinessRevision[] {
  if (typeof window === "undefined") return [];
  try {
    const revisions = JSON.parse(window.localStorage.getItem(revisionKey(storeId)) || "[]") as BusinessRevision[];
    return revisions.filter((row) => row.business_date >= from && row.business_date <= to);
  } catch {
    return [];
  }
}
