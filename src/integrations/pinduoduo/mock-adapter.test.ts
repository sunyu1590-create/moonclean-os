import { describe, expect, it } from "vitest";
import { MockPinduoduoAdapter } from "./mock-adapter";

const created = "2026-10-18T00:00:00.000Z";
describe("拼多多模拟适配器", () => {
  it("按稳定游标分页且重试不会重读已完成的批次", async () => {
    const adapter = new MockPinduoduoAdapter(created);
    const first = await adapter.listOrders({ limit: 4 });
    const second = await adapter.listOrders({ limit: 4, cursor: first.nextCursor });
    const third = await adapter.listOrders({ limit: 4, cursor: second.nextCursor });
    expect([first, second, third].flatMap(page => page.records).map(row => row.externalId))
      .toEqual(Array.from({ length: 9 }, (_, i) => `mock-order-${i + 1}`));
    expect((await adapter.listOrders({ limit: 4, cursor: third.nextCursor })).records).toEqual([]);
  });
  it("叠加状态变化与新增退款并模拟第二批失败", async () => {
    const adapter = new MockPinduoduoAdapter(created, [
      {kind:"order",external_id:"mock-order-1",payload:{status:"cancelled"},updated_at:"2026-10-19T00:00:00.000Z"},
      {kind:"refund",external_id:"extra",payload:{orderExternalId:"mock-order-3",amount:"5.00",status:"succeeded"},updated_at:"2026-10-19T00:00:00.000Z"},
    ]);
    expect((await adapter.listOrders({limit:20})).records.find(row => row.externalId==="mock-order-1")?.status).toBe("cancelled");
    expect((await adapter.listRefunds({limit:20})).records).toHaveLength(2);
    const faulty = new MockPinduoduoAdapter(created, [], "partial_batch");
    const first = await faulty.listOrders({limit:4});
    await expect(faulty.listOrders({limit:4,cursor:first.nextCursor})).rejects.toThrow("MOCK_PARTIAL_BATCH");
  });
  it("支持按更新时间窗口读取增量", async () => {
    const adapter = new MockPinduoduoAdapter(created);
    const all = (await adapter.listOrders({limit:20})).records;
    const selected = (await adapter.listOrders({limit:20,from:all[3].updatedAt,to:all[5].updatedAt})).records;
    expect(selected.map(order=>order.externalId)).toEqual(["mock-order-4","mock-order-5","mock-order-6"]);
  });
});
