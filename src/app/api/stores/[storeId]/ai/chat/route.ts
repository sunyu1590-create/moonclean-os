import { NextResponse } from "next/server";
import { z } from "zod";
import { rejectCrossOriginMutation, requireStore } from "@/lib/supabase/auth";

const inputSchema = z.object({
  apiKey: z.string().trim().min(20).max(512),
  model: z.enum(["deepseek-flash", "deepseek-v4-pro"]),
  reasoningEffort: z.enum(["none", "low", "high", "max"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
});

type Context = { params: Promise<{ storeId: string }> };

export async function POST(request: Request, { params }: Context) {
  const denied = rejectCrossOriginMutation(request);
  if (denied) return denied;
  const { storeId } = await params;
  if (!z.uuid().safeParse(storeId).success) return NextResponse.json({ error: "店铺 ID 无效" }, { status: 400 });
  const auth = await requireStore(storeId);
  if (!auth.ok) return auth.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "聊天内容无效" }, { status: 400 });

  const { apiKey, model, reasoningEffort, messages } = parsed.data;
  const startedAt = Date.now();
  const log = async (outcome: "success" | "failed", status: number, errorCode?: string) => {
    await auth.supabase.from("copilot_usage_logs").insert({
      store_id: storeId,
      user_id: auth.user.id,
      provider: "deepseek",
      model,
      outcome,
      http_status: status,
      prompt_tokens: null,
      completion_tokens: null,
      duration_ms: Math.max(0, Date.now() - startedAt),
      error_code: errorCode || null,
    });
  };

  try {
    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        reasoning_effort: reasoningEffort,
        stream: true,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!upstream.ok || !upstream.body) {
      await log("failed", upstream.status || 502, upstream.status === 401 || upstream.status === 403 ? "authentication_error" : upstream.status === 429 ? "provider_rate_limited" : "provider_error");
      const error = upstream.status === 401 || upstream.status === 403
        ? "DeepSeek API Key 无效或当前账号无权使用所选模型。"
        : upstream.status === 429 ? "DeepSeek 服务繁忙或额度不足，请稍后再试。" : "DeepSeek 暂时无法完成回复，请稍后重试。";
      return NextResponse.json({ error }, { status: 502 });
    }

    const reader = upstream.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            await log("success", 200);
            controller.close();
          } else controller.enqueue(value);
        } catch (error) {
          await log("failed", 502, "stream_interrupted");
          controller.error(error);
        }
      },
      async cancel() {
        await reader.cancel();
        await log("failed", 499, "client_cancelled");
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    await log("failed", 502, "provider_connection_error");
    return NextResponse.json({ error: "连接 DeepSeek 失败，请检查网络后重试。" }, { status: 502 });
  }
}
