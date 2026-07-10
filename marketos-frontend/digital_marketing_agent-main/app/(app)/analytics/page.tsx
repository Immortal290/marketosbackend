"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import {
  TrendingUp,
  TrendingDown,
  Users,
  MousePointerClick,
  Target,
  DollarSign,
} from "lucide-react";

const metrics = [
  {
    label: "Total Impressions",
    value: "2.4M",
    change: "+12.4%",
    trend: "up" as const,
    accent: "yellow" as const,
  },
  {
    label: "Total Clicks",
    value: "68.2K",
    change: "+8.7%",
    trend: "up" as const,
    accent: "pink" as const,
  },
  {
    label: "Avg CTR",
    value: "2.84%",
    change: "+0.3%",
    trend: "up" as const,
    accent: "cyan" as const,
  },
  {
    label: "Total Conversions",
    value: "4,829",
    change: "+18.2%",
    trend: "up" as const,
    accent: "lime" as const,
  },
];

const channelPerformance = [
  {
    channel: "LinkedIn",
    impressions: "842K",
    clicks: "24.1K",
    ctr: "2.86%",
    conversions: "1,847",
    cvr: "7.66%",
    accent: "yellow" as const,
  },
  {
    channel: "Google Ads",
    impressions: "1.1M",
    clicks: "31.2K",
    ctr: "2.84%",
    conversions: "2,124",
    cvr: "6.81%",
    accent: "pink" as const,
  },
  {
    channel: "Email",
    impressions: "256K",
    clicks: "9.4K",
    ctr: "3.67%",
    conversions: "612",
    cvr: "6.51%",
    accent: "cyan" as const,
  },
  {
    channel: "Facebook",
    impressions: "212K",
    clicks: "3.5K",
    ctr: "1.65%",
    conversions: "246",
    cvr: "7.03%",
    accent: "lime" as const,
  },
];

const topCampaigns = [
  { name: "Q1 Product Launch", conversions: 1247, spend: "$8,420", roi: "342%" },
  { name: "Brand Awareness Summer", conversions: 2891, spend: "$12,100", roi: "287%" },
  { name: "Webinar Series", conversions: 487, spend: "$3,240", roi: "198%" },
];

const audienceInsights = [
  { segment: "Enterprise (10k+)", percentage: 42, leads: 2034 },
  { segment: "Mid-Market (1k-10k)", percentage: 35, leads: 1690 },
  { segment: "Small Business (<1k)", percentage: 23, leads: 1105 },
];

const recentAlerts = [
  {
    type: "success",
    message: "LinkedIn campaign CTR increased by 24% this week",
    time: "2 hours ago",
  },
  {
    type: "warning",
    message: "Google Ads CPC trending up — optimization recommended",
    time: "5 hours ago",
  },
  {
    type: "info",
    message: "New audience segment identified: Tech Decision Makers",
    time: "Yesterday",
  },
];

