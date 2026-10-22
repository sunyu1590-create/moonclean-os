import { describe, expect, it } from "vitest";
import { readAiTextStream } from "./read-ai-stream";

describe("AI 流式客户端读取", () => {
  it("支持把已显示的增量草稿替换成最终校验内容", async () => {
    const response = new Response([
      `data: ${JSON.stringify({ delta: "临时草稿" })}\n\n`,
      `data: ${JSON.stringify({ replace: "校验后的建议" })}\n\n`,
      `data: ${JSON.stringify({ done: true, generatedAt: "2026-10-22T00:00:00.000Z" })}\n\n`,
      "data: [DONE]\n\n",
    ].join(""), { headers: { "Content-Type": "text/event-stream" } });
    let displayed = "";

    const result = await readAiTextStream(
      response,
      (delta) => { displayed += delta; },
      (replacement) => { displayed = replacement; },
    );

    expect(displayed).toBe("校验后的建议");
    expect(result?.generatedAt).toBe("2026-10-22T00:00:00.000Z");
  });
});
