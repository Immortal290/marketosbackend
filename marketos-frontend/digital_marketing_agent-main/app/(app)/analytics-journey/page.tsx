import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { Map, Crosshair, XCircle, Route } from "lucide-react";

const journeyMetrics = [
  {
    title: "Customer Paths",
    href: "/analytics-journey/paths",
    description: "Visualize customer journey paths",
    icon: Map,
    accent: "yellow" as const,
  },
  {
    title: "Touchpoints",
    href: "/analytics-journey/touchpoints",
    description: "Analyze key touchpoint interactions",
    icon: Crosshair,
    accent: "pink" as const,
  },
  {
    title: "Dropoffs",
    href: "/analytics-journey/dropoffs",
    description: "Identify where customers drop off",
    icon: XCircle,
    accent: "cyan" as const,
  },
  {
    title: "Conversion Paths",
    href: "/analytics-journey/conversion-paths",
    description: "Track paths that lead to conversion",
    icon: Route,
    accent: "lime" as const,
  },
];

export default function JourneyAnalyticsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Journey Analytics
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Map and optimize the customer journey
          </p>
        </div>
        <NeoButton variant="primary">Journey Mapper</NeoButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {journeyMetrics.map((metric) => {
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
