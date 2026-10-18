"use client";

import { Children, isValidElement, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  const rootValue = selectedValue === "" ? null : selectedValue;

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
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="start" className="rounded-xl border border-[#dce8f4] bg-white p-1.5 shadow-[0_12px_32px_rgba(31,57,82,0.16)]">
        {options.map((option, index) => {
          const optionValue = option.props.value ?? "";
          return (
            <SelectItem
              key={`${optionValue}-${index}`}
              value={optionValue === "" ? EMPTY_VALUE : optionValue}
              disabled={option.props.disabled}
              className="min-h-10 cursor-pointer rounded-lg px-3 text-sm text-[#31475d] focus:bg-[#eaf4ff] focus:text-[#287fe2]"
            >
              {option.props.children}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
