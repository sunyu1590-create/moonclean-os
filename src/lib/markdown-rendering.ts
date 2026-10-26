export function normalizeMathDelimiters(source: string) {
  const fenced: string[] = [];
  const protectedSource = source.replace(/(^|\n)(```[^\n]*\n[\s\S]*?\n```|~~~[^\n]*\n[\s\S]*?\n~~~)/g, (_match, prefix: string, block: string) => {
    const marker = `MOONCLEAN_CODE_BLOCK_${fenced.length}_END`;
    fenced.push(block);
    return `${prefix}${marker}`;
  });
  return protectedSource
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expression: string) => `\n$$\n${expression.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, expression: string) => `$${expression.trim()}$`)
    .replace(/MOONCLEAN_CODE_BLOCK_(\d+)_END/g, (_, index: string) => fenced[Number(index)] || "");
}
