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

  it("英文模式下用英文指引回答并描述联网资料安全边界", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => { void init; return String(url).endsWith("/v1/tools/search")
      ? Response.json({ results: [{ title: "Release notes", url: "https://example.com/release", summary: "New features" }] })
      : new Response('data: {"choices":[{"delta":{"content":"Here is the summary."}}]}\n\ndata: [DONE]\n\n', { headers: { "Content-Type": "text/event-stream" } }); });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(makeRequest({
      apiKey: "sk-test-secret-key-value", model: "deepseek-flash", reasoningEffort: "high", language: "en-US", webSearch: true,
      messages: [{ role: "user", content: "What changed recently?" }],
    }), { params: Promise.resolve({ storeId }) });
    expect(response.status).toBe(200);
    const body = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as { messages: { content: string }[] };
    expect(body.messages[0]?.content).toContain("Reply in clear, natural English");
    expect(body.messages[1]?.content).toContain("untrusted references");
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

  it("启用联网搜索时检索来源、注入安全上下文并把来源返回给界面", async () => {
    state.logs.length = 0;
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      void init;
      if (String(url).endsWith("/v1/tools/search")) {
        return Response.json({ results: [{ title: "官方更新", url: "https://example.com/news", summary: "本周发布了新版本" }] });
      }
      return new Response('data: {"choices":[{"delta":{"content":"根据最新来源"}}]}\n\ndata: [DONE]\n\n', { headers: { "Content-Type": "text/event-stream" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(makeRequest({
      apiKey: "sk-test-secret-key-value",
      model: "deepseek-flash",
      reasoningEffort: "high",
      webSearch: true,
      messages: [{ role: "user", content: "最近有什么更新？" }],
    }), { params: Promise.resolve({ storeId }) });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.deepseek.com/v1/tools/search");
    const chatBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as { messages: { role: string; content: string }[] };
    expect(chatBody.messages[1]?.content).toContain("不可信资料");
    expect(chatBody.messages[1]?.content).toContain("https://example.com/news");
    expect(JSON.parse(decodeURIComponent(response.headers.get("X-Web-Search-Sources") || "[]"))).toEqual([{ title: "官方更新", url: "https://example.com/news" }]);
    expect(await response.text()).toContain("根据最新来源");
  });

  it("联网搜索失败时明确报错，不退化成普通模型回答", async () => {
    state.logs.length = 0;
    const fetchMock = vi.fn(async () => Response.json({ error: "insufficient balance" }, { status: 402 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(makeRequest({
      apiKey: "sk-test-secret-key-value",
      model: "deepseek-flash",
      reasoningEffort: "high",
      webSearch: true,
      messages: [{ role: "user", content: "今天有什么新闻？" }],
    }), { params: Promise.resolve({ storeId }) });

    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("额度不足");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.logs[0]).toMatchObject({ outcome: "failed", error_code: "search_insufficient_balance" });
  });
});
