"use client";

import { useState } from "react";
import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { FileEdit, Clock, Sparkles } from "lucide-react";

const draftTypes = [
  {
    title: "Saved Drafts",
    href: "/campaigns/drafts/saved",
    description: "Manually saved campaign drafts",
    icon: FileEdit,
    count: 8,
    accent: "yellow" as const,
  },
  {
    title: "Scheduled Drafts",
    href: "/campaigns/drafts/scheduled",
    description: "Drafts scheduled for future publication",
    icon: Clock,
    count: 5,
    accent: "pink" as const,
  },
  {
    title: "AI Generated Drafts",
    href: "/campaigns/drafts/ai-generated",
    description: "Campaigns created by AI agents",
    icon: Sparkles,
    count: 12,
    accent: "cyan" as const,
  },
];

export default function CampaignDraftsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Campaign Drafts
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Manage saved, scheduled, and AI-generated campaign drafts
          </p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsModalOpen(true)}>New Draft</NeoButton>
      </div>

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New Draft"
      >
        <div className="flex flex-col gap-4">
          <NeoInput label="Draft Name" placeholder="e.g. Fall Promo Email" />
          <NeoInput label="Campaign Link" placeholder="Select Campaign" />
          <NeoButton variant="primary" className="mt-4" onClick={() => setIsModalOpen(false)}>
            Save Draft
          </NeoButton>
        </div>
      </NeoModal>

      <div className="grid gap-4 md:grid-cols-3">
        {draftTypes.map((draft) => {
          const Icon = draft.icon;
          return (
            <Link key={draft.href} href={draft.href}>
              <NeoCard title={draft.title} accent={draft.accent}>
                <Icon className="mb-3 h-8 w-8" />
                <p className="mb-3 font-medium text-black/70">{draft.description}</p>
                <p className="font-display text-2xl font-black">{draft.count}</p>
                <p className="font-mono text-xs text-black/60">Draft campaigns</p>
              </NeoCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
