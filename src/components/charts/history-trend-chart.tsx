"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/finance";
import { useMotionPreferences } from "@/components/motion-preferences";

export type HistoryTrendPoint = { date: string; netSales: number | null; adSpend: number | null; profit: number | null };

export default function HistoryTrendChart({ data }: { data: HistoryTrendPoint[] }) {
  const { level, reducedMotion } = useMotionPreferences();
  const animate = level !== "simple" && !reducedMotion;
  const duration = level === "refined" ? 620 : 260;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={18} />
        <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value) => value === null || value === undefined ? "无记录" : formatMoney(Number(value))} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", backgroundColor: "var(--popover)", color: "var(--popover-foreground)", fontSize: 12 }} />
        <Line connectNulls={false} isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" type="monotone" dataKey="netSales" name="净销售额" stroke="var(--chart-1)" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
        <Line connectNulls={false} isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" type="monotone" dataKey="adSpend" name="推广消耗" stroke="var(--chart-4)" strokeWidth={1.8} dot={false} />
        <Line connectNulls={false} isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" type="monotone" dataKey="profit" name="估算利润" stroke="var(--chart-2)" strokeWidth={1.8} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
