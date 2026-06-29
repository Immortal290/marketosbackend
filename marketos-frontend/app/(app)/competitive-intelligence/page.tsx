"use client";

import { useState } from "react";
import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Target, Eye, DollarSign, TrendingUp, Lightbulb } from "lucide-react";

const intelligenceSections = [
  {
    title: "Competitors",
    href: "/competitive-intelligence/competitors",
    description: "Track and analyze competitor activities and strategies",
    icon: Target,
    accent: "yellow" as const,
  },
  {
    title: "Ad Monitoring",
    href: "/competitive-intelligence/ad-monitoring",
    description: "Monitor competitor advertising across channels",
    icon: Eye,
    accent: "pink" as const,
  },
  {
    title: "Pricing Changes",
    href: "/competitive-intelligence/pricing",
    description: "Track competitor pricing and positioning shifts",
    icon: DollarSign,
    accent: "cyan" as const,
  },
  {
    title: "SEO Comparison",
    href: "/competitive-intelligence/seo",
    description: "Compare search rankings and SEO performance",
    icon: TrendingUp,
    accent: "lime" as const,
  },
  {
    title: "Opportunity Feed",
    href: "/competitive-intelligence/opportunities",
    description: "AI-identified market opportunities and gaps",
    icon: Lightbulb,
    accent: "yellow" as const,
  },
];

export default function CompetitiveIntelligencePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Competitive Intelligence
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Monitor competitors and identify market opportunities
          </p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsModalOpen(true)}>Add Competitor</NeoButton>
      </div>

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Competitor"
      >
        <div className="flex flex-col gap-4">
          <NeoInput label="Competitor Name" placeholder="e.g. Acme Corp" />
          <NeoInput label="Website URL" placeholder="e.g. acmecorp.com" />
          <NeoInput label="Tracked Keywords" placeholder="e.g. marketing software, b2b tools" />
          <NeoButton variant="primary" className="mt-4" onClick={() => setIsModalOpen(false)}>
            Save Competitor
          </NeoButton>
        </div>
      </NeoModal>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {intelligenceSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <NeoCard title={section.title} accent={section.accent}>
                <Icon className="mb-3 h-8 w-8" />
                <p className="font-medium text-black/70">{section.description}</p>
              </NeoCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