export default function AnalyticsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: execData } = useSWR("/analytics/executive", fetcher);
  const { data: funnelData } = useSWR("/analytics/funnel", fetcher);
  
  const m = execData || { revenue: 1240000, pipeline: 5600000, cac: 124.5, ltv: 4800, roas: 4.2, conversionRate: 3.47 };

  const dynamicMetrics = [
    { label: "Total Revenue", value: `$${(m.revenue / 1000000).toFixed(1)}M`, change: "+12.4%", trend: "up" as const, accent: "yellow" as const },
    { label: "Pipeline", value: `$${(m.pipeline / 1000000).toFixed(1)}M`, change: "+8.7%", trend: "up" as const, accent: "pink" as const },
    { label: "Avg ROAS", value: `${m.roas}x`, change: "+0.3%", trend: "up" as const, accent: "cyan" as const },
    { label: "Conversion Rate", value: `${m.conversionRate}%`, change: "+18.2%", trend: "up" as const, accent: "lime" as const },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Analytics Dashboard
          </h1>
          <p className="mt-1 font-mono text-xs text-black/60">
            Last 30 days • Updated 5 minutes ago
          </p>
        </div>
        <div className="flex gap-2">
          <NeoButton variant="secondary" size="sm" onClick={() => setIsModalOpen(true)}>
            Export Data
          </NeoButton>
          <NeoButton variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
            Custom Report
          </NeoButton>
        </div>
      </div>

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Analytics Action"
      >
        <div className="flex flex-col gap-4">
          <p className="font-medium text-black/70">This feature is coming soon!</p>
          <NeoButton variant="primary" className="mt-4" onClick={() => setIsModalOpen(false)}>
            Close
          </NeoButton>
        </div>
      </NeoModal>

      {/* Key Metrics */}
      <section className="grid gap-4 md:grid-cols-4">
        {dynamicMetrics.map((metric) => (
          <NeoCard key={metric.label} title={metric.label} accent={metric.accent}>
            <div className="flex items-end justify-between">
              <span className="font-display text-3xl font-black">
                {metric.value}
              </span>
              <span
                className={`flex items-center gap-1 font-mono text-xs font-bold ${
                  metric.trend === "up" ? "text-neo-green" : "text-neo-red"
                }`}
              >
                {metric.trend === "up" ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {metric.change}
              </span>
            </div>
          </NeoCard>
        ))}
      </section>

      {/* Recent Alerts */}
      <section>
        <NeoCard title="AI-Powered Insights" accent="pink">
          <ul className="flex flex-col gap-3">
            {recentAlerts.map((alert, i) => (
              <li
                key={i}
                className="flex items-start gap-3 border-b-[2px] border-black pb-3 last:border-0 last:pb-0"
              >
                <NeoBadge
                  tone={
                    alert.type === "success"
                      ? "success"
                      : alert.type === "warning"
                        ? "warning"
                        : "info"
                  }
                >
                  {alert.type}
                </NeoBadge>
                <div className="flex-1">
                  <p className="font-medium">{alert.message}</p>
                  <p className="font-mono text-[10px] text-black/60">
                    {alert.time}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </NeoCard>
      </section>

      {/* Channel Performance */}
      <section>
        <h2 className="mb-4 font-display text-2xl font-black uppercase">
          Channel Performance
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {channelPerformance.map((channel) => (
            <NeoCard
              key={channel.channel}
              title={channel.channel}
              accent={channel.accent}
            >
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase text-black/60">
                    Impressions
                  </p>
                  <p className="font-display text-xl font-black">
                    {channel.impressions}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-black/60">
                    Clicks
                  </p>
                  <p className="font-display text-xl font-black">
                    {channel.clicks}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-black/60">
                    CTR
                  </p>
                  <p className="font-display text-xl font-black">
                    {channel.ctr}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t-[2px] border-black pt-4">
                <div>
                  <p className="font-mono text-[10px] uppercase text-black/60">
                    Conversions
                  </p>
                  <p className="font-display text-xl font-black">
                    {channel.conversions}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-black/60">
                    CVR
                  </p>
                  <p className="font-display text-xl font-black">
                    {channel.cvr}
                  </p>
                </div>
              </div>
            </NeoCard>
          ))}
        </div>
      </section>

      {/* Funnel Data */}
      {funnelData && (
        <section>
          <NeoCard title="Conversion Funnel" accent="lime">
            <div className="flex flex-col gap-2">
              {funnelData.map((stage: any) => (
                <div key={stage.stage} className="flex items-center justify-between p-2 hover:bg-black/5 transition-colors">
                  <span className="font-bold min-w-[100px]">{stage.stage}</span>
                  <div className="flex-1 mx-4 h-4 border-[2px] border-black bg-neo-surface relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full bg-neo-lime border-r-[2px] border-black" style={{ width: `${stage.convRate}%` }} />
                  </div>
                  <span className="font-mono text-sm font-black text-right min-w-[80px]">{stage.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </NeoCard>
        </section>
      )}

      {/* Two Column: Top Campaigns + Audience */}
      <section className="grid gap-4 md:grid-cols-2">
        <NeoCard title="Top Campaigns" accent="yellow">
          <ul className="flex flex-col gap-3">
            {topCampaigns.map((campaign, i) => (
              <li
                key={campaign.name}
                className="flex items-start justify-between border-b-[2px] border-black pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-bold">{campaign.name}</p>
                  <p className="font-mono text-xs text-black/60">
                    {campaign.conversions} conversions • {campaign.spend}
                  </p>
                </div>
                <span className="font-mono text-sm font-black text-neo-green">
                  {campaign.roi}
                </span>
              </li>
            ))}
          </ul>
        </NeoCard>

        <NeoCard title="Audience Breakdown" accent="cyan">
          <ul className="flex flex-col gap-3">
            {audienceInsights.map((audience) => (
              <li key={audience.segment} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{audience.segment}</span>
                  <span className="font-mono text-sm font-black">
                    {audience.percentage}%
                  </span>
                </div>
                <div className="h-3 border-[2px] border-black bg-neo-surface">
                  <div
                    className="h-full bg-neo-cyan"
                    style={{ width: `${audience.percentage}%` }}
                  />
                </div>
                <p className="font-mono text-[10px] text-black/60">
                  {audience.leads.toLocaleString()} leads
                </p>
              </li>
            ))}
          </ul>
        </NeoCard>
      </section>
    </div>
  );
}
