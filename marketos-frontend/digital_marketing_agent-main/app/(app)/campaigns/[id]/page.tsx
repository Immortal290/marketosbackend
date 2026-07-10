import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoTabs } from "@/components/ui/NeoTabs";
import {
  ArrowLeft,
  Play,
  TrendingUp,
  Target,
  MapPin,
  Image as ImageIcon,
  Mail,
  MessageSquare,
  Share2,
  Clock,
  CheckCircle,
  FileText,
  Users,
} from "lucide-react";

// Mock campaign data
const campaignDetail = {
  id: "camp-001",
  name: "Q1 Product Launch",
  status: "active",
  budget: "$15,000",
  spent: "$8,420",
  remaining: "$6,580",
  leads: 1247,
  conversions: 89,
  conversionRate: "7.1%",
  cpl: "$6.75",
  startDate: "Jan 15, 2026",
  endDate: "Mar 31, 2026",
  healthScore: 87,
};

export default function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <NeoCard title="Campaign Summary" accent="yellow">
              <p className="mb-2 font-mono text-xs text-black/60">Status</p>
              <NeoBadge tone="success">Active</NeoBadge>
              <p className="mt-3 mb-2 font-mono text-xs text-black/60">Duration</p>
              <p className="font-bold">{campaignDetail.startDate} - {campaignDetail.endDate}</p>
            </NeoCard>
            
            <NeoCard title="Goal Progress" accent="pink">
              <p className="mb-2 font-display text-3xl font-black">
                {campaignDetail.conversions}
              </p>
              <p className="font-mono text-xs text-black/60">of 150 goal</p>
              <div className="mt-3 h-3 border-[2px] border-black bg-neo-surface">
                <div className="h-full bg-neo-pink" style={{ width: "59%" }} />
              </div>
            </NeoCard>
            
            <NeoCard title="Timeline" accent="cyan">
              <Clock className="mb-2 h-6 w-6" />
              <p className="font-bold">45 days running</p>
              <p className="mt-1 font-mono text-xs text-black/60">31 days remaining</p>
            </NeoCard>
            
            <NeoCard title="Health Score" accent="lime">
              <p className="mb-2 font-display text-3xl font-black text-neo-green">
                {campaignDetail.healthScore}
              </p>
              <p className="font-mono text-xs text-black/60">Excellent performance</p>
            </NeoCard>
          </div>

          <NeoCard title="Budget Overview" accent="yellow">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="font-mono text-xs uppercase text-black/60">Total Budget</p>
                <p className="font-display text-2xl font-black">{campaignDetail.budget}</p>
              </div>
              <div>
                <p className="font-mono text-xs uppercase text-black/60">Spent</p>
                <p className="font-display text-2xl font-black">{campaignDetail.spent}</p>
              </div>
              <div>
                <p className="font-mono text-xs uppercase text-black/60">Remaining</p>
                <p className="font-display text-2xl font-black">{campaignDetail.remaining}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-4 border-[3px] border-black bg-neo-surface">
                <div className="h-full bg-neo-cyan" style={{ width: "56%" }} />
              </div>
              <p className="mt-1 font-mono text-xs text-black/60">56% of budget spent</p>
            </div>
          </NeoCard>
        </div>
      ),
    },
    {
      id: "audience",
      label: "Audience",
      content: (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <NeoCard title="Audience Overview" accent="yellow">
              <Users className="mb-3 h-8 w-8" />
              <p className="mb-2 font-display text-2xl font-black">45,000</p>
              <p className="font-mono text-xs text-black/60">Total reach</p>
            </NeoCard>
            
            <NeoCard title="Segment Distribution" accent="pink">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Enterprise (10k+)</span>
                  <span className="font-mono text-sm font-black">52%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold">Mid-Market (1k-10k)</span>
                  <span className="font-mono text-sm font-black">32%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold">Small Business</span>
                  <span className="font-mono text-sm font-black">16%</span>
                </div>
              </div>
            </NeoCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <NeoCard title="Geo Distribution" accent="cyan">
              <MapPin className="mb-3 h-6 w-6" />
              <ul className="flex flex-col gap-2">
                <li className="flex items-center justify-between border-b-[2px] border-black pb-2">
                  <span className="font-bold">United States</span>
                  <span className="font-mono text-sm font-black">58%</span>
                </li>
                <li className="flex items-center justify-between border-b-[2px] border-black pb-2">
                  <span className="font-bold">United Kingdom</span>
                  <span className="font-mono text-sm font-black">24%</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-bold">Canada</span>
                  <span className="font-mono text-sm font-black">18%</span>
                </li>
              </ul>
            </NeoCard>
            
            <NeoCard title="Lifecycle Distribution" accent="lime">
              <Target className="mb-3 h-6 w-6" />
              <ul className="flex flex-col gap-2">
                <li className="flex items-center justify-between border-b-[2px] border-black pb-2">
                  <span className="font-bold">Leads</span>
                  <span className="font-mono text-sm font-black">1,247</span>
                </li>
                <li className="flex items-center justify-between border-b-[2px] border-black pb-2">
                  <span className="font-bold">MQLs</span>
                  <span className="font-mono text-sm font-black">412</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="font-bold">SQLs</span>
                  <span className="font-mono text-sm font-black">89</span>
                </li>
              </ul>
            </NeoCard>
          </div>

          <NeoCard title="Suppression Analysis" accent="pink">
            <p className="mb-4 font-medium text-black/70">
              Track contacts excluded from this campaign
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="font-mono text-xs text-black/60">Unsubscribed</p>
                <p className="font-display text-xl font-black">1,248</p>
              </div>
              <div>
                <p className="font-mono text-xs text-black/60">Hard Bounced</p>
                <p className="font-display text-xl font-black">342</p>
              </div>
              <div>
                <p className="font-mono text-xs text-black/60">Manually Suppressed</p>
                <p className="font-display text-xl font-black">89</p>
              </div>
            </div>
          </NeoCard>
        </div>
      ),
    },
    {
      id: "assets",
      label: "Assets",
      content: (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <NeoCard title="Creative Gallery" accent="yellow">
              <ImageIcon className="mb-3 h-8 w-8" />
              <p className="mb-2 font-display text-2xl font-black">24</p>
              <p className="font-mono text-xs text-black/60">Image assets</p>
            </NeoCard>
            
            <NeoCard title="Email Assets" accent="pink">
              <Mail className="mb-3 h-8 w-8" />
              <p className="mb-2 font-display text-2xl font-black">8</p>
              <p className="font-mono text-xs text-black/60">Email templates</p>
            </NeoCard>
            
            <NeoCard title="SMS Assets" accent="cyan">
              <MessageSquare className="mb-3 h-8 w-8" />
              <p className="mb-2 font-display text-2xl font-black">12</p>
              <p className="font-mono text-xs text-black/60">SMS messages</p>
            </NeoCard>
            
            <NeoCard title="Social Assets" accent="lime">
              <Share2 className="mb-3 h-8 w-8" />
              <p className="mb-2 font-display text-2xl font-black">18</p>
              <p className="font-mono text-xs text-black/60">Social posts</p>
            </NeoCard>
            
            <NeoCard title="Landing Pages" accent="yellow">
              <FileText className="mb-3 h-8 w-8" />
              <p className="mb-2 font-display text-2xl font-black">4</p>
              <p className="font-mono text-xs text-black/60">Active pages</p>
            </NeoCard>
            
            <NeoCard title="Version History" accent="pink">
              <Clock className="mb-3 h-8 w-8" />
              <p className="mb-2 font-display text-2xl font-black">47</p>
              <p className="font-mono text-xs text-black/60">Total versions</p>
            </NeoCard>
          </div>
        </div>
      ),
    },
    {
      id: "channels",
      label: "Channels",
      content: (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <NeoCard title="Email Performance" accent="yellow">
              <Mail className="mb-3 h-6 w-6" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[10px] text-black/60">Sent</p>
                  <p className="font-display text-xl font-black">12,450</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">Open Rate</p>
                  <p className="font-display text-xl font-black">32.4%</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">CTR</p>
                  <p className="font-display text-xl font-black">18.2%</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">Conversions</p>
                  <p className="font-display text-xl font-black">148</p>
                </div>
              </div>
            </NeoCard>
            
            <NeoCard title="SMS Performance" accent="pink">
              <MessageSquare className="mb-3 h-6 w-6" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[10px] text-black/60">Sent</p>
                  <p className="font-display text-xl font-black">4,280</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">Delivery Rate</p>
                  <p className="font-display text-xl font-black">98.2%</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">CTR</p>
                  <p className="font-display text-xl font-black">24.1%</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">Conversions</p>
                  <p className="font-display text-xl font-black">86</p>
                </div>
              </div>
            </NeoCard>
            
            <NeoCard title="Social Performance" accent="cyan">
              <Share2 className="mb-3 h-6 w-6" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[10px] text-black/60">Impressions</p>
                  <p className="font-display text-xl font-black">842K</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">Engagement</p>
                  <p className="font-display text-xl font-black">4.8%</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">Clicks</p>
                  <p className="font-display text-xl font-black">24.1K</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">Conversions</p>
                  <p className="font-display text-xl font-black">412</p>
                </div>
              </div>
            </NeoCard>
            
            <NeoCard title="Paid Ads Performance" accent="lime">
              <Target className="mb-3 h-6 w-6" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-[10px] text-black/60">Spend</p>
                  <p className="font-display text-xl font-black">$7,000</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">Impressions</p>
                  <p className="font-display text-xl font-black">1.2M</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">CTR</p>
                  <p className="font-display text-xl font-black">2.8%</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] text-black/60">Conversions</p>
                  <p className="font-display text-xl font-black">687</p>
                </div>
              </div>
            </NeoCard>
          </div>
        </div>
      ),
    },
    {
      id: "timeline",
      label: "Timeline",
      content: (
        <div className="flex flex-col gap-6">
          <NeoCard title="Campaign Timeline" accent="yellow">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4 border-b-[2px] border-black pb-4">
                <div className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-neo-lime shadow-[2px_2px_0_0_#000]">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-mono text-xs text-black/60">Jan 15, 2026 - 09:00 AM</p>
                  <p className="font-bold">Creation</p>
                  <p className="mt-1 font-medium text-black/70">Campaign created and configured by Marketing Team</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 border-b-[2px] border-black pb-4">
                <div className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-neo-cyan shadow-[2px_2px_0_0_#000]">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-mono text-xs text-black/60">Jan 16, 2026 - 02:30 PM</p>
                  <p className="font-bold">Approval</p>
                  <p className="mt-1 font-medium text-black/70">Campaign approved by Sarah Johnson (Marketing Director)</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 border-b-[2px] border-black pb-4">
                <div className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-neo-yellow shadow-[2px_2px_0_0_#000]">
                  <Play className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-mono text-xs text-black/60">Jan 17, 2026 - 08:00 AM</p>
                  <p className="font-bold">Launch</p>
                  <p className="mt-1 font-medium text-black/70">Campaign went live across all channels</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-neo-pink shadow-[2px_2px_0_0_#000]">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-mono text-xs text-black/60">Ongoing</p>
                  <p className="font-bold">Optimization</p>
                  <p className="mt-1 font-medium text-black/70">AI agents continuously optimizing performance</p>
                </div>
              </div>
            </div>
          </NeoCard>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/campaigns"
            className="mb-3 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase underline underline-offset-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Campaigns
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-black uppercase tracking-tight">
              {campaignDetail.name}
            </h1>
            <NeoBadge tone="success">
              <Play className="mr-1 inline h-3 w-3" />
              Active
            </NeoBadge>
          </div>
        </div>
        <div className="flex gap-2">
          <NeoButton variant="secondary" size="sm">
            Edit
          </NeoButton>
          <NeoButton variant="primary" size="sm">
            View Report
          </NeoButton>
        </div>
      </div>

      {/* Key Metrics */}
      <section className="grid gap-4 md:grid-cols-4">
        <NeoCard title="Total Leads" accent="yellow">
          <div className="flex items-end justify-between">
            <span className="font-display text-3xl font-black">
              {campaignDetail.leads}
            </span>
            <span className="flex items-center gap-1 font-mono text-xs font-bold text-neo-green">
              <TrendingUp className="h-4 w-4" />
              +18%
            </span>
          </div>
        </NeoCard>
        <NeoCard title="Conversions" accent="pink">
          <div className="flex items-end justify-between">
            <span className="font-display text-3xl font-black">
              {campaignDetail.conversions}
            </span>
            <span className="flex items-center gap-1 font-mono text-xs font-bold text-neo-green">
              <TrendingUp className="h-4 w-4" />
              +24%
            </span>
          </div>
        </NeoCard>
        <NeoCard title="CVR" accent="cyan">
          <span className="font-display text-3xl font-black">
            {campaignDetail.conversionRate}
          </span>
        </NeoCard>
        <NeoCard title="Cost per Lead" accent="lime">
          <span className="font-display text-3xl font-black">
            {campaignDetail.cpl}
          </span>
        </NeoCard>
      </section>

      {/* Tabbed Content */}
      <NeoTabs tabs={tabs} defaultTab="overview" />
    </div>
  );
}
