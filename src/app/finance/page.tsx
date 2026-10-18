"use client";
import { useState } from "react";
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
import { BadgePercent, CircleDollarSign, Receipt, Wallet } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { financialSummary, formatMoney } from "@/lib/finance";
import { numeric, periodRows, storeToday, trend } from "@/lib/analytics";
export default function Finance() {
  const { data } = useApp();
  const [days, setDays] = useState<7 | 30>(30);
  if (!data) return <p>正在加载数据…</p>;
  const daily = periodRows(
      data.daily,
      days,
      storeToday(data.settings.store.timezone),
    ),
    ads = periodRows(
      data.advertising,
      days,
      storeToday(data.settings.store.timezone),
    ),
    s = financialSummary(daily, ads);
  const cost = [
    { name: "商品成本", value: Number(s.productCost), color: "#3b91eb" },
    { name: "包装费用", value: Number(s.packagingCost), color: "#89c5f6" },
    { name: "物流费用", value: Number(s.logisticsCost), color: "#16a085" },
    { name: "平台费用", value: Number(s.platformFees), color: "#a8a2f2" },
    { name: "广告费用", value: Number(s.adSpend), color: "#f0b671" },
    { name: "其他经营费用", value: Number(s.otherExpenses), color: "#e68693" },
  ];
  const detail = [
    ["销售额", s.grossSales],
    ["退款调整", `-${s.refunds}`],
    ["净销售额", s.netSales],
    ["商品成本", `-${s.productCost}`],
    ["包装费用", `-${s.packagingCost}`],
    ["物流费用", `-${s.logisticsCost}`],
    ["平台费用", `-${s.platformFees}`],
    ["广告费用", `-${s.adSpend}`],
    ["其他经营费用", `-${s.otherExpenses}`],
    ["估算经营利润", s.profit],
  ];
  return (
    <>
      <PageHead
        eyebrow="FINANCE / 财务利润"
        title="看见收入，也看清留下的利润"
        description="所有经营费用汇总至统一的财务计算模块。"
        action={
          <div className="flex gap-2">
            {([7, 30] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={days === v ? "default" : "outline"}
                onClick={() => setDays(v)}
              >
                近 {v} 天
              </Button>
            ))}
          </div>
        }
      />
      {daily.some(row => row.source === "mock_pinduoduo") && <div role="status" className="mb-5 rounded-2xl border border-[#cfe5f8] bg-[#e8f5ff] p-4 text-sm text-[#476d91]">所选日期包含拼多多模拟同步订单。演示销售额和利润不代表真实店铺业绩。</div>}
      {daily.some(row => row.costComplete === false) && <div role="status" className="mb-5 rounded-2xl border border-[#f3dfc8] bg-[#fff9f1] p-4 text-sm text-[#a77743]">部分日期缺少可靠成本版本，以下利润为不完整估算；盈亏平衡 ROAS 暂不显示。</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="净销售额"
          value={formatMoney(s.netSales)}
          sub={`销售 ${formatMoney(s.grossSales)} − 退款 ${formatMoney(s.refunds)}`}
          icon={<CircleDollarSign size={18} />}
        />
        <MetricCard
          label="总经营成本"
          value={formatMoney(s.totalCost)}
          icon={<Receipt size={18} />}
        />
        <MetricCard
          label="估算经营利润"
          value={formatMoney(s.profit)}
          tone={Number(s.profit) < 0 ? "red" : "green"}
          icon={<Wallet size={18} />}
        />
        <MetricCard
          label="经营利润率"
          value={numeric(s.margin, "%")}
          tone={s.margin !== null && s.margin < 0 ? "red" : "green"}
          icon={<BadgePercent size={18} />}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <SectionCard title="历史利润趋势" sub="每日净销售额与估算经营利润">
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend(daily, ads)}
                margin={{ left: -12, right: 8 }}
              >
                <CartesianGrid vertical={false} stroke="#edf3f9" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9aabba" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#9aabba" }}
                />
                <Tooltip formatter={(v) => formatMoney(Number(v))} />
                <Area
                  isAnimationActive={false}
                  dataKey="sales"
                  name="净销售额"
                  type="monotone"
                  stroke="#3b91eb"
                  strokeWidth={2.5}
                  fill="#3b91eb"
                  fillOpacity={0.09}
                />
                <Area
                  isAnimationActive={false}
                  dataKey="profit"
                  name="估算利润"
                  type="monotone"
                  stroke="#16a085"
                  strokeWidth={2.5}
                  fill="#16a085"
                  fillOpacity={0.08}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="成本结构" sub="不同经营成本在总成本中的占比">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-[240px] w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={cost}
                    dataKey="value"
                    innerRadius={65}
                    outerRadius={96}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {cost.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid w-full gap-3 sm:w-1/2">
              {cost.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2 text-[#738aa0]">
                    <i
                      className="size-2 rounded-full"
                      style={{ background: item.color }}
                    />
                    {item.name}
                  </span>
                  <strong className="number">
                    {s.totalCost === "0.00"
                      ? "0.0"
                      : ((item.value / Number(s.totalCost)) * 100).toFixed(1)}
                    %
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
      <SectionCard
        className="mt-5"
        title="利润核算明细"
        sub="估算经营利润 = 净销售额 − 商品、包装、物流、平台、广告及其他费用"
      >
        <div className="grid gap-x-8 md:grid-cols-2">
          {detail.map(([label, value], index) => (
            <div
              key={label}
              className={`flex justify-between border-b border-[#ecf1f6] py-3 text-sm ${index === 9 ? "font-bold text-[#16a085]" : ""}`}
            >
              <span>{label}</span>
              <span className="number">
                {value.startsWith("-")
                  ? "-" + formatMoney(value.slice(1))
                  : formatMoney(value)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-[#9aabba]">
          以上为基于录入数据的经营估算，未计入税费、资金结算时间差等未录入项目。
        </p>
      </SectionCard>
    </>
  );
}
