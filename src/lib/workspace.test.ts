import { describe, expect, it } from "vitest";
import { appendOnlyResources, resourceSchemas, workspaceResource, workspaceTable } from "@/lib/workspace";

describe("运营工作台数据校验", () => {
  it("只允许列出的工作台资源", () => {
    expect(workspaceResource.safeParse("notes").success).toBe(true);
    expect(workspaceResource.safeParse("stores").success).toBe(false);
  });
  it("拒绝负竞品价格并接受有效价格", () => {
    const schema = resourceSchemas.competitors;
    expect(schema.safeParse({ product_name: "竞品", current_price: -1 }).success).toBe(false);
    expect(schema.safeParse({ product_name: "竞品", current_price: 19.9 }).success).toBe(true);
  });
  it("实验指标允许负利润，且禁止非数字", () => {
    const schema = resourceSchemas.experiments;
    expect(schema.safeParse({ name: "利润实验", experiment_type: "custom", baseline_metrics: { profit: -12.35 } }).success).toBe(true);
    expect(schema.safeParse({ name: "非法实验", experiment_type: "custom", result_metrics: { profit: "亏损" } }).success).toBe(false);
  });
  it("工单赔付不得为负数", () => {
    expect(resourceSchemas["service-cases"].safeParse({ issue_category: "refund", description: "商品漏液", compensation_amount: -1 }).success).toBe(false);
  });
  it("历史与 AI 用量资源只读或追加，不提供普通覆盖", () => {
    expect(appendOnlyResources.has("note-versions")).toBe(true);
    expect(appendOnlyResources.has("copilot-usage")).toBe(true);
    expect(workspaceTable["copilot-usage"]).toBe("copilot_usage_logs");
  });
});
