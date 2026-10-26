"use client";

import { Children, isValidElement, useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import Image from "next/image";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { normalizeMathDelimiters } from "@/lib/markdown-rendering";

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textContent(node.props.children);
  return "";
}

function CopyCodeButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="markdown-code-copy" aria-label={copied ? "代码已复制" : "复制代码"} onClick={() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }).catch(() => setCopied(false));
  }}>{copied ? <Check size={13}/> : <Copy size={13}/>}<span>{copied ? "已复制" : "复制"}</span></button>;
}

function MermaidDiagram({ chart }: { chart: string }) {
  const generatedId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", suppressErrorRendering: true });
      const result = await mermaid.render(`moonclean-mermaid-${generatedId}`, chart);
      if (!cancelled) setSvg(result.svg);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [chart, generatedId]);

  if (error) return <pre className="markdown-code-fallback"><code>{chart}</code></pre>;
  return <div className="markdown-mermaid" role="img" aria-label="Markdown 图表">{svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="text-xs text-muted-foreground">正在绘制图表…</span>}</div>;
}

function codeClassName(node: ReactNode) {
  if (!isValidElement<{ className?: string }>(node)) return "";
  return node.props.className || "";
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-2 text-lg font-semibold leading-snug">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1.5 text-base font-semibold leading-snug">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold leading-snug">{children}</h3>,
  p: ({ children }) => <p className="my-2 break-words">{children}</p>,
  a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">{children}</a>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-primary">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:font-medium marker:text-primary">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">{children}</blockquote>,
  hr: () => <hr className="my-4 border-border"/>,
  table: ({ children }) => <div className="my-3 max-w-full overflow-x-auto rounded-xl border border-border"><table className="min-w-full border-collapse text-left text-xs">{children}</table></div>,
  th: ({ children }) => <th className="border-b border-border bg-muted/70 px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border/70 px-3 py-2 align-top">{children}</td>,
  img: ({ src, alt }) => <Image src={typeof src === "string" ? src : ""} alt={alt || "Markdown 图片"} width={1200} height={800} unoptimized className="my-3 h-auto max-h-[32rem] max-w-full rounded-xl border border-border object-contain"/>,
  code: ({ children, className }) => {
    if (className?.includes("language-mermaid")) return <MermaidDiagram chart={textContent(children)}/>;
    return <code className={className}>{children}</code>;
  },
  pre: ({ children }) => {
    const codeNode = Children.toArray(children).find((child) => isValidElement(child));
    const className = codeClassName(codeNode);
    if (className.includes("language-mermaid") && isValidElement<{ children?: ReactNode }>(codeNode)) {
      return <MermaidDiagram chart={textContent(codeNode.props.children)}/>;
    }
    const source = isValidElement<{ children?: ReactNode }>(codeNode) ? textContent(codeNode.props.children) : textContent(children);
    return <div className="markdown-code-block"><div className="markdown-code-toolbar"><span>{className.match(/language-([\w-]+)/)?.[1] || "代码"}</span><CopyCodeButton value={source}/></div><pre><code className={className}>{isValidElement<{ children?: ReactNode }>(codeNode) ? codeNode.props.children : children}</code></pre></div>;
  },
};

export function MarkdownContent({ content, className = "", style }: { content: string; className?: string; style?: CSSProperties }) {
  return <div className={`markdown-content min-w-0 space-y-1 text-sm leading-7 ${className}`} style={style}>
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]} components={markdownComponents}>
      {normalizeMathDelimiters(content)}
    </ReactMarkdown>
  </div>;
}
