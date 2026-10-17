import { afterEach, describe, expect, it, vi } from "vitest";
import { demoData } from "@/lib/seed";
import { SupabaseRepository } from "./repository";
afterEach(() => vi.unstubAllGlobals());
describe("云端 Repository", () => {
  it("云端保存失败时向调用者抛错，不返回假成功", async () => {
    const original = demoData();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(original), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "数据库暂时不可用" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const repository = new SupabaseRepository();
    await repository.load("store-id");
    const next = {
      ...original,
      daily: [
        ...original.daily,
        { ...original.daily[0], id: "new-row", date: "2026-09-01" },
      ],
    };
    await expect(repository.save(next, original)).rejects.toThrow(
      "数据库暂时不可用",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
