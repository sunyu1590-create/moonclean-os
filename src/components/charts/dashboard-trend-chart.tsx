"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/finance";
import { useMotionPreferences } from "@/components/motion-preferences";

type TrendPoint = {
  date: string;
  sales: number;
  profit: number;
  spend: number;
  roas: number | null;
};

export default function DashboardTrendChart({ data }: { data: TrendPoint[] }) {
  const { level, reducedMotion } = useMotionPreferences();
  const animate = level !== "simple" && !reducedMotion;
  const duration = level === "refined" ? 680 : 280;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -13, bottom: 0 }}>
        <defs>
          <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        <Tooltip
          formatter={(value, name) => [formatMoney(Number(value)), name === "sales" ? "净销售额" : "估算利润"]}
          contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", backgroundColor: "var(--popover)", color: "var(--popover-foreground)", boxShadow: "var(--mc-shadow-card)" }}
        />
        <Area isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" type="monotone" dataKey="sales" stroke="var(--chart-1)" strokeWidth={3} fill="url(#sales-fill)" />
        <Area isAnimationActive={animate} animationDuration={duration} animationEasing="ease-out" type="monotone" dataKey="profit" stroke="var(--chart-2)" strokeWidth={2.5} fill="transparent" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
