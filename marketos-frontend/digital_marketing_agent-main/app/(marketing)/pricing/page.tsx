"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoToggle } from "@/components/ui/NeoToggle";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { pricingPlans, comparisonCategories } from "@/lib/marketing";

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="flex flex-col gap-20">
      <section className="mx-auto max-w-5xl px-4 pt-12 text-center">
        <h1 className="font-display text-4xl font-black uppercase leading-tight tracking-tight md:text-6xl">
          The AI built for better marketing results
        </h1>
        <p className="mx-auto mt-4 max-w-2xl font-medium text-black/70">
          MarketOS plans are designed to meet your needs as you grow.
        </p>
        <div className="mt-6 inline-flex items-center gap-3 border-[3px] border-black bg-neo-surface px-4 py-2 shadow-[4px_4px_0_0_#000]">
          <span
            className={cn(
              "font-mono text-xs font-bold uppercase",
              !yearly && "text-neo-pink",
            )}
          >
            Monthly
          </span>
          <NeoToggle checked={yearly} onCheckedChange={setYearly} />
          <span
            className={cn(
              "font-mono text-xs font-bold uppercase",
              yearly && "text-neo-pink",
            )}
          >
            Yearly
          </span>
          <NeoBadge tone="success">Save 20%</NeoBadge>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4">
        <div className="grid gap-4 md:grid-cols-2">
          {pricingPlans.map((plan) => (
            <NeoCard
              key={plan.name}
              title={plan.name}
              accent={plan.highlight ? "pink" : "yellow"}
            >
              <div className="flex flex-col gap-4">
                <div>
                  <div className="font-display text-4xl font-black">
                    {plan.price === "Custom"
                      ? "Custom"
                      : yearly
                        ? `$${Math.round(Number(plan.price.replace("$", "")) * 0.8)}`
                        : plan.price}
                  </div>
                  <span className="font-mono text-xs uppercase text-black/60">
                    {plan.cadence}
                  </span>
                </div>
                {plan.highlight ? (
                  <NeoBadge tone="info">Most popular</NeoBadge>
                ) : null}
                <ul className="flex flex-col gap-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 font-medium">
                      <Check size={16} /> {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}>
                  <NeoButton
                    variant={plan.highlight ? "secondary" : "primary"}
                    fullWidth
                  >
                    {plan.cta}
                  </NeoButton>
                </Link>
              </div>
            </NeoCard>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4">
        <SectionHeading eyebrow="Compare" title="What is included" />
        <div className="mt-8 border-[3px] border-black bg-neo-surface shadow-[6px_6px_0_0_#000]">
          {comparisonCategories.map((cat, i) => (
            <div
              key={cat}
              className={cn(
                "flex items-center justify-between px-4 py-3",
                i !== comparisonCategories.length - 1 &&
                  "border-b-[2px] border-black",
              )}
            >
              <span className="font-display font-black uppercase">{cat}</span>
              <span className="flex gap-6">
                <NeoBadge tone="neutral">Pro</NeoBadge>
                <NeoBadge tone="success">Business</NeoBadge>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-4">
        <CtaBanner title="Start creating with MarketOS today" />
      </section>
    </div>
  );
}
