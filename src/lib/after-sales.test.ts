import { describe, expect, it } from "vitest";
import { summarizeRefundIssues } from "@/lib/after-sales";

describe("summarizeRefundIssues", () => {
  it("按时间筛选问题类别并用十进制金额合计", () => {
    const since = Date.parse("2026-10-10T00:00:00.000Z");
    const result = summarizeRefundIssues([
      { amount: "0.10", status: "succeeded", reason: "damaged", placedAt: "2026-10-11T00:00:00.000Z" },
      { amount: "0.20", status: "pending", reason: "damaged", placedAt: "2026-10-12T00:00:00.000Z" },
      { amount: "8.00", status: "succeeded", reason: "quality", placedAt: "2026-10-01T00:00:00.000Z" },
      { amount: "1.00", status: "pending", placedAt: "2026-10-12T00:00:00.000Z" },
    ], since);

    expect(result.total).toBe(3);
    expect(result.unclassified).toBe(1);
    expect(result.topReason?.reason).toBe("damaged");
    expect(result.topReason?.amount).toBe("0.30");
  });
});
