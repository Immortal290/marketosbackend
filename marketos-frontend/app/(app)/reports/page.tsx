"use client";

import { useState } from "react";
import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Calendar, FileText, Star, Download } from "lucide-react";

const reportSections = [
  {
    title: "Scheduled Reports",
    href: "/reports/scheduled",
    description: "Set up automated report generation and delivery",
    icon: Calendar,
    accent: "yellow" as const,
  },
  {
    title: "Custom Reports",
    href: "/reports/custom",
    description: "Build custom reports with your own metrics",
    icon: FileText,
    accent: "pink" as const,
  },
  {
    title: "Executive Reports",
    href: "/reports/executive",
    description: "High-level summaries for leadership",
    icon: Star,
    accent: "cyan" as const,
  },
  {
    title: "Exports",
    href: "/reports/exports",
    description: "Export data in CSV, PDF, or Excel formats",
    icon: Download,
    accent: "lime" as const,
  },
];

export default function ReportsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Reports
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Generate, schedule, and export marketing reports
          </p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsModalOpen(true)}>Create Report</NeoButton>
      </div>

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Report"
      >
        <div className="flex flex-col gap-4">
          <NeoInput label="Report Title" placeholder="e.g. Q3 Performance Summary" />
          <NeoInput label="Date Range" placeholder="e.g. Last 30 Days" />
          <NeoInput label="Included Metrics" placeholder="e.g. ROI, Clicks, CPC" />
          <NeoButton variant="primary" className="mt-4" onClick={() => setIsModalOpen(false)}>
            Save Report
          </NeoButton>
        </div>
      </NeoModal>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <NeoCard title={section.title} accent={section.accent}>
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
