import { describe, expect, it } from "vitest";
import { costForDate, indexCosts } from "./cost-history";

describe("历史成本索引", () => {
  it("按销售日期选择成本，同一天按创建时间选择最新版本", () => {
    const costs = indexCosts([
      { id: "later", sku_id: "a", effective_from: "2026-10-10", created_at: "2026-10-11T00:00:00Z" },
      { id: "old", sku_id: "a", effective_from: "2026-09-01", created_at: "2026-09-01T00:00:00Z" },
      { id: "earlier", sku_id: "a", effective_from: "2026-10-10", created_at: "2026-10-10T00:00:00Z" },
    ]);
    expect(costForDate(costs, "a", "2026-10-09")?.id).toBe("old");
    expect(costForDate(costs, "a", "2026-10-10")?.id).toBe("later");
    expect(costForDate(costs, "b", "2026-10-10")).toBeUndefined();
  });
});
