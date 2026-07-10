"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface NeoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function NeoInput({
  label,
  hint,
  id,
  name,
  className,
  ...props
}: NeoInputProps) {
  const inputId = id ?? (name ? `field-${name}` : undefined);
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className="font-mono text-xs font-bold uppercase tracking-tight"
      >
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        className={cn(
          "bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2",
          className,
        )}
        {...props}
      />
      {hint ? (
        <span className="font-mono text-[10px] text-black/60">{hint}</span>
      ) : null}
    </div>
  );
}
