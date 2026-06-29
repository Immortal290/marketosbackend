import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { Eye, MousePointerClick, Users, Target, CheckCircle, UserCheck, ShoppingCart } from "lucide-react";

const funnelStages = [
  {
    title: "Impression",
    href: "/analytics-funnel/impression",
    description: "Top-of-funnel awareness metrics",
    icon: Eye,
    accent: "yellow" as const,
  },
  {
    title: "Click",
    href: "/analytics-funnel/click",
    description: "Click-through rates and engagement",
    icon: MousePointerClick,
    accent: "pink" as const,
  },
  {
    title: "Visit",
    href: "/analytics-funnel/visit",
    description: "Website visit and page view analytics",
    icon: Users,
    accent: "cyan" as const,
  },
  {
    title: "Lead",
    href: "/analytics-funnel/lead",
    description: "Lead generation and form submissions",
    icon: Target,
    accent: "lime" as const,
  },
  {
    title: "MQL",
    href: "/analytics-funnel/mql",
    description: "Marketing Qualified Lead metrics",
    icon: CheckCircle,
    accent: "yellow" as const,
  },
  {
    title: "SQL",
    href: "/analytics-funnel/sql",
    description: "Sales Qualified Lead conversion",
    icon: UserCheck,
    accent: "pink" as const,
  },
  {
    title: "Customer",
    href: "/analytics-funnel/customer",
    description: "Customer acquisition and conversion",
    icon: ShoppingCart,
    accent: "cyan" as const,
  },
];

export default function FunnelAnalyticsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Funnel Analytics
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Track conversion through every stage of the funnel
          </p>
        </div>
        <NeoButton variant="primary">View Full Funnel</NeoButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {funnelStages.map((stage) => {
          const Icon = stage.icon;
          return (
            <Link key={stage.href} href={stage.href}>
              <NeoCard title={stage.title} accent={stage.accent}>
                <Icon className="mb-3 h-8 w-8" />
                <p className="font-medium text-black/70">{stage.description}</p>
              </NeoCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
