"use client";

import { useState } from "react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { UserCircle } from "lucide-react";
import Link from "next/link";

const personas = [
  {
    id: 1, name: "Growth-Focused CMO", role: "Chief Marketing Officer", company: "Mid-market SaaS",
    goals: "Scale pipeline 3x, prove marketing ROI", pain: "Fragmented tools, attribution blind spots",
    accent: "yellow" as const,
  },
  {
    id: 2, name: "Startup Founder", role: "CEO / Founder", company: "Early-stage startup",
    goals: "Launch first campaign, find product-market fit", pain: "Limited budget, wearing many hats",
    accent: "pink" as const,
  },
  {
    id: 3, name: "Enterprise Marketing Director", role: "Marketing Director", company: "Enterprise B2B",
    goals: "Coordinate global campaigns, compliance", pain: "Team silos, slow approval cycles",
    accent: "cyan" as const,
  },
];

export default function PersonasPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-sm font-bold uppercase tracking-wider text-black/50">
            <Link href="/contacts" className="hover:underline">Contacts</Link> / Personas
          </div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Buyer Personas</h1>
          <p className="mt-1 font-medium text-black/70">Define and manage your ideal customer profiles</p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsOpen(true)}>+ New Persona</NeoButton>
      </div>

      <NeoModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create Persona">
        <div className="flex flex-col gap-4">
          <NeoInput label="Persona Name" placeholder="e.g. Growth-Focused CMO" />
          <NeoInput label="Job Title / Role" placeholder="e.g. Chief Marketing Officer" />
          <NeoInput label="Company Type" placeholder="e.g. Mid-market SaaS" />
          <NeoInput label="Primary Goals" placeholder="e.g. Scale pipeline 3x" />
          <NeoInput label="Pain Points" placeholder="e.g. Fragmented tools" />
          <NeoButton variant="primary" className="mt-2" onClick={() => setIsOpen(false)}>Save Persona</NeoButton>
        </div>
      </NeoModal>

      <div className="grid gap-6 lg:grid-cols-3">
        {personas.map((p) => (
          <NeoCard key={p.id} title={p.name} accent={p.accent}>
            <UserCircle className="mb-3 h-10 w-10" />
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-black uppercase text-xs tracking-wider text-black/40">Role</p>
                <p className="font-bold">{p.role}</p>
              </div>
              <div>
                <p className="font-black uppercase text-xs tracking-wider text-black/40">Company</p>
                <p className="font-bold">{p.company}</p>
              </div>
              <div>
                <p className="font-black uppercase text-xs tracking-wider text-black/40">Goals</p>
                <p className="font-medium text-black/70">{p.goals}</p>
              </div>
              <div>
                <p className="font-black uppercase text-xs tracking-wider text-black/40">Pain Points</p>
                <p className="font-medium text-black/70">{p.pain}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <NeoButton variant="secondary" className="flex-1 text-xs">Edit</NeoButton>
              <NeoButton variant="secondary" className="flex-1 text-xs">Target</NeoButton>
            </div>
          </NeoCard>
        ))}
      </div>
    </div>
  );
}
