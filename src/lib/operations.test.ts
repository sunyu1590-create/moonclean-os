import { describe, expect, it } from "vitest";
import { taskSchema } from "@/lib/operations";

const base = { title: "跟进笔记", detail: "复核记录", priority: "normal", status: "todo", dueDate: null };

describe("运营待办来源关联", () => {
  it("兼容没有来源的普通任务", () => {
    expect(taskSchema.safeParse(base).success).toBe(true);
  });

  it("要求来源模块与记录 ID 成对提供", () => {
    expect(taskSchema.safeParse({ ...base, sourceModule: "notes" }).success).toBe(false);
    expect(taskSchema.safeParse({ ...base, sourceId: "81000000-0000-4000-8000-000000000001" }).success).toBe(false);
  });

  it("允许受支持模块的持久化关联", () => {
    expect(taskSchema.safeParse({ ...base, sourceModule: "notes", sourceId: "81000000-0000-4000-8000-000000000001" }).success).toBe(true);
    expect(taskSchema.safeParse({ ...base, sourceModule: "stores", sourceId: "81000000-0000-4000-8000-000000000001" }).success).toBe(false);
  });
});
