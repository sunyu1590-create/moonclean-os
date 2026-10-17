import { describe, expect, it } from "vitest";
import { migrate } from "./repository";
import { demoData } from "./seed";

describe("数据版本迁移", () => {
  it("将 v0 数据迁移到当前版本并补齐角色", () => {
    const old = {
      ...demoData(),
      version: 0,
      settings: { ...demoData().settings, role: undefined },
    };
    const migrated = migrate(old) as ReturnType<typeof demoData>;
    expect(migrated.version).toBe(1);
    expect(migrated.settings.role).toBe("owner");
    expect(migrated.daily.length).toBe(30);
  });
});
