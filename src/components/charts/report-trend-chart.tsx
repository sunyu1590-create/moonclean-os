"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/finance";
import { useMotionPreferences } from "@/components/motion-preferences";

type ReportPoint = { date: string; 净销售额: number; 广告消耗: number; 估算利润: number };

export default function ReportTrendChart({ data }: { data: ReportPoint[] }) {
  const { level, reducedMotion } = useMotionPreferences();
  const animate = level !== "simple" && !reducedMotion;
  const duration = level === "refined" ? 680 : 280;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}>
        <CartesianGrid stroke="#edf1f5" strokeDasharray="4 4" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8b99a8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#9aa7b4" }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} contentStyle={{ borderRadius: 12, border: "1px solid #e7edf3", fontSize: 12 }} />
        <Line isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" type="monotone" dataKey="净销售额" stroke="#3b91eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        <Line isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" type="monotone" dataKey="广告消耗" stroke="#e7a84b" strokeWidth={2} dot={{ r: 2 }} />
        <Line isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" type="monotone" dataKey="估算利润" stroke="#16a085" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
