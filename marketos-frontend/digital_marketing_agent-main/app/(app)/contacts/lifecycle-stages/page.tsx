"use client";

import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { GitBranch, ArrowRight, Users } from "lucide-react";
import Link from "next/link";

const stages = [
  { id: 1, name: "Prospect", description: "Aware of your brand, no engagement yet", color: "bg-purple-200", count: 1, next: "Lead" },
  { id: 2, name: "Lead", description: "Showed initial interest (e.g. content download)", color: "bg-pink-300", count: 1, next: "MQL" },
  { id: 3, name: "MQL", description: "Marketing Qualified Lead — meets scoring threshold", color: "bg-cyan-300", count: 1, next: "SQL" },
  { id: 4, name: "SQL", description: "Sales Qualified Lead — ready for outreach", color: "bg-yellow-300", count: 1, next: "Customer" },
  { id: 5, name: "Customer", description: "Converted — active paying customer", color: "bg-lime-300", count: 1, next: null },
];

export default function LifecycleStagesPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-sm font-bold uppercase tracking-wider text-black/50">
            <Link href="/contacts" className="hover:underline">Contacts</Link> / Lifecycle Stages
          </div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Lifecycle Stages</h1>
          <p className="mt-1 font-medium text-black/70">Set up and manage your contact lifecycle pipeline</p>
        </div>
        <NeoButton variant="secondary">Configure Stages</NeoButton>
      </div>

      {/* Pipeline Visual */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-2 shrink-0">
            <div className={`rounded-2xl border-2 border-black ${stage.color} p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-w-[160px]`}>
              <p className="font-black text-lg uppercase">{stage.name}</p>
              <div className="mt-2 flex items-center gap-1 text-sm font-bold">
                <Users className="h-4 w-4" /> {stage.count}
              </div>
            </div>
            {stage.next && <ArrowRight className="h-6 w-6 shrink-0 text-black/40" />}
          </div>
        ))}
      </div>

      {/* Stage Details */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage) => (
          <NeoCard key={stage.id} title={stage.name} accent="yellow">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-black ${stage.color}`}>
              <GitBranch className="h-5 w-5" />
            </div>
            <p className="font-medium text-black/70 text-sm">{stage.description}</p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <Users className="h-4 w-4" /> {stage.count} contacts
              </div>
              {stage.next && (
                <span className="text-xs text-black/40 flex items-center gap-1">
                  Next: {stage.next} <ArrowRight className="h-3 w-3" />
                </span>
              )}
            </div>
          </NeoCard>
        ))}
      </div>
    </div>
  );
}
