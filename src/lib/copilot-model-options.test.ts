import { describe, expect, it } from "vitest";
import { copilotModelOptions } from "./copilot-model-options";

describe("AI 情报助手模型参数", () => {
  it("Flash 深入模式启用思考并保留服务商支持的推理档位", () => {
    expect(copilotModelOptions("deepseek-flash", "high")).toEqual({
      model: "deepseek-flash",
      thinking: { type: "enabled" },
      reasoning_effort: "high",
      stream: true,
      stream_options: { include_usage: true },
    });
  });

  it("关闭推理时同步关闭 thinking", () => {
    expect(copilotModelOptions("deepseek-flash", "none")).toMatchObject({
      thinking: { type: "disabled" },
      reasoning_effort: "none",
    });
  });
});
