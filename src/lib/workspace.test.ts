import { describe, expect, it } from "vitest";
import { appendOnlyResources, resourceSchemas, workspacePatchSchema, workspaceResource, workspaceTable } from "@/lib/workspace";

describe("运营工作台数据校验", () => {
  it("只允许列出的工作台资源", () => {
    expect(workspaceResource.safeParse("notes").success).toBe(true);
    expect(workspaceResource.safeParse("note-folders").success).toBe(true);
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
  it("笔记 PATCH 支持只更新部分字段，并在合并后保留关联成对校验", () => {
    const id = "81000000-0000-4000-8000-000000000001";
    const relatedId = "81000000-0000-4000-8000-000000000002";
    const existing = resourceSchemas.notes.parse({ id, title: "原笔记", related_type: "product", related_id: relatedId });
    const contentPatch = workspacePatchSchema("notes").parse({ id, body_markdown: "更新内容" });
    expect(resourceSchemas.notes.safeParse({ ...existing, ...contentPatch }).success).toBe(true);
    const invalidRelationPatch = workspacePatchSchema("notes").parse({ id, related_type: null });
    expect(resourceSchemas.notes.safeParse({ ...existing, ...invalidRelationPatch }).success).toBe(false);
    expect(workspacePatchSchema("notes").safeParse({ id, title: "更新标题" }).success).toBe(true);
  });
  it("笔记支持自动标题与店铺范围文件夹关联，保留原来的 Markdown 正文", () => {
    const folderId = "81000000-0000-4000-8000-000000000003";
    const note = resourceSchemas.notes.safeParse({ title: "经营复盘首行", title_is_auto: true, body_markdown: "# 经营复盘首行\n\n保留正文", folder_id: folderId, folder: "复盘" });
    expect(note.success).toBe(true);
    expect(workspaceTable["note-folders"]).toBe("operation_note_folders");
    expect(resourceSchemas["note-folders"].safeParse({ name: "  复盘  " }).success).toBe(true);
    expect(resourceSchemas["note-folders"].safeParse({ name: "" }).success).toBe(false);
  });
  it("历史与 AI 用量资源只读或追加，不提供普通覆盖", () => {
    expect(appendOnlyResources.has("note-versions")).toBe(true);
    expect(appendOnlyResources.has("copilot-usage")).toBe(true);
    expect(workspaceTable["copilot-usage"]).toBe("copilot_usage_logs");
  });
});
