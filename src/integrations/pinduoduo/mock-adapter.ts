import type {
  PinduoduoAdapter, ListOptions, Page, NormalizedOrder,
  NormalizedProduct, NormalizedRefund,
} from "./types";

export type MockEvent = {
  kind: "order" | "refund";
  external_id: string;
  payload: unknown;
  updated_at: string;
};
export type MockFault = "timeout" | "rate_limit" | "token_expired" | "partial_batch";
const names = ["月明净油污净", "月明净洗衣液", "月明净浴室泡泡清洁剂"];
const codes = ["YJ-001", "XY-001", "YS-001"];
const prices = ["29.90", "39.90", "24.90"];
const at = (base: string, days: number, minutes = 0) =>
  new Date(new Date(base).getTime() + days * 86400000 + minutes * 60000).toISOString();
const day = (base: string, offset: number) =>
  at(new Date(base).toISOString().slice(0, 10) + "T04:00:00.000Z", offset);

function page<T extends { externalId: string; updatedAt: string }>(
  records: T[], options: ListOptions,
): Page<T> {
  const sorted = records.filter((r) =>
    (!options.from || r.updatedAt >= options.from) &&
    (!options.to || r.updatedAt <= options.to) &&
    (!options.cursor || `${r.updatedAt}|${r.externalId}` > options.cursor),
  ).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.externalId.localeCompare(b.externalId));
  const count = Math.max(1, Math.min(options.limit, 100));
  const batch = sorted.slice(0, count);
  return {
    records: batch,
    nextCursor: batch.length ? `${batch.at(-1)!.updatedAt}|${batch.at(-1)!.externalId}` : null,
  };
}

export class MockPinduoduoAdapter implements PinduoduoAdapter {
  constructor(
    private readonly createdAt: string,
    private readonly events: MockEvent[] = [],
    private readonly fault?: MockFault,
  ) {}
  async getAuthorizationStatus() { return "demo" as const; }
  getAvailableCapabilities() {
    return { orders: true, products: true, refunds: true, officialAuthorization: false };
  }
  private fail(options: ListOptions) {
    if (this.fault === "timeout") throw new Error("MOCK_TIMEOUT: 模拟网络超时");
    if (this.fault === "rate_limit") throw new Error("MOCK_RATE_LIMIT: 模拟平台限流");
    if (this.fault === "token_expired") throw new Error("MOCK_TOKEN_EXPIRED: 模拟令牌过期");
    if (this.fault === "partial_batch" && options.cursor)
      throw new Error("MOCK_PARTIAL_BATCH: 模拟第二批次失败");
  }
  async listProducts(options: ListOptions): Promise<Page<NormalizedProduct>> {
    this.fail(options);
    return page(names.map((name, i) => ({
      externalId: `mock-product-${i + 1}`, name,
      updatedAt: at(this.createdAt, 0, i),
      skus: [{ externalId: `mock-sku-${i + 1}`, code: codes[i], name: "标准装", price: prices[i] }],
    })), options);
  }
  async listOrders(options: ListOptions): Promise<Page<NormalizedOrder>> {
    this.fail(options);
    const base: NormalizedOrder[] = Array.from({ length: 9 }, (_, i) => ({
      externalId: `mock-order-${i + 1}`,
      status: i === 1 ? "refunded" : i % 3 === 0 ? "shipped" : "completed",
      placedAt: day(this.createdAt, -8 + i),
      updatedAt: at(this.createdAt, 0, i + 5),
      grossSales: prices[i % 3],
      items: [{ externalSkuId: `mock-sku-${(i % 3) + 1}`, quantity: 1, grossSales: prices[i % 3] }],
    }));
    const byId = new Map(base.map((r) => [r.externalId, r]));
    for (const event of this.events.filter((e) => e.kind === "order")) {
      const value = event.payload as Partial<NormalizedOrder>;
      const old = byId.get(event.external_id);
      if (!old && (!value.placedAt || !value.grossSales || !value.items)) continue;
      byId.set(event.external_id, {
        externalId: event.external_id,
        status: value.status || old?.status || "paid",
        placedAt: value.placedAt || old!.placedAt,
        updatedAt: new Date(event.updated_at).toISOString(),
        grossSales: value.grossSales || old!.grossSales,
        items: value.items || old!.items,
      });
    }
    return page([...byId.values()], options);
  }
  async listRefunds(options: ListOptions): Promise<Page<NormalizedRefund>> {
    this.fail(options);
    const base: NormalizedRefund[] = [{
      externalId: "mock-refund-1", orderExternalId: "mock-order-2",
      amount: "10.00", status: "succeeded", reason: "damaged", note: "外包装有轻微渗漏（模拟）", updatedAt: at(this.createdAt, 0, 20),
    }];
    const byId = new Map(base.map((r) => [r.externalId, r]));
    for (const event of this.events.filter((e) => e.kind === "refund")) {
      const value = event.payload as Partial<NormalizedRefund>;
      const old = byId.get(event.external_id);
      if (!old && (!value.orderExternalId || !value.amount)) continue;
      byId.set(event.external_id, {
        externalId: event.external_id,
        orderExternalId: value.orderExternalId || old!.orderExternalId,
        amount: value.amount || old!.amount,
        status: value.status || old?.status || "pending",
        reason: value.reason ?? old?.reason,
        note: value.note ?? old?.note,
        updatedAt: new Date(event.updated_at).toISOString(),
      });
    }
    return page([...byId.values()], options);
  }
}
