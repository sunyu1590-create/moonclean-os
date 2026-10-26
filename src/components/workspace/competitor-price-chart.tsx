"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function CompetitorPriceChart({
  history,
}: {
  history: Array<{ date: string; price: number }>;
}) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis width={45} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="price" name="售价（元）" stroke="#3b91eb" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
