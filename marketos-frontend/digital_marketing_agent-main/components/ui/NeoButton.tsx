"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

export interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 border-neo border-neo-ink font-display font-black uppercase tracking-tight rounded-none shadow-neo-sm transition-transform transition-shadow duration-75 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-neo active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-neo-yellow text-black",
  secondary: "bg-neo-cyan text-black",
  danger: "bg-neo-red text-white",
  ghost: "bg-neo-surface text-black",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function NeoButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...props
}: NeoButtonProps) {
  return (
    <button
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
