import { describe, expect, it } from "vitest";
import { dashboardGreetingAt } from "@/lib/dashboard-greeting";

describe("总览时段问候", () => {
  it("按店铺时区区分早上、下午和晚上", () => {
    expect(dashboardGreetingAt(new Date("2026-10-25T01:00:00.000Z"), "Asia/Shanghai")).toBe("早上好，今天的生意一目了然");
    expect(dashboardGreetingAt(new Date("2026-10-25T07:57:00.000Z"), "Asia/Shanghai")).toBe("下午好，今天的生意一目了然");
    expect(dashboardGreetingAt(new Date("2026-10-25T12:00:00.000Z"), "Asia/Shanghai")).toBe("晚上好，今天的生意一目了然");
  });
});
