import { describe, expect, it } from "vitest";
import {
  applyAiNoteContent,
  normalizeNoteMarkdown,
  parsePrivateAttachmentMarkdown,
  privateAttachmentMarkdown,
} from "./note-markdown";

describe("note markdown helpers", () => {
  it("normalizes AI output into the note editor's supported Markdown", () => {
    expect(normalizeNoteMarkdown("```markdown\r\n• 优先补齐成本\r\n1）复核数据  \r\n```"))
      .toBe("- 优先补齐成本\n1. 复核数据");
  });

  it("replaces polished content and appends suggestions as a Markdown section", () => {
    expect(applyAiNoteContent("polish", "旧内容", "## 复盘\n• 更新主图"))
      .toBe("## 复盘\n- 更新主图");
    expect(applyAiNoteContent("suggest", "## 今日复盘\n已核算成本。", "1）补充转化数据"))
      .toBe("## 今日复盘\n已核算成本。\n\n## AI 建议\n\n1. 补充转化数据");
  });

  it("round trips private image and document attachment syntax", () => {
    const image = privateAttachmentMarkdown("主图[新版].png", "store/notes/n1/image.png", true);
    const document = privateAttachmentMarkdown("复盘.pdf", "store/notes/n1/review.pdf", false);
    expect(parsePrivateAttachmentMarkdown(image)).toEqual({
      label: "主图新版.png", path: "store/notes/n1/image.png", image: true,
    });
    expect(parsePrivateAttachmentMarkdown(document)).toEqual({
      label: "📎 复盘.pdf", path: "store/notes/n1/review.pdf", image: false,
    });
    expect(parsePrivateAttachmentMarkdown("![remote](https://example.com/a.png)")).toBeNull();
  });
});
