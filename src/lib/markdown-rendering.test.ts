import { describe, expect, it } from "vitest";
import { normalizeMathDelimiters } from "./markdown-rendering";

describe("Markdown math delimiters", () => {
  it("normalizes LaTeX display and inline delimiters for the math renderer", () => {
    expect(normalizeMathDelimiters("面积 \\(a^2\\)\n\n\\[\n\\frac{1}{2}\n\\]"))
      .toBe("面积 $a^2$\n\n\n$$\n\\frac{1}{2}\n$$\n");
  });

  it("leaves math-like content inside fenced code blocks untouched", () => {
    const source = "```latex\n\\[x^2\\]\n```";
    expect(normalizeMathDelimiters(source)).toBe(source);
  });
});
