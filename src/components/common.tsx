"use client";
import { Button } from "@/components/ui/button";
import { Download, Info } from "lucide-react";
import { formatMoney } from "@/lib/finance";
import type { Money } from "@/lib/model";
export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[.2em] text-[#3b91eb]">
          {eyebrow}
        </p>
        <h1 className="page-title">{title}</h1>
        <p className="mt-2 text-sm text-[#8396a9]">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function MetricCard({
  label,
  value,
  sub,
  tone = "blue",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "blue" | "green" | "red" | "neutral";
  icon?: React.ReactNode;
}) {
  const colors = {
    blue: "bg-[#e9f5ff] text-[#3b91eb]",
    green: "bg-[#e8f7f2] text-[#16a085]",
    red: "bg-[#ffedf0] text-[#e85d65]",
    neutral: "bg-[#eef4fa] text-[#6a849d]",
  };
  return (
    <div className="glass-card p-5 md:p-6">
      <div className="mb-5 flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-[#7a8ea3]">{label}</span>
        {icon && (
          <span
            className={`grid size-9 place-items-center rounded-xl ${colors[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="number text-[26px] font-bold tracking-tight text-[#172b45] md:text-[30px]">
        {value}
      </div>
      <p className="mt-2 min-h-4 text-xs text-[#9aacbc]">
        {sub || "基于当前筛选周期"}
      </p>
    </div>
  );
}
export function SectionCard({
  title,
  sub,
  children,
  action,
  className = "",
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass-card p-5 md:p-6 ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{title}</h2>
          {sub && <p className="mt-1 text-xs text-[#94a6b7]">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function DemoNote({ hasDemo = true }: { hasDemo?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#8fa3b6]">
      <Info size={14} />
      {hasDemo ? "当前包含模拟数据；平台模拟订单需在连接中心管理" : "当前无模拟经营数据"}
    </div>
  );
}
export function MoneyText({ value }: { value: Money | number }) {
  return <span className="number">{formatMoney(value)}</span>;
}
export function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export function ExportButton({
  onClick,
  label = "导出数据",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button variant="outline" onClick={onClick}>
      <Download size={16} />
      {label}
    </Button>
  );
}
