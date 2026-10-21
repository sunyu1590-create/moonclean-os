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

export function applyAiNoteContent(action: "polish" | "suggest", current: string, result: string) {
  const markdown = normalizeNoteMarkdown(result);
  if (!markdown) return current;
  if (action === "polish") return markdown;
  const section = /^#{1,3}\s+AI 建议\b/m.test(markdown) ? markdown : `## AI 建议\n\n${markdown}`;
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
