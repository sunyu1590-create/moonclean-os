export type AiStreamEvent = { delta?: string; replace?: string; done?: boolean; error?: string } & Record<string, unknown>;

export async function readAiTextStream(response: Response, onDelta: (text: string) => void, onReplace?: (text: string) => void): Promise<AiStreamEvent | undefined> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(error.error || "AI 请求失败，请稍后重试。");
  }
  if (!response.body) throw new Error("浏览器无法读取 AI 流式回复。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: AiStreamEvent | undefined;
  let done = false;
  try {
    while (!done) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      for (const eventText of events) {
        for (const line of eventText.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") { done = true; break; }
          try {
            const event = JSON.parse(raw) as AiStreamEvent;
            if (event.error) throw new Error(event.error);
            if (typeof event.delta === "string") onDelta(event.delta);
            if (typeof event.replace === "string") onReplace?.(event.replace);
            if (event.done) final = event;
          } catch (cause) {
            if (cause instanceof SyntaxError) continue;
            throw cause;
          }
        }
      }
      if (chunk.done) done = true;
    }
    return final;
  } finally { reader.releaseLock(); }
}
