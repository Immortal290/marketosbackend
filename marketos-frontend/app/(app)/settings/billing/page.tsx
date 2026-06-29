"use client";

import { useState } from "react";
import type { BillingPlan } from "@/lib/types";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";

const plans: BillingPlan[] = [
  {
    id: "p1",
    name: "Starter",
    priceMonthly: 0,
    features: ["1 workspace", "3 agents", "Community support"],
    current: false,
  },
  {
    id: "p2",
    name: "Growth",
    priceMonthly: 99,
    features: [
      "5 workspaces",
      "All 17 agents",
      "Email support",
      "Daily optimization",
    ],
    current: true,
  },
  {
    id: "p3",
    name: "Scale",
    priceMonthly: 399,
    features: [
      "Unlimited workspaces",
      "All agents",
      "24/7 priority support",
      "Custom SLAs",
    ],
    current: false,
  },
];

const accents = ["yellow", "pink", "cyan"] as const;

export default function BillingSettingsPage() {
  const current = plans.find((p) => p.current);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    current ? current.id : plans[0].id,
  );

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl font-black uppercase tracking-tight">
        Billing
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan, i) => (
          <NeoCard
            key={plan.id}
            title={plan.name}
            accent={accents[i % accents.length]}
            className={
              selectedPlanId === plan.id
                ? "outline outline-[3px] outline-offset-2 outline-[#00E0FF]"
                : undefined
            }
          >
            <div className="flex flex-col gap-3">
              <div className="font-display text-3xl font-black">
                {plan.priceMonthly === 0 ? "Free" : `$${plan.priceMonthly}/mo`}
              </div>
              {plan.current ? (
                <NeoBadge tone="success">Current Plan</NeoBadge>
              ) : null}
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {plan.features.map((f) => (
                  <li key={f} className="font-medium">
                    {f}
                  </li>
                ))}
              </ul>
              <NeoButton
                variant={plan.current ? "ghost" : "primary"}
                disabled={plan.current}
                fullWidth
                onClick={() => setSelectedPlanId(plan.id)}
              >
                {plan.current ? "Current" : "Choose"}
              </NeoButton>
            </div>
          </NeoCard>
        ))}
      </div>

      <NeoCard title="Payment Method" accent="cyan">
        <div className="flex items-center justify-between">
          <span className="font-mono">VISA ending 4242</span>
          <NeoButton variant="secondary" size="sm">
            Update Card
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  );
}
