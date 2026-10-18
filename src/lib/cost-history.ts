export interface CostVersion {
  id: string;
  sku_id: string;
  effective_from: string;
  created_at: string;
}

export function indexCosts<T extends CostVersion>(costs: T[]): Map<string, T[]> {
  const bySku = new Map<string, T[]>();
  for (const cost of costs) {
    const history = bySku.get(cost.sku_id);
    if (history) history.push(cost);
    else bySku.set(cost.sku_id, [cost]);
  }
  for (const history of bySku.values()) {
    history.sort(
      (a, b) =>
        b.effective_from.localeCompare(a.effective_from) ||
        b.created_at.localeCompare(a.created_at) ||
        b.id.localeCompare(a.id),
    );
  }
  return bySku;
}

export function costForDate<T extends CostVersion>(
  bySku: Map<string, T[]>,
  skuId: string,
  date: string,
): T | undefined {
  return bySku.get(skuId)?.find((cost) => cost.effective_from <= date);
}
