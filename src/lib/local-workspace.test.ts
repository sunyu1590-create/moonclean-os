import { describe, expect, it } from "vitest";
import { shouldBypassAuthForLocalWorkspace } from "./local-workspace";

describe("本地工作区访问边界", () => {
  it("允许本地模式加载应用页面", () => {
    expect(shouldBypassAuthForLocalWorkspace("/tasks", "local", false)).toBe(true);
  });

  it("即使选择本地模式也不绕过 API 身份校验", () => {
    expect(shouldBypassAuthForLocalWorkspace("/api/stores", "local", false)).toBe(false);
  });

  it("未选择本地模式时仍使用云端页面身份校验", () => {
    expect(shouldBypassAuthForLocalWorkspace("/dashboard", "cloud", false)).toBe(false);
  });
});
