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
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-8 md:gap-5">
      <div>
        <p className="mb-1.5 flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-[#287fe2] before:h-px before:w-5 before:bg-[#287fe2] md:mb-3 md:text-[11px]">
          {eyebrow}
        </p>
        <h1 className="page-title">{title}</h1>
        <p className="mt-1.5 text-xs leading-5 text-[#68798b] md:mt-3 md:text-sm md:leading-6">{description}</p>
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
    blue: "bg-[#eaf2fd] text-[#287fe2]",
    green: "bg-[#e8f7f2] text-[#16a085]",
    red: "bg-[#ffedf0] text-[#e85d65]",
    neutral: "bg-[#f0f2f5] text-[#6a7887]",
  };
  return (
    <div className="glass-card min-w-0 rounded-[18px] p-3 md:rounded-[24px] md:p-6">
      <div className="mb-3 flex items-start justify-between gap-1.5 md:mb-6 md:gap-2">
        <span className="text-[11px] font-medium leading-4 text-[#677789] md:text-[13px]">{label}</span>
        {icon && (
          <span
            className={`grid size-8 place-items-center rounded-xl ${colors[tone]} md:size-10 md:rounded-[14px]`}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="number break-all text-[20px] font-bold tracking-[-.045em] text-[#202936] sm:text-[22px] md:text-[31px]">
        {value}
      </div>
      <p className="mt-1 min-h-3 text-[10px] leading-4 text-[#79899a] md:mt-2 md:min-h-4 md:text-xs">
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
    <section className={`glass-card min-w-0 rounded-[20px] p-4 md:rounded-[24px] md:p-6 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2 border-b border-[#eef1f4] pb-3 md:mb-5 md:gap-3 md:pb-4">
        <div>
          <h2 className="section-title">{title}</h2>
          {sub && <p className="mt-1.5 text-xs leading-5 text-[#758597]">{sub}</p>}
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
