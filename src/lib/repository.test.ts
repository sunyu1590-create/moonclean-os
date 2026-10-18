import { describe, expect, it } from "vitest";
import { dataSchema, migrate } from "./repository";
import { createEmptyLocalData, demoData } from "./seed";

describe("数据版本迁移", () => {
  it("将 v0 数据迁移到当前版本并补齐角色", () => {
    const old = {
      ...demoData(),
      version: 0,
      settings: { ...demoData().settings, role: undefined },
    };
    const migrated = migrate(old) as ReturnType<typeof demoData>;
    expect(migrated.version).toBe(1);
    expect(migrated.settings.role).toBe("owner");
    expect(migrated.daily.length).toBe(30);
  });

  it("本地存储校验保留 SKU、待办、库存和官方来源字段", () => {
    const data = demoData();
    data.daily[0].source = "official_pinduoduo";
    data.skuDaily = [{ id: "line-1", skuId: "sku-1", date: "2026-10-18", quantitySold: 2, grossSales: "30.00", refundAmount: "0.00" }];
    data.tasks = [{ id: "task-1", title: "补货", detail: "", priority: "high", status: "todo", due_date: null, created_at: "2026-10-18T00:00:00.000Z", updated_at: "2026-10-18T00:00:00.000Z" }];
    data.inventory = [{ sku_id: "sku-1", quantity: 8, low_stock_threshold: 10, updated_at: "2026-10-18T00:00:00.000Z" }];
    const parsed = dataSchema.parse(data);
    expect(parsed.skuDaily).toEqual(data.skuDaily);
    expect(parsed.tasks).toEqual(data.tasks);
    expect(parsed.inventory).toEqual(data.inventory);
    expect(parsed.daily[0].source).toBe("official_pinduoduo");
  });

  it("新建的本地工作区从空白数据开始且可安全持久化", () => {
    const data = createEmptyLocalData();
    expect(data.products).toHaveLength(0);
    expect(data.daily).toHaveLength(0);
    expect(data.settings.store.id).toMatch(/^local-/);
    expect(dataSchema.parse(data)).toEqual(data);
  });
});
