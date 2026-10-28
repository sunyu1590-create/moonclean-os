import { describe, expect, it, vi } from "vitest";

const queries: { table: string; filters: [string, unknown][] }[] = [];
const rowsByTable: Record<string, Record<string, unknown>[]> = {};
const supabase = {
  from(table: string) {
    const query = { table, filters: [] as [string, unknown][] };
    queries.push(query);
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => { query.filters.push([column, value]); return builder; },
      gte: (column: string, value: unknown) => { query.filters.push([column, value]); return builder; },
      lte: (column: string, value: unknown) => { query.filters.push([column, value]); return builder; },
      order: () => builder,
      async range(from: number, to: number) { return { data: (rowsByTable[table] || []).slice(from, to + 1), error: null }; },
    };
    return builder;
  },
};

vi.mock("@/lib/supabase/auth", () => ({
  requireStore: async () => ({ ok: true, supabase }),
  apiError: (error: Error) => { throw error; },
}));

import { GET } from "./route";

const storeId = "38bbd966-0330-42d1-b114-3a43bc10047a";

describe("历史经营接口", () => {
  it("按店铺和指定日期读取版本记录", async () => {
    queries.length = 0;
    rowsByTable.daily_metrics = [{ id: "daily-1", metric_date: "2026-10-27" }];
    rowsByTable.ad_metrics = [{ id: "ad-1", metric_date: "2026-10-27" }];
    rowsByTable.business_metric_revisions = [{ id: "revision-1", business_date: "2026-10-27", action: "baseline" }];

    const response = await GET(new Request(`http://localhost/api/stores/${storeId}/history?from=2026-10-01&to=2026-10-31&revisionsFor=2026-10-27`), { params: Promise.resolve({ storeId }) });
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.revisions).toHaveLength(1);
    expect(result.daily).toBeUndefined();
    expect(queries).toHaveLength(1);
    expect(queries[0]?.filters).toContainEqual(["store_id", storeId]);
    expect(queries[0]?.filters).toContainEqual(["business_date", "2026-10-27"]);
  });

  it("拒绝超过 366 天的日期范围", async () => {
    queries.length = 0;
    const response = await GET(new Request(`http://localhost/api/stores/${storeId}/history?from=2024-01-01&to=2026-10-31&revisionsFor=2026-10-27`), { params: Promise.resolve({ storeId }) });
    expect(response.status).toBe(400);
    expect(queries).toHaveLength(0);
  });
});
