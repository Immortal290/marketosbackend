import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "info" | "danger";

export interface NeoBadgeProps {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}

const tones: Record<Tone, string> = {
  neutral: "bg-neo-surface text-black",
  success: "bg-neo-green text-black",
  warning: "bg-neo-yellow text-black",
  info: "bg-neo-cyan text-black",
  danger: "bg-neo-red text-white",
};

export function NeoBadge({
  children,
  tone = "neutral",
  className,
}: NeoBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border-neo border-neo-ink rounded-none px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-tight shadow-neo-sm",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
