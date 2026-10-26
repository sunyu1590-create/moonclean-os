"use client";

import { cn } from "cn";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
};

export function Switch({ checked, onCheckedChange, label, disabled = false, className }: SwitchProps) {
  return <button
    type="button"
    role="switch"
    aria-label={label}
    aria-checked={checked}
    disabled={disabled}
    data-state={checked ? "checked" : "unchecked"}
    className={cn("mc-switch", className)}
    onClick={() => onCheckedChange(!checked)}
  ><span className="mc-switch-thumb" aria-hidden="true"/></button>;
}
