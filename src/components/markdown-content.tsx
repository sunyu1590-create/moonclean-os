"use client";

import type { ReactNode } from "react";

function inline(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    : part);
}

export function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  return <div className={`space-y-2 text-sm leading-7 ${className}`}>
    {content.split("\n").map((line, index) => {
      const value = line.trim();
      if (!value) return <div key={index} className="h-1" />;
      if (/^#{1,3} /.test(value)) {
        const depth = value.match(/^#+/)?.[0].length || 1;
        const text = value.slice(depth + 1);
        const className = depth === 1 ? "text-base font-semibold" : depth === 2 ? "font-semibold" : "font-medium";
        return <p key={index} className={className}>{inline(text)}</p>;
      }
      if (/^[-*] /.test(value)) return <p key={index} className="pl-3 before:mr-2 before:text-primary before:content-['•']">{inline(value.slice(2))}</p>;
      const numbered = value.match(/^(\d+)[.)]\s+(.*)$/);
      if (numbered) return <p key={index} className="pl-1"><span className="mr-1.5 font-medium text-primary">{numbered[1]}.</span>{inline(numbered[2])}</p>;
      if (value.startsWith("> ")) return <blockquote key={index} className="border-l-2 border-border pl-3 text-muted-foreground">{inline(value.slice(2))}</blockquote>;
      return <p key={index}>{inline(value)}</p>;
    })}
  </div>;
}
