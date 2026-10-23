export type CopilotModel = "deepseek-flash" | "deepseek-v4-pro";
export type CopilotReasoningEffort = "none" | "low" | "high" | "max";

export function copilotModelOptions(model: CopilotModel, effort: CopilotReasoningEffort) {
  return {
    model: model === "deepseek-v4-pro" ? "deepseek-v4-pro" : "deepseek-flash",
    thinking: { type: effort === "none" ? "disabled" : "enabled" },
    reasoning_effort: effort,
    stream: true,
    stream_options: { include_usage: true },
  } as const;
}
