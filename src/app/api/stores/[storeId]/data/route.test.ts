import { describe, expect, it, vi } from "vitest";
import type { AppData } from "@/lib/model";

const tables: Record<string, Record<string, unknown>[]> = {};
const pages: { table: string; start: number }[] = [];
const supabase = {
  from(table: string) {
    return {
      select() {
        return {
          eq() {
            return {
              async single() {
                return { data: { id: "store", name: "测试店铺", platform: "pinduoduo", currency: "CNY", timezone: "Asia/Shanghai", sales_target: "0", margin_alert: 0, created_at: "2026-01-01T00:00:00Z" }, error: null };
              },
              order() {
                return {
                  async range(start: number, end: number) {
                    pages.push({ table, start });
                    return { data: (tables[table] || []).slice(start, end + 1), error: null };
                  },
                };
              },
            };
          },
        };
      },
    };
  },
};

vi.mock("@/lib/supabase/auth", () => ({
  requireStore: async () => ({ ok: true, role: "owner", supabase }),
  apiError: (error: Error) => { throw error; },
}));

import { GET } from "./route";

describe("云端数据分页", () => {
  it("读取超过 Supabase 单页上限的外部订单，不漏计营业额", async () => {
    tables.external_orders = Array.from({ length: 1001 }, (_, index) => ({
      id: `order-${index.toString().padStart(4, "0")}`,
      connection_id: "connection",
      placed_at: "2026-10-18T00:00:00Z",
      gross_sales: "1.00",
      status: "paid",
      is_demo: true,
    }));
    pages.length = 0;
    const response = await GET(new Request("http://localhost/api/stores/store/data"), {
      params: Promise.resolve({ storeId: "store" }),
    });
    const data = (await response.json()) as AppData;
    expect(response.status).toBe(200);
    expect(data.daily[0]).toMatchObject({ sales: "1001.00", orders: 1001 });
    expect(pages.filter((page) => page.table === "external_orders").map((page) => page.start)).toEqual([0, 500, 1000]);
  });
});
