import * as React from "react";
import { cn } from "@/lib/cn";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center"
          ? "items-center text-center"
          : "items-start text-left",
        className,
      )}
    >
      {eyebrow ? (
        <span className="inline-flex border-[2px] border-black bg-neo-yellow px-2 py-0.5 font-mono text-[10px] font-bold uppercase shadow-[2px_2px_0_0_#000]">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="max-w-3xl font-display text-3xl font-black uppercase tracking-tight md:text-5xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="max-w-2xl font-medium text-black/70">{subtitle}</p>
      ) : null}
    </div>
  );
}
