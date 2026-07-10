"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Play, Pause, Calendar, DollarSign, TrendingUp } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";

const campaigns = [
  {
    id: "camp-001",
    name: "Q1 Product Launch",
    status: "active",
    budget: "$15,000",
    spent: "$8,420",
    leads: 1247,
    conversions: 89,
    startDate: "Jan 15, 2026",
    endDate: "Mar 31, 2026",
    channels: ["LinkedIn", "Google Ads", "Email"],
    accent: "yellow" as const,
  },
  {
    id: "camp-002",
    name: "Brand Awareness Summer",
    status: "active",
    budget: "$25,000",
    spent: "$12,100",
    leads: 2891,
    conversions: 156,
    startDate: "May 1, 2026",
    endDate: "Aug 31, 2026",
    channels: ["Instagram", "Facebook", "TikTok"],
    accent: "pink" as const,
  },
  {
    id: "camp-003",
    name: "Webinar Series Promotion",
    status: "paused",
    budget: "$8,000",
    spent: "$3,240",
    leads: 487,
    conversions: 34,
    startDate: "Apr 1, 2026",
    endDate: "Jun 30, 2026",
    channels: ["Email", "LinkedIn"],
    accent: "cyan" as const,
  },
  {
    id: "camp-004",
    name: "Partner Co-Marketing",
    status: "scheduled",
    budget: "$20,000",
    spent: "$0",
    leads: 0,
    conversions: 0,
    startDate: "Jul 1, 2026",
    endDate: "Sep 30, 2026",
    channels: ["LinkedIn", "Twitter", "Email"],
    accent: "lime" as const,
  },
];

const statusConfig = {
  active: { label: "Active", tone: "success" as const, icon: Play },
  paused: { label: "Paused", tone: "warning" as const, icon: Pause },
  scheduled: { label: "Scheduled", tone: "info" as const, icon: Calendar },
};

export default function CampaignsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: apiCampaigns } = useSWR("/campaigns?workspaceId=00000000-0000-0000-0000-000000000000", fetcher);

  const displayCampaigns = apiCampaigns ? apiCampaigns.map((c: any, i: number) => ({
    id: c.id,
    name: c.name,
    status: c.status?.toLowerCase() || "active",
    budget: `$${(c.budget || 0).toLocaleString()}`,
    spent: `$${(c.spend || 0).toLocaleString()}`,
    leads: c.leads || 0,
    conversions: c.conversions || 0,
    startDate: new Date(c.createdAt || c.startDate || Date.now()).toLocaleDateString(),
    endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : "Ongoing",
    channels: c.channels || ["Email"],
    accent: ["yellow", "pink", "cyan", "lime"][i % 4] as any,
  })) : campaigns;

  return (
    <div className="theme-pastel flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight">
          Campaigns
        </h1>
        <NeoButton variant="primary" onClick={() => setIsModalOpen(true)}>Create Campaign</NeoButton>
      </div>

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Campaign"
      >
        <div className="flex flex-col gap-4">
          <NeoInput label="Campaign Name" placeholder="e.g. Q3 Product Launch" />
          <NeoInput label="Budget" placeholder="e.g. $10,000" type="number" />
          <div className="grid grid-cols-2 gap-4">
            <NeoInput label="Start Date" type="date" />
            <NeoInput label="End Date" type="date" />
          </div>
          <NeoInput label="Target Channels" placeholder="e.g. LinkedIn, Twitter" />
          <NeoButton variant="primary" className="mt-4" onClick={() => {
            setIsModalOpen(false);
            toast.success("Campaign Created!", {
              description: "Your new campaign has been saved.",
            });
          }}>
            Save Campaign
          </NeoButton>
        </div>
      </NeoModal>

      {/* Stats Overview */}
      <section className="grid gap-4 md:grid-cols-4">
        <NeoCard title="Total Campaigns" accent="yellow">
          <span className="font-display text-3xl font-black">
            {displayCampaigns.length}
          </span>
        </NeoCard>
        <NeoCard title="Active Now" accent="pink">
          <span className="font-display text-3xl font-black">
            {displayCampaigns.filter((c: any) => c.status === "active").length}
          </span>
        </NeoCard>
        <NeoCard title="Total Spend" accent="cyan">
          <span className="font-display text-3xl font-black">
            $
            {displayCampaigns
              .reduce(
                (sum: number, c: any) =>
                  sum + parseFloat(c.spent.replace("$", "").replace(/,/g, "")),
                0
              )
              .toLocaleString()}
          </span>
        </NeoCard>
        <NeoCard title="Total Leads" accent="lime">
          <span className="font-display text-3xl font-black">
            {displayCampaigns.reduce((sum: number, c: any) => sum + c.leads, 0).toLocaleString()}
          </span>
        </NeoCard>
      </section>

      {/* Campaign List */}
      <section className="flex flex-col gap-4">
        {displayCampaigns.map((campaign: any) => {
          const status = statusConfig[campaign.status as keyof typeof statusConfig];
          const StatusIcon = status.icon;

          return (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
              <NeoCard accent={campaign.accent}>
                <div className="flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="font-display text-xl font-black uppercase">
                          {campaign.name}
                        </h3>
                        <NeoBadge tone={status.tone}>
                          <StatusIcon className="mr-1 inline h-3 w-3" />
                          {status.label}
                        </NeoBadge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {campaign.channels.map((channel: string) => (
                          <span
                            key={channel}
                            className="border-neo border-neo-ink bg-neo-surface px-2 py-0.5 font-mono text-[10px] font-bold uppercase"
                          >
                            {channel}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 border-t-neo border-neo-ink pt-4 md:grid-cols-5">
                    <div>
                      <p className="font-mono text-[10px] uppercase text-black/60">
                        Budget
                      </p>
                      <p className="font-display text-lg font-black">
                        {campaign.budget}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase text-black/60">
                        Spent
                      </p>
                      <p className="font-display text-lg font-black">
                        {campaign.spent}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase text-black/60">
                        Leads
                      </p>
                      <p className="font-display text-lg font-black">
                        {campaign.leads.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase text-black/60">
                        Conversions
                      </p>
                      <p className="font-display text-lg font-black">
                        {campaign.conversions}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase text-black/60">
                        Timeline
                      </p>
                      <p className="font-mono text-xs font-bold">
                        {campaign.startDate} - {campaign.endDate}
                      </p>
                    </div>
                  </div>
                </div>
              </NeoCard>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
