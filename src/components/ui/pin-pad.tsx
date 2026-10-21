"use client";

import { Delete } from "lucide-react";

export function PinPad({ value, onChange, disabled = false, label = "四位数字密码" }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const press = (digit: string) => {
    if (!disabled && value.length < 4) onChange(value + digit);
  };
  return <div aria-label={label} className="space-y-3">
    <div aria-live="polite" aria-label={`已输入 ${value.length} 位`} className="flex h-11 items-center justify-center gap-3 rounded-xl border border-border bg-[var(--mc-tint-blue)]" role="status">
      {[0, 1, 2, 3].map((index) => <span key={index} className={`size-2.5 rounded-full transition-colors ${value.length > index ? "bg-primary" : "border border-muted-foreground/40"}`} />)}
    </div>
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((key) => <button key={key} type="button" disabled={disabled || (key === "clear" && !value) || (key === "back" && !value)} aria-label={key === "clear" ? "清除密码" : key === "back" ? "删除一位密码" : `数字 ${key}`} onClick={() => key === "clear" ? onChange("") : key === "back" ? onChange(value.slice(0, -1)) : press(key)} className="grid h-11 place-items-center rounded-xl border border-border bg-card text-base font-medium text-foreground transition hover:bg-[var(--mc-tint-blue)] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">{key === "clear" ? "清除" : key === "back" ? <Delete size={17}/> : key}</button>)}
    </div>
  </div>;
}
