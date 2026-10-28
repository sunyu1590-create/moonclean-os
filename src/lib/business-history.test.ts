import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "@/lib/model";
import { appendLocalBusinessRevisions, ensureLocalBusinessBaselines, readLocalBusinessRevisions } from "./business-history";

const storage = new Map<string, string>();
let id = 0;
const baseData = {
  daily: [{ id: "daily-1", date: "2026-10-27", sales: "100.00", refunds: "0.00", orders: 2, productCost: "30.00", packagingCost: "2.00", logisticsCost: "5.00", platformFees: "4.00", otherExpenses: "0.00", productSales: {} }],
  advertising: [{ id: "ad-1", date: "2026-10-27", spend: "10.00", attributedSales: "25.00", attributedOrders: 1 }],
  skuDaily: [{ id: "sku-day-1", skuId: "sku-1", date: "2026-10-27", quantitySold: 2, grossSales: "50.00", refundAmount: "0.00" }],
  products: [{ id: "product-1", name: "洗衣液", category: "清洁", createdAt: "2026-01-01", skus: [{ id: "sku-1", name: "1kg", price: "50.00", cost: { production: "30.00", packaging: "2.00", logistics: "5.00", platform: "4.00" }, costHistory: [{ effectiveFrom: "2026-10-27", cost: { production: "30.00", packaging: "2.00", logistics: "5.00", platform: "4.00" } }] }] }],
} as AppData;

describe("本地经营历史", () => {
  afterEach(() => {
    storage.clear();
    vi.unstubAllGlobals();
  });

  it("为已有记录建立基线，并保存后续修改前后的值", () => {
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } });
    vi.stubGlobal("crypto", { randomUUID: () => `revision-${++id}` });
    expect(typeof window).toBe("object");
    expect(typeof crypto).toBe("object");
    expect(typeof crypto.randomUUID).toBe("function");
    expect(window.localStorage.getItem("moonclean-business-history-v1:local-store")).toBeNull();
    ensureLocalBusinessBaselines("local-store", baseData);
    expect(storage.get("moonclean-business-history-v1:local-store")).toBeDefined();
    expect(readLocalBusinessRevisions("local-store", "2026-10-27", "2026-10-27")).toHaveLength(4);

    const updated = structuredClone(baseData);
    updated.daily[0].sales = "125.00";
    updated.skuDaily![0]!.quantitySold = 3;
    updated.products[0]!.skus[0]!.costHistory![0]!.cost.production = "32.00";
    appendLocalBusinessRevisions("local-store", baseData, updated);
    const rows = readLocalBusinessRevisions("local-store", "2026-10-27", "2026-10-27");
    expect(rows).toHaveLength(7);
    expect(rows.find((row) => row.action === "update")?.before_values?.sales).toBe("100.00");
    expect(rows.find((row) => row.action === "update")?.after_values?.sales).toBe("125.00");
    expect(rows.find((row) => row.metric_type === "sku_daily" && row.action === "update")?.before_values?.quantitySold).toBe(2);
    expect(rows.find((row) => row.metric_type === "sku_cost" && row.action === "update")?.after_values?.production).toBe("32.00");
  });
});
