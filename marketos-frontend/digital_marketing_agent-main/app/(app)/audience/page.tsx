"use client";

import { useState } from "react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Users, MapPin, Briefcase, TrendingUp } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";

const audienceSegments = [
  {
    id: "aud-001",
    name: "Enterprise Decision Makers",
    size: "12,400",
    growth: "+8.2%",
    description: "C-level and VP-level marketing leaders at Fortune 1000 companies",
    topLocations: ["United States", "United Kingdom", "Canada"],
    industries: ["Technology", "Finance", "Healthcare"],
    engagement: "High",
    campaigns: 5,
    accent: "yellow" as const,
  },
  {
    id: "aud-002",
    name: "Mid-Market Growth Teams",
    size: "8,900",
    growth: "+12.4%",
    description: "Marketing managers and directors at mid-sized companies (100-1000 employees)",
    topLocations: ["United States", "Germany", "Australia"],
    industries: ["SaaS", "E-commerce", "Manufacturing"],
    engagement: "Medium",
    campaigns: 4,
    accent: "pink" as const,
  },
  {
    id: "aud-003",
    name: "Startup Innovators",
    size: "6,200",
    growth: "+18.7%",
    description: "Early-stage startup founders and growth leads looking to scale quickly",
    topLocations: ["United States", "United Kingdom", "India"],
    industries: ["SaaS", "AI/ML", "FinTech"],
    engagement: "Very High",
    campaigns: 3,
    accent: "cyan" as const,
  },
  {
    id: "aud-004",
    name: "Agency Partners",
    size: "4,800",
    growth: "+5.1%",
    description: "Marketing agencies managing multiple client accounts",
    topLocations: ["United States", "United Kingdom", "France"],
    industries: ["Agency", "Consulting", "Media"],
    engagement: "Medium",
    campaigns: 2,
    accent: "lime" as const,
  },
];

const engagementConfig = {
  "Very High": { tone: "success" as const, score: "95%" },
  High: { tone: "success" as const, score: "78%" },
  Medium: { tone: "info" as const, score: "54%" },
  Low: { tone: "warning" as const, score: "32%" },
};

