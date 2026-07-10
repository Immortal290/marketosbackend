import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { MousePointerClick, Eye, Users, Database } from "lucide-react";

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

export default function AttributionAnalyticsPage() {
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
