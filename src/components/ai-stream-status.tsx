"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, LoaderCircle } from "lucide-react";

export function AiStreamStatus({ active, hasText }: { active: boolean; hasText: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const tick = () => setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [active]);
  if (!active) return null;
  return <div role="status" aria-live="polite" className="flex items-center gap-2 text-[11px] text-primary">
    {hasText ? <BrainCircuit size={14}/> : <LoaderCircle size={14} className="animate-spin"/>}
    <span>{hasText ? "AI 正在继续组织回答" : seconds < 2 ? "正在连接并分析" : "AI 正在分析"}</span>
    <span className="tabular-nums text-muted-foreground">{seconds.toFixed(0)} 秒</span>
    <span className="text-muted-foreground">· 已生成内容实时显示</span>
  </div>;
}
