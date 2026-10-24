export function normalizeNoteMarkdown(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/^```(?:markdown|md)?\s*\n/i, "")
    .replace(/\n```\s*$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*•\s+/, "- ").replace(/^(\s*\d+)）\s*/, "$1. ").replace(/[\t ]+$/g, ""))
    .join("\n")
    .trim();
}

export function applyAiNoteContent(action: "polish" | "suggest" | "summarize" | "title" | "todos" | "structure" | "tags" | "retrospective", current: string, result: string) {
  const markdown = normalizeNoteMarkdown(result);
  if (!markdown) return current;
  if (action === "polish" || action === "structure") return markdown;
  if (action === "title" || action === "tags") return current;
  const heading = action === "summarize" ? "摘要" : action === "todos" ? "待办事项" : action === "retrospective" ? "运营复盘" : "AI 建议";
  const section = new RegExp(`^#{1,3}\\s+${heading}\\b`, "m").test(markdown) ? markdown : `## ${heading}\n\n${markdown}`;
  return `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${section}`.trim();
}

export function privateAttachmentMarkdown(filename: string, path: string, image: boolean) {
  const label = filename.replace(/[\[\]]/g, "").trim() || "附件";
  const target = `moonclean-attachment://${path}`;
  return image ? `![${label}](${target})` : `[📎 ${label}](${target})`;
}

export function parsePrivateAttachmentMarkdown(value: string) {
  const match = value.match(/^!?\[([^\]]*)\]\(moonclean-attachment:\/\/(.+)\)$/);
  if (!match) return null;
  return { label: match[1], path: match[2], image: value.startsWith("![") };
}
