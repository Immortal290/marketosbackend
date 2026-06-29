import * as React from "react";
import { cn } from "@/lib/cn";

type Accent = "yellow" | "pink" | "cyan" | "lime";

export interface NeoCardProps {
  title?: string;
  accent?: Accent;
  children: React.ReactNode;
  className?: string;
}

const accents: Record<Accent, string> = {
  yellow: "bg-neo-yellow",
  pink: "bg-neo-pink",
  cyan: "bg-neo-cyan",
  lime: "bg-neo-lime",
};

export function NeoCard({
  title,
  accent = "yellow",
  children,
  className,
}: NeoCardProps) {
  return (
    <div
      className={cn(
        "bg-neo-surface border-neo border-neo-ink rounded-none shadow-neo",
        className,
      )}
    >
      {title ? (
        <div
          className={cn(
            "border-b-neo border-neo-ink px-4 py-2 font-display font-black uppercase tracking-tight",
            accents[accent],
          )}
        >
          {title}
        </div>
      ) : null}
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}
