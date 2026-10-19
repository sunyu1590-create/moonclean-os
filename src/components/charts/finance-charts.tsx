"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/finance";
import { useMotionPreferences } from "@/components/motion-preferences";

type TrendPoint = { date: string; sales: number; profit: number; spend: number; roas: number | null };
type CostPoint = { name: string; value: number; color: string };

export function FinanceTrendChart({ trend }: { trend: TrendPoint[] }) {
  const { level, reducedMotion } = useMotionPreferences();
  const animate = level !== "simple" && !reducedMotion;
  const duration = level === "refined" ? 680 : 280;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={trend} margin={{ left: -12, right: 8 }}>
        <CartesianGrid vertical={false} stroke="#edf3f9" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9aabba" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9aabba" }} />
        <Tooltip formatter={(value) => formatMoney(Number(value))} />
        <Area isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" dataKey="sales" name="净销售额" type="monotone" stroke="#3b91eb" strokeWidth={2.5} fill="#3b91eb" fillOpacity={0.09} />
        <Area isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" dataKey="profit" name="估算利润" type="monotone" stroke="#16a085" strokeWidth={2.5} fill="#16a085" fillOpacity={0.08} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FinanceCostChart({ costs }: { costs: CostPoint[] }) {
  const { level, reducedMotion } = useMotionPreferences();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie isAnimationActive={level !== "simple" && !reducedMotion} animationDuration={level === "refined" ? 680 : 280} data={costs} dataKey="value" innerRadius={65} outerRadius={96} paddingAngle={3} stroke="none">
          {costs.map((item) => <Cell key={item.name} fill={item.color} />)}
        </Pie>
        <Tooltip formatter={(value) => formatMoney(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}
