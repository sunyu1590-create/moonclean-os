import { describe, expect, it, vi } from "vitest";
import { streamDeepSeekText } from "./ai-stream";

const source = (text: string) => new Response(
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`,
  { headers: { "Content-Type": "text/event-stream" } },
);

describe("AI 流式回复校验", () => {
  it("逐句输出已通过检查的内容，并在结束时用校验结果修正草稿", async () => {
    const completed = vi.fn();
    const response = streamDeepSeekText(
      source("当前日报有完整覆盖。missingCostDays: 2"),
      completed,
      undefined,
      (content) => content.includes("missingCostDays") ? "成本记录有缺失，请先补齐后再评估利润。" : content,
    );
    const body = await response.text();
    expect(body).not.toContain("missingCostDays");
    expect(body).toContain('"delta":"当前日报有完整覆盖。"');
    expect(body).toContain('"replace":"成本记录有缺失，请先补齐后再评估利润。"');
    expect(body).toContain("成本记录有缺失");
    expect(completed).toHaveBeenCalledWith(expect.objectContaining({ content: "成本记录有缺失，请先补齐后再评估利润。" }));
  });

  it("句子通过校验后立即产生增量事件", async () => {
    const body = await streamDeepSeekText(
      source("建议先补齐缺失日报。"),
      undefined,
      undefined,
      (content) => content,
    ).text();
    expect(body).toContain('"delta":"建议先补齐缺失日报。"');
    expect(body).not.toContain('"replace":');
  });

  it("未启用校验时仍保留原有增量输出", async () => {
    const response = streamDeepSeekText(source("已读取当前汇总数据。"));
    const body = await response.text();
    expect(body).toContain('"delta":"已读取当前汇总数据。"');
  });
});
