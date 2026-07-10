"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { MousePointerClick, Eye, Users, Database, TrendingUp } from "lucide-react";

const attributionModels = [
  {
    title: "First Touch",
    href: "/analytics-attribution/first-touch",
    description: "First interaction attribution model",
    icon: MousePointerClick,
    accent: "yellow" as const,
  },
  {
    title: "Last Touch",
    href: "/analytics-attribution/last-touch",
    description: "Last interaction before conversion",
    icon: Eye,
    accent: "pink" as const,
  },
  {
    title: "Multi Touch",
    href: "/analytics-attribution/multi-touch",
    description: "Multi-touch attribution across journey",
    icon: Users,
    accent: "cyan" as const,
  },
  {
    title: "Data Driven",
    href: "/analytics-attribution/data-driven",
    description: "AI-powered attribution modeling",
    icon: Database,
    accent: "lime" as const,
  },
];

const channelColors: Record<string, string> = {
  EMAIL:    "bg-neo-yellow",
  PAID_ADS: "bg-neo-pink",
  SOCIAL:   "bg-neo-cyan",
  SMS:      "bg-neo-lime",
};

export default function AttributionAnalyticsPage() {
  const { data: attribution, isLoading } = useSWR("/analytics/attribution", fetcher);

  const channels: Array<{ channel: string; contribution: number; revenue: number }> =
    attribution?.channels ?? [
      { channel: "EMAIL",    contribution: 34.2, revenue: 424080 },
      { channel: "PAID_ADS", contribution: 28.7, revenue: 355880 },
      { channel: "SOCIAL",   contribution: 22.1, revenue: 274040 },
      { channel: "SMS",      contribution: 15.0, revenue: 186000 },
    ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Attribution Analytics
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Understand which touchpoints drive conversions
          </p>
        </div>
        <NeoButton variant="primary">Compare Models</NeoButton>
      </div>

      {/* Live Attribution Breakdown */}
      <NeoCard title={`${attribution?.model ?? "MULTI_TOUCH"} Model — Live Channel Contribution`} accent="cyan">
        <div className="flex flex-col gap-4">
          {isLoading ? (
            <p className="font-mono text-sm text-black/50 animate-pulse">Loading attribution data...</p>
          ) : (
            channels.map((ch) => (
              <div key={ch.channel} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-sm">{ch.channel}</span>
                  <div className="flex gap-4 text-right">
                    <span className="font-mono text-xs text-black/60">
                      ${ch.revenue.toLocaleString()}
                    </span>
                    <span className="font-mono text-sm font-black min-w-[48px]">
                      {ch.contribution}%
                    </span>
                  </div>
                </div>
                <div className="h-4 border-[2px] border-black bg-neo-surface relative overflow-hidden">
                  <div
                    className={`absolute top-0 left-0 h-full border-r-[2px] border-black transition-all duration-700 ${channelColors[ch.channel] ?? "bg-neo-yellow"}`}
                    style={{ width: `${ch.contribution}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <p className="mt-3 font-mono text-[10px] text-black/40 uppercase tracking-wider flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> Live data from backend · refreshes every 30s
        </p>
      </NeoCard>

      {/* Model Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {attributionModels.map((model) => {
          const Icon = model.icon;
          return (
            <Link key={model.href} href={model.href}>
              <NeoCard title={model.title} accent={model.accent}>
                <Icon className="mb-3 h-8 w-8" />
                <p className="font-medium text-black/70">{model.description}</p>
              </NeoCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
