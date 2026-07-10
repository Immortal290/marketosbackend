"use client";

import { useState } from "react";
import type { ComplianceControl } from "@/lib/types";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoToggle } from "@/components/ui/NeoToggle";
import { NeoBadge } from "@/components/ui/NeoBadge";

const initialControls: ComplianceControl[] = [
  {
    id: "c1",
    label: "Data Retention Policy",
    description: "Auto-delete personal data after 24 months.",
    enabled: true,
    standard: "GDPR",
  },
  {
    id: "c2",
    label: "Right to Erasure",
    description: "Honor user deletion requests within 30 days.",
    enabled: true,
    standard: "GDPR",
  },
  {
    id: "c3",
    label: "Audit Logging",
    description: "Record all administrative actions immutably.",
    enabled: true,
    standard: "SOC2",
  },
  {
    id: "c4",
    label: "Do Not Sell",
    description: "Respect CCPA opt-out signals.",
    enabled: false,
    standard: "CCPA",
  },
  {
    id: "c5",
    label: "PHI Safeguards",
    description: "Encrypt protected health information at rest.",
    enabled: false,
    standard: "HIPAA",
  },
];

export default function ComplianceSettingsPage() {
  const [controls, setControls] =
    useState<ComplianceControl[]>(initialControls);

  const toggle = (id: string, next: boolean) =>
    setControls((list) =>
      list.map((c) => (c.id === id ? { ...c, enabled: next } : c)),
    );

  return (
    <NeoCard title="Compliance" accent="lime">
      <ul className="flex flex-col">
        {controls.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-4 border-b-[2px] border-black py-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black">{c.label}</span>
                <NeoBadge tone="info">{c.standard}</NeoBadge>
              </div>
              <p className="font-medium text-black/70">{c.description}</p>
            </div>
            <NeoToggle
              checked={c.enabled}
              onCheckedChange={(next) => toggle(c.id, next)}
            />
          </li>
        ))}
      </ul>
    </NeoCard>
  );
}
