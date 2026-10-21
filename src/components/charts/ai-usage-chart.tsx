"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WorkspaceRow } from "@/lib/workspace";

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function AiUsageChart({ rows, days = 14 }: { rows: WorkspaceRow[]; days?: number }) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { key: localDateKey(date), label: `${date.getMonth() + 1}/${date.getDate()}`, success: 0, failed: 0 };
  });
  const byDate = new Map(dates.map((date) => [date.key, date]));
  for (const row of rows) {
    if (typeof row.created_at !== "string") continue;
    const date = new Date(row.created_at);
    if (Number.isNaN(date.getTime())) continue;
    const bucket = byDate.get(localDateKey(date));
    if (!bucket) continue;
    if (row.outcome === "success") bucket.success += 1;
    else if (row.outcome === "failed") bucket.failed += 1;
  }

  return <div className="h-52 w-full" aria-label={`最近 ${days} 天每日 AI 调用量`}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={dates} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval={days > 10 ? 1 : 0} />
        <YAxis allowDecimals={false} width={32} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }} labelStyle={{ color: "var(--foreground)", fontWeight: 600 }} />
        <Bar dataKey="success" name="成功" stackId="calls" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="failed" name="失败" stackId="calls" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
