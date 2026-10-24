"use client";
import { Button } from "@/components/ui/button";
import { Download, Info } from "lucide-react";
import { formatMoney } from "@/lib/finance";
import type { Money } from "@/lib/model";
import { useLanguage } from "@/components/language-provider";
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
  const { t } = useLanguage();
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 md:mb-8 md:gap-5">
      <div>
        <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-[.15em] text-primary before:h-px before:w-5 before:bg-primary md:mb-3 md:text-xs">
          {t(eyebrow)}
        </p>
        <h1 className="page-title">{t(title)}</h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground md:mt-3">{t(description)}</p>
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
  const { t } = useLanguage();
  const colors = {
    blue: "bg-[var(--mc-tint-blue)] text-primary",
    green: "bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]",
    red: "bg-[var(--mc-tint-red)] text-[var(--mc-color-danger)]",
    neutral: "bg-[var(--mc-tint-blue)] text-muted-foreground",
  };
  return (
    <div className="glass-card min-w-0 p-4 md:p-6">
      <div className="mb-3 flex items-start justify-between gap-1.5 md:mb-6 md:gap-2">
        <span className="text-xs font-medium leading-5 text-muted-foreground md:text-[13px]">{t(label)}</span>
        {icon && (
          <span
            className={`grid size-8 place-items-center rounded-xl ${colors[tone]} md:size-10 md:rounded-[14px]`}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="number break-words text-[26px] font-semibold tracking-[-.045em] text-foreground sm:text-[29px] md:text-[34px]">
        {value}
      </div>
      <p className="mt-1 min-h-3 text-xs leading-5 text-muted-foreground md:mt-2 md:min-h-4">
        {t(sub || "基于当前筛选周期")}
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
  const { t } = useLanguage();
  return (
    <section className={`glass-card min-w-0 p-4 md:p-6 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2 border-b border-border pb-3 md:mb-5 md:gap-3 md:pb-4">
        <div>
          <h2 className="section-title">{t(title)}</h2>
          {sub && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{t(sub)}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function DemoNote({ hasDemo = true }: { hasDemo?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Info size={14} />
      {t(hasDemo ? "当前包含模拟数据；平台模拟订单需在连接中心管理" : "当前无模拟经营数据")}
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
  const { t } = useLanguage();
  return (
    <Button variant="outline" onClick={onClick}>
      <Download size={16} />
      {t(label)}
    </Button>
  );
}
