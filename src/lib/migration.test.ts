import { describe, expect, it } from "vitest";
import { demoData } from "./seed";
import { previewMigration } from "./migration";
describe("本地数据迁移预览", () => {
  it("识别云端日期重复、商品同名和已导入记录", () => {
    const local = demoData();
    const cloud = demoData();
    const preview = previewMigration(local, cloud, [
      { source_kind: "daily", source_id: local.daily[0].id },
    ]);
    expect(preview.duplicateDates.length).toBe(59);
    expect(preview.duplicateProducts.length).toBe(3);
    expect(preview.alreadyImported).toBe(1);
  });
  it("阻止来源文件内的重复日期", () => {
    const local = demoData();
    local.daily.push({ ...local.daily[0], id: "another" });
    const preview = previewMigration(
      local,
      { ...demoData(), daily: [], advertising: [], products: [] },
      [],
    );
    expect(preview.errors).toContain("本地经营日期重复");
  });
});
