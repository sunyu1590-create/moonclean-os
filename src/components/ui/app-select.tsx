"use client";

import { Children, isValidElement, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type OptionProps = { value?: string; disabled?: boolean; children?: ReactNode };
type AppSelectProps = Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "id" | "disabled" | "className" | "title" | "aria-label"
> & {
  required?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (event: { target: { value: string } }) => void;
  children: ReactNode;
};

const EMPTY_VALUE = "__moonclean_empty_option__";

/** A site-rendered select menu with consistent touch and keyboard behavior. */
export function AppSelect({
  value,
  defaultValue,
  onChange,
  children,
  className,
  required,
  ...triggerProps
}: AppSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const selectedValue = value === undefined ? internalValue : value;
  const options = Children.toArray(children).filter(isValidElement<OptionProps>);
  const placeholder = options.find((option) => option.props.value === "")?.props.children;
  const selectedOption = options.find((option) => (option.props.value ?? "") === selectedValue);
  const displayedLabel = selectedValue === "" ? placeholder : selectedOption?.props.children;
  const rootValue = selectedValue === "" ? (placeholder ? EMPTY_VALUE : null) : selectedValue;

  return (
    <Select
      value={rootValue}
      onValueChange={(nextValue) => {
        const next = !nextValue || nextValue === EMPTY_VALUE ? "" : nextValue;
        if (value === undefined) setInternalValue(next);
        onChange?.({ target: { value: next } });
      }}
    >
      <SelectTrigger className={className} aria-required={required || undefined} {...triggerProps}>
        <span data-slot="select-value" className="min-w-0 flex-1 truncate text-left">{displayedLabel ?? "请选择"}</span>
      </SelectTrigger>
      <SelectContent align="start" className="rounded-xl border border-border bg-card p-1.5 shadow-[0_12px_32px_rgba(31,57,82,0.16)]">
        {options.map((option, index) => {
          const optionValue = option.props.value ?? "";
          return (
            <SelectItem
              key={`${optionValue}-${index}`}
              value={optionValue === "" ? EMPTY_VALUE : optionValue}
              disabled={option.props.disabled}
              className="min-h-10 cursor-pointer rounded-lg px-3 text-sm text-foreground focus:bg-[var(--mc-tint-blue)] focus:text-primary"
            >
              {option.props.children}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