export default function AudiencePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: apiSegments } = useSWR("/audience/segments?workspaceId=00000000-0000-0000-0000-000000000000", fetcher);

  const displaySegments = apiSegments ? apiSegments.map((s: any, i: number) => ({
    id: s.id,
    name: s.name,
    size: s.size?.toLocaleString() || "0",
    growth: "+5.0%",
    description: s.description || "",
    topLocations: ["United States", "United Kingdom"],
    industries: ["Technology"],
    engagement: "High",
    campaigns: 3,
    accent: ["yellow", "pink", "cyan", "lime"][i % 4] as any,
  })) : audienceSegments;

  const totalAudience = displaySegments.reduce(
    (sum: number, seg: any) => sum + parseFloat(seg.size.replace(/,/g, "")),
    0
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Audience Segments
          </h1>
          <p className="mt-1 font-mono text-xs text-black/60">
            {displaySegments.length} active segments • {totalAudience.toLocaleString()} total contacts
          </p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsModalOpen(true)}>Create Segment</NeoButton>
      </div>

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Segment"
      >
        <div className="flex flex-col gap-4">
          <NeoInput label="Segment Name" placeholder="e.g. High Intent Users" />
          <NeoInput label="Description" placeholder="e.g. Users who visited pricing page" />
          <NeoInput label="Primary Filters" placeholder="e.g. Location, Industry, Age" />
          <NeoButton variant="primary" className="mt-4" onClick={() => setIsModalOpen(false)}>
            Save Segment
          </NeoButton>
        </div>
      </NeoModal>

      {/* Overview Stats */}
      <section className="grid gap-4 md:grid-cols-4">
        <NeoCard title="Total Contacts" accent="yellow">
          <div className="flex items-end justify-between">
            <span className="font-display text-3xl font-black">
              {totalAudience.toLocaleString()}
            </span>
            <TrendingUp className="h-6 w-6 text-neo-green" />
          </div>
        </NeoCard>
        <NeoCard title="Active Segments" accent="pink">
          <span className="font-display text-3xl font-black">
            {displaySegments.length}
          </span>
        </NeoCard>
        <NeoCard title="Avg Growth" accent="cyan">
          <span className="font-display text-3xl font-black">+11.1%</span>
        </NeoCard>
        <NeoCard title="High Engagement" accent="lime">
          <span className="font-display text-3xl font-black">67%</span>
        </NeoCard>
      </section>

      {/* Audience Segments */}
      <section className="flex flex-col gap-4">
        {displaySegments.map((segment: any) => {
          const engagement = engagementConfig[segment.engagement as keyof typeof engagementConfig] || engagementConfig["Medium"];
          
          return (
            <NeoCard key={segment.id} accent={segment.accent}>
              <div className="flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="font-display text-xl font-black uppercase">
                        {segment.name}
                      </h3>
                      <NeoBadge tone={engagement.tone}>
                        {segment.engagement} Engagement
                      </NeoBadge>
                    </div>
                    <p className="font-medium text-black/70">
                      {segment.description}
                    </p>
                  </div>
                  <NeoButton variant="secondary" size="sm">
                    Edit
                  </NeoButton>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 border-t-[2px] border-black pt-4 md:grid-cols-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <p className="font-mono text-[10px] uppercase text-black/60">
                        Size
                      </p>
                    </div>
                    <p className="font-display text-lg font-black">
                      {segment.size}
                    </p>
                    <p className="font-mono text-xs font-bold text-neo-green">
                      {segment.growth}
                    </p>
                  </div>
                  
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <p className="font-mono text-[10px] uppercase text-black/60">
                        Top Locations
                      </p>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {segment.topLocations.slice(0, 2).map((loc: string) => (
                        <p key={loc} className="font-mono text-xs font-bold">
                          {loc}
                        </p>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      <p className="font-mono text-[10px] uppercase text-black/60">
                        Industries
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {segment.industries.map((ind: string) => (
                        <span
                          key={ind}
                          className="border-[2px] border-black bg-neo-surface px-1.5 py-0.5 font-mono text-[10px] font-bold"
                        >
                          {ind}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="font-mono text-[10px] uppercase text-black/60">
                      Active Campaigns
                    </p>
                    <p className="font-display text-lg font-black">
                      {segment.campaigns}
                    </p>
                    <p className="font-mono text-xs text-black/60">
                      Engagement Score: {engagement.score}
                    </p>
                  </div>
                </div>
              </div>
            </NeoCard>
          );
        })}
      </section>

      {/* Audience Insights */}
      <section className="grid gap-4 md:grid-cols-2">
        <NeoCard title="Growth Trends" accent="pink">
          <div className="flex flex-col gap-3">
            <p className="font-medium text-black/70">
              Your audience is growing fastest in the startup segment (+18.7%)
              with strong engagement from AI/ML and FinTech industries.
            </p>
            <div className="border-t-[2px] border-black pt-3">
              <p className="mb-2 font-mono text-[10px] uppercase text-black/60">
                Recommended Actions
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li className="font-medium">
                  Increase budget allocation to startup campaigns
                </li>
                <li className="font-medium">
                  Create AI/ML-focused content series
                </li>
                <li className="font-medium">
                  Launch partner co-marketing in FinTech space
                </li>
              </ul>
            </div>
          </div>
        </NeoCard>

        <NeoCard title="Engagement Analysis" accent="cyan">
          <div className="flex flex-col gap-3">
            <p className="font-medium text-black/70">
              Enterprise Decision Makers and Startup Innovators show the highest
              engagement rates, with 2.3x higher conversion rates than other segments.
            </p>
            <div className="border-t-[2px] border-black pt-3">
              <p className="mb-2 font-mono text-[10px] uppercase text-black/60">
                Top Performing Content
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li className="font-medium">Product demos & webinars</li>
                <li className="font-medium">AI/automation case studies</li>
                <li className="font-medium">ROI calculators & tools</li>
              </ul>
            </div>
          </div>
        </NeoCard>
      </section>
    </div>
  );
}
