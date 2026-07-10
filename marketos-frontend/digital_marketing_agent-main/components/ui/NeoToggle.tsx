"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface NeoToggleProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function NeoToggle({
  checked,
  onCheckedChange,
  label,
  disabled,
  id,
}: NeoToggleProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onCheckedChange(!checked);
        }}
        className={cn(
          "relative inline-flex h-7 w-12 items-center border-[3px] border-black rounded-none shadow-[2px_2px_0_0_#000] transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          checked ? "bg-neo-green" : "bg-neo-surface",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 bg-black transition-transform",
            checked ? "translate-x-5" : "translate-x-1",
          )}
        />
      </button>
      {label ? (
        <span className="font-mono text-xs uppercase">{label}</span>
      ) : null}
    </span>
  );
}
