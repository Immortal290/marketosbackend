"use client";

import { useState } from "react";
import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { BarChart3, DollarSign, PieChart, TrendingUp, Calendar } from "lucide-react";

const financeSections = [
  {
    title: "Spend Dashboard",
    href: "/finance/spend",
    description: "Real-time view of marketing spend across all channels",
    icon: BarChart3,
    accent: "yellow" as const,
  },
  {
    title: "Revenue Attribution",
    href: "/finance/revenue",
    description: "Track revenue attribution by campaign and channel",
    icon: DollarSign,
    accent: "pink" as const,
  },
  {
    title: "ROAS Analysis",
    href: "/finance/roas",
    description: "Return on ad spend analysis and optimization",
    icon: TrendingUp,
    accent: "cyan" as const,
  },
  {
    title: "Budget Controls",
    href: "/finance/budget",
    description: "Set and manage budgets with automated controls",
    icon: PieChart,
    accent: "lime" as const,
  },
  {
    title: "Forecasting",
    href: "/finance/forecasting",
    description: "AI-powered spend and revenue forecasting",
    icon: Calendar,
    accent: "pink" as const,
  },
];

export default function FinancePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Finance & ROI
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Track spend, revenue attribution, and ROI across campaigns
          </p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsModalOpen(true)}>Export Report</NeoButton>
      </div>

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Export Report"
      >
        <div className="flex flex-col gap-4">
          <p className="font-medium text-black/70">This feature is coming soon!</p>
          <NeoButton variant="primary" className="mt-4" onClick={() => setIsModalOpen(false)}>
            Close
          </NeoButton>
        </div>
      </NeoModal>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {financeSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href} className="block h-full">
              <NeoCard title={section.title} accent={section.accent} className="h-full">
                <Icon className="mb-3 h-8 w-8" />
                <p className="font-medium text-black/70">{section.description}</p>
              </NeoCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
