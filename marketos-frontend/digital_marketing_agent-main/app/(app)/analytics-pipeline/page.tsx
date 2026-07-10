import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { TrendingUp, DollarSign, Users, Target, Percent } from "lucide-react";

const pipelineMetrics = [
  {
    title: "CAC",
    href: "/analytics-pipeline/cac",
    description: "Customer Acquisition Cost analysis and trends",
    icon: DollarSign,
    accent: "yellow" as const,
  },
  {
    title: "LTV",
    href: "/analytics-pipeline/ltv",
    description: "Lifetime Value tracking and predictions",
    icon: TrendingUp,
    accent: "pink" as const,
  },
  {
    title: "ROAS",
    href: "/analytics-pipeline/roas",
    description: "Return on Ad Spend metrics by campaign",
    icon: Target,
    accent: "cyan" as const,
  },
  {
    title: "Conversion Rate",
    href: "/analytics-pipeline/conversion-rate",
    description: "Conversion rate optimization and tracking",
    icon: Percent,
    accent: "lime" as const,
  },
];

export default function PipelineAnalyticsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Pipeline Analytics
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Track key pipeline metrics and performance indicators
          </p>
        </div>
        <NeoButton variant="primary">Export Report</NeoButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {pipelineMetrics.map((metric) => {
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
