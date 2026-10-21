const encoder = new TextEncoder();

export type DeepSeekUsage = { prompt_tokens?: number; completion_tokens?: number };
export type StreamCompletion = { content: string; usage?: DeepSeekUsage };

/** Converts DeepSeek SSE into a small, stable text-only event protocol.
 * reasoning_content is intentionally not forwarded; the UI streams the answer
 * and supplies a concise, user-facing progress summary instead of exposing
 * private chain-of-thought tokens.
 */
export function streamDeepSeekText(
  upstream: Response,
  onComplete?: (result: StreamCompletion) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>,
  onError?: (error: unknown) => Promise<void>,
) {
  let readerRef: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (value: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
      void (async () => {
        if (!upstream.body) { emit({ error: "AI 流式响应不可用，请重试。" }); controller.close(); return; }
        const reader = upstream.body.getReader();
        readerRef = reader;
        const decoder = new TextDecoder();
        let buffer = "";
        let content = "";
        let usage: DeepSeekUsage | undefined;
        let ended = false;
        try {
          while (!ended && !cancelled) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            if (done) buffer += "\n\n";
            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() || "";
            for (const eventText of events) {
              for (const line of eventText.split(/\r?\n/)) {
                if (!line.startsWith("data:")) continue;
                const data = line.slice(5).trim();
                if (data === "[DONE]") { ended = true; break; }
                try {
                  const event = JSON.parse(data) as { choices?: { delta?: { content?: unknown } }[]; usage?: DeepSeekUsage; error?: { message?: string } };
                  if (event.error?.message) throw new Error(event.error.message);
                  const delta = event.choices?.[0]?.delta?.content;
                  if (typeof delta === "string" && delta) { content += delta; emit({ delta }); }
                  if (event.usage) usage = event.usage;
                } catch (cause) {
                  if (cause instanceof SyntaxError) continue;
                  throw cause;
                }
              }
            }
            if (done) ended = true;
          }
          if (cancelled) return;
          if (!content.trim()) throw new Error("AI 未返回有效内容，请稍后重试。");
          const meta = await onComplete?.({ content: content.trim(), usage });
          emit({ done: true, ...meta });
        } catch (cause) {
          if (!cancelled) {
            try { await onError?.(cause); } catch { /* Preserve the readable stream error for the client. */ }
            emit({ error: cause instanceof Error ? cause.message : "AI 流式输出中断，请重试。" });
          }
        } finally {
          try { reader.releaseLock(); } catch { /* The response may already be cancelled. */ }
          if (!cancelled) { controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close(); }
        }
      })();
    },
    async cancel() {
      cancelled = true;
      try { await readerRef?.cancel(); } catch { /* The upstream may already be complete. */ }
      try { await onError?.(new Error("client_cancelled")); } catch { /* Cancellation should not surface as an unhandled stream error. */ }
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
