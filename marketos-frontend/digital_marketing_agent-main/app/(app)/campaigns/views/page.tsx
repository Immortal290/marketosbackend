import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { Table, Kanban, Calendar, Filter } from "lucide-react";

const viewOptions = [
  {
    title: "Table View",
    href: "/campaigns/views/table",
    description: "Classic table layout with sortable columns",
    icon: Table,
    accent: "yellow" as const,
  },
  {
    title: "Kanban View",
    href: "/campaigns/views/kanban",
    description: "Drag-and-drop board organized by status",
    icon: Kanban,
    accent: "pink" as const,
  },
  {
    title: "Calendar View",
    href: "/campaigns/views/calendar",
    description: "Timeline view with campaign schedules",
    icon: Calendar,
    accent: "cyan" as const,
  },
  {
    title: "Campaign Filters",
    href: "/campaigns/views/filters",
    description: "Advanced filtering and search options",
    icon: Filter,
    accent: "lime" as const,
  },
];

export default function CampaignViewsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            All Campaigns
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Choose your preferred view to manage campaigns
          </p>
        </div>
        <NeoButton variant="primary">Create Campaign</NeoButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {viewOptions.map((view) => {
          const Icon = view.icon;
          return (
            <Link key={view.href} href={view.href}>
              <NeoCard title={view.title} accent={view.accent}>
                <Icon className="mb-3 h-8 w-8" />
                <p className="font-medium text-black/70">{view.description}</p>
              </NeoCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
