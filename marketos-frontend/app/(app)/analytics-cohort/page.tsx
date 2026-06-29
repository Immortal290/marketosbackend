import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { Clock, DollarSign, Heart, TrendingUp } from "lucide-react";

const cohortMetrics = [
  {
    title: "Retention",
    href: "/analytics-cohort/retention",
    description: "Customer retention rates by cohort",
    icon: Clock,
    accent: "yellow" as const,
  },
  {
    title: "Revenue",
    href: "/analytics-cohort/revenue",
    description: "Revenue generated per cohort over time",
    icon: DollarSign,
    accent: "pink" as const,
  },
  {
    title: "Engagement",
    href: "/analytics-cohort/engagement",
    description: "Engagement patterns across cohorts",
    icon: Heart,
    accent: "cyan" as const,
  },
  {
    title: "Conversion",
    href: "/analytics-cohort/conversion",
    description: "Conversion rates by acquisition cohort",
    icon: TrendingUp,
    accent: "lime" as const,
  },
];

export default function CohortAnalyticsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Cohort Analysis
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Analyze customer behavior by acquisition cohort
          </p>
        </div>
        <NeoButton variant="primary">Create Cohort</NeoButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cohortMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Link key={metric.href} href={metric.href}>
              <NeoCard title={metric.title} accent={metric.accent}>
                <Icon className="mb-3 h-8 w-8" />
                <p className="font-medium text-black/70">{metric.description}</p>
              </NeoCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
