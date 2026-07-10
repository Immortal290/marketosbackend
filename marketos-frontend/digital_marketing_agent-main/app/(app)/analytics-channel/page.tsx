import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { Mail, MessageSquare, Share2, Target } from "lucide-react";

const channelMetrics = [
  {
    title: "Email",
    href: "/analytics-channel/email",
    description: "Email campaign performance and engagement",
    icon: Mail,
    accent: "yellow" as const,
  },
  {
    title: "SMS",
    href: "/analytics-channel/sms",
    description: "SMS messaging analytics and delivery",
    icon: MessageSquare,
    accent: "pink" as const,
  },
  {
    title: "Social",
    href: "/analytics-channel/social",
    description: "Social media reach and engagement",
    icon: Share2,
    accent: "cyan" as const,
  },
  {
    title: "Paid Ads",
    href: "/analytics-channel/paid-ads",
    description: "Paid advertising performance across platforms",
    icon: Target,
    accent: "lime" as const,
  },
];

export default function ChannelAnalyticsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Channel Analytics
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Performance metrics by marketing channel
          </p>
        </div>
        <NeoButton variant="primary">Compare Channels</NeoButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {channelMetrics.map((channel) => {
          const Icon = channel.icon;
          return (
            <Link key={channel.href} href={channel.href}>
              <NeoCard title={channel.title} accent={channel.accent}>
                <Icon className="mb-3 h-8 w-8" />
                <p className="font-medium text-black/70">{channel.description}</p>
              </NeoCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
