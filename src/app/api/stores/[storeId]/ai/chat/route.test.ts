import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ logs: [] as Record<string, unknown>[], reject: false }));
const supabase = {
  from(table: string) {
    return {
      insert: async (row: Record<string, unknown>) => {
        if (table === "copilot_usage_logs") state.logs.push(row);
        return { error: null };
      },
    };
  },
};

vi.mock("@/lib/supabase/auth", () => ({
  rejectCrossOriginMutation: () => state.reject ? Response.json({ error: "origin rejected" }, { status: 403 }) : null,
  requireStore: async () => ({ ok: true, user: { id: "user-id" }, supabase }),
}));

import { POST } from "./route";

const storeId = "8cd47fc2-2a9d-49e4-90be-a59af1dc1889";
const makeRequest = (payload: Record<string, unknown>) => new Request(`https://moonclean-os.test/api/stores/${storeId}/ai/chat`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
});

describe("自由 AI 聊天 API", () => {
  it("按所选模型和推理强度流式转发，并只记录调用元数据", async () => {
    state.logs.length = 0;
    const upstreamBody = 'data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n';
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      void url; void init;
      return new Response(upstreamBody, { headers: { "Content-Type": "text/event-stream" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(makeRequest({
      apiKey: "sk-test-secret-key-value",
      model: "deepseek-v4-pro",
      reasoningEffort: "max",
      messages: [{ role: "user", content: "聊聊宇宙" }],
    }), { params: Promise.resolve({ storeId }) });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("你好");
    expect(fetchMock).toHaveBeenCalledWith("https://api.deepseek.com/chat/completions", expect.objectContaining({
      body: expect.stringContaining('"reasoning_effort":"max"'),
    }));
    const sentBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;
    expect(sentBody).toMatchObject({ model: "deepseek-v4-pro", stream: true });
    expect(sentBody).not.toHaveProperty("max_tokens");
    expect(JSON.stringify(state.logs)).not.toContain("sk-test-secret");
    expect(state.logs[0]).toMatchObject({ model: "deepseek-v4-pro", outcome: "success", prompt_tokens: null, completion_tokens: null });
  });

  it("拒绝服务商列表之外的模型 ID", async () => {
    const response = await POST(makeRequest({
      apiKey: "sk-test-secret-key-value",
      model: "unsupported-model",
      reasoningEffort: "high",
      messages: [{ role: "user", content: "你好" }],
    }), { params: Promise.resolve({ storeId }) });
    expect(response.status).toBe(400);
  });
});
