"use client";

import { useState } from "react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { GitBranch, Users } from "lucide-react";
import Link from "next/link";

const segments = [
  { id: 1, name: "High-Value Leads", description: "Lead score > 80", count: 2, updated: "Today", accent: "yellow" as const },
  { id: 2, name: "Enterprise Prospects", description: "Company size > 500", count: 1, updated: "Yesterday", accent: "cyan" as const },
  { id: 3, name: "Re-engagement", description: "No activity in 30 days", count: 1, updated: "3d ago", accent: "pink" as const },
  { id: 4, name: "New Signups", description: "Created in last 7 days", count: 1, updated: "Today", accent: "lime" as const },
];

export default function SegmentsPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-sm font-bold uppercase tracking-wider text-black/50">
            <Link href="/contacts" className="hover:underline">Contacts</Link> / Segments
          </div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Segments</h1>
          <p className="mt-1 font-medium text-black/70">Create and manage dynamic contact segments</p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsOpen(true)}>+ New Segment</NeoButton>
      </div>

      <NeoModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create Segment">
        <div className="flex flex-col gap-4">
          <NeoInput label="Segment Name" placeholder="e.g. High-Value Leads" />
          <NeoInput label="Filter Condition" placeholder="e.g. Lead Score > 80" />
          <NeoInput label="Description" placeholder="Brief description" />
          <NeoButton variant="primary" className="mt-2" onClick={() => setIsOpen(false)}>Create Segment</NeoButton>
        </div>
      </NeoModal>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {segments.map((seg) => (
          <NeoCard key={seg.id} title={seg.name} accent={seg.accent}>
            <GitBranch className="mb-3 h-7 w-7" />
            <p className="font-medium text-black/70">{seg.description}</p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <Users className="h-4 w-4" /> {seg.count} contacts
              </div>
              <span className="text-xs text-black/50">Updated {seg.updated}</span>
            </div>
          </NeoCard>
        ))}
      </div>
    </div>
  );
}
