"use client";

import Link from "next/link";
import { ArrowRight, Bot, Lightbulb, Sparkles } from "lucide-react";
import type { AdvertisingMetric, DailyMetric } from "@/lib/model";
import { weeklyReportInsights } from "@/lib/report-insights";

export function DashboardIntelligence({ daily, advertising }: { daily: DailyMetric[]; advertising: AdvertisingMetric[] }) {
  const insights = weeklyReportInsights(daily, advertising).slice(0, 3);
  const coverage = daily.length;
  const accent = (tone: string) => tone === "red" ? "border-l-[#e85d65]" : tone === "amber" ? "border-l-[#e1a54e]" : tone === "green" ? "border-l-[#16a085]" : "border-l-[#3b91eb]";
  return (
    <section aria-labelledby="intelligence-title" className="mt-5 overflow-hidden rounded-[22px] border border-[#e3edf6] bg-white shadow-[0_8px_28px_rgba(35,74,108,0.055)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f7] px-5 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#eaf4ff] text-[#3488df]"><Bot size={19}/><Sparkles size={10} className="absolute -right-1 -top-1 text-[#d99c45]"/></span>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 id="intelligence-title" className="text-[15px] font-semibold tracking-tight text-[#20364b]">AI 智能经营建议</h2><span className="rounded-full bg-[#f0f6fc] px-2 py-0.5 text-[10px] font-medium text-[#6485a5]">近 7 天</span></div><p className="mt-0.5 text-xs text-[#8b9aaa]">根据已录入的日报与推广数据，自动整理可执行建议</p></div>
        </div>
        <Link href="/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-[#3189e8]">查看完整分析 <ArrowRight size={14}/></Link>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-5">
        {insights.map((item, index) => <article key={`${item.category}-${index}`} className={`flex min-h-[154px] flex-col rounded-[16px] border border-[#e9eef3] border-l-[3px] ${accent(item.tone)} bg-[#fbfdff] p-4`}>
          <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-[#7990a5]"><Lightbulb size={13} className="text-[#d99c45]"/>{item.category}</span><span className="text-[10px] tabular-nums text-[#a2afbb]">建议 {String(index + 1).padStart(2,"0")}</span></div>
          <h3 className="mt-2 text-sm font-semibold leading-5 text-[#2c4054]">{item.title}</h3>
          <p className="mt-1.5 text-xs leading-5 text-[#788a9c]">{item.detail}</p>
          <p className="mt-auto border-t border-[#edf1f5] pt-2.5 text-xs leading-5 text-[#526c83]"><span className="font-semibold text-[#3b6689]">建议行动：</span>{item.action}</p>
        </article>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf2f7] bg-[#fbfdff] px-5 py-3 text-[11px] text-[#8d9bab] md:px-6">
        <span>分析覆盖：近 7 天 {coverage}/7 天经营日报</span>
        <span>基于经营规则自动分析并随数据更新 · 请结合平台实际情况判断</span>
      </div>
    </section>
  );
}
