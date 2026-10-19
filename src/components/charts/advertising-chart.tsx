"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/finance";
import { useMotionPreferences } from "@/components/motion-preferences";

type AdPoint = { date: string; spend: number; attributedSales: number };

export default function AdvertisingChart({ data }: { data: AdPoint[] }) {
  const { level, reducedMotion } = useMotionPreferences();
  const animate = level !== "simple" && !reducedMotion;
  const duration = level === "refined" ? 680 : 280;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -15, right: 8 }}>
        <CartesianGrid vertical={false} stroke="#edf3f9" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9aabba" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9aabba" }} />
        <Tooltip formatter={(value) => formatMoney(Number(value))} />
        <Bar isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" dataKey="spend" name="广告消耗" fill="#9bcdf6" radius={[4, 4, 0, 0]} />
        <Bar isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" dataKey="attributedSales" name="归因成交额" fill="#3b91eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
