"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher, apiRequest } from "@/lib/api";
import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Calendar, FileText, Star, Download, ExternalLink } from "lucide-react";

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
    title: "Exports",
    href: "/reports/exports",
    description: "Export data in CSV, PDF, or Excel formats",
    icon: Download,
    accent: "lime" as const,
  },
];

const statusTone: Record<string, "success" | "warning" | "info"> = {
  READY:      "success",
  GENERATING: "warning",
  FAILED:     "info",
};

export default function ReportsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [dateRange, setDateRange] = useState("Last 30 Days");
  const [metrics, setMetrics] = useState("ROI, Clicks, CPC");
  const [saving, setSaving] = useState(false);

  const { data: execReports, mutate } = useSWR("/reports/executive", fetcher);

  const handleCreateReport = async () => {
    setSaving(true);
    try {
      await apiRequest("/reports/custom", {
        method: "POST",
        body: JSON.stringify({
          name: reportTitle || "Custom Report",
          metrics: metrics.split(",").map((m) => m.trim()),
          dateRange: { from: "2026-01-01", to: new Date().toISOString().split("T")[0] },
          workspaceId: "00000000-0000-0000-0000-000000000000",
          format: "PDF",
        }),
      });
      toast.success("Report generation started!", {
        description: "Your report will be ready in ~15 seconds.",
      });
      setIsModalOpen(false);
      setTimeout(() => mutate(), 3000);
    } catch {
      toast.error("Failed to create report");
    } finally {
      setSaving(false);
    }
  };

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
        title="Create Custom Report"
      >
        <div className="flex flex-col gap-4">
          <NeoInput
            label="Report Title"
            placeholder="e.g. Q3 Performance Summary"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
          />
          <NeoInput
            label="Date Range"
            placeholder="e.g. Last 30 Days"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          />
          <NeoInput
            label="Included Metrics"
            placeholder="e.g. ROI, Clicks, CPC"
            value={metrics}
            onChange={(e) => setMetrics(e.target.value)}
          />
          <NeoButton variant="primary" className="mt-4" onClick={handleCreateReport} disabled={saving}>
            {saving ? "Generating..." : "Generate Report"}
          </NeoButton>
        </div>
      </NeoModal>

      {/* Live Executive Reports from Backend */}
      {execReports && execReports.length > 0 && (
        <section>
          <NeoCard title="Executive Reports — Live" accent="cyan">
            <div className="flex flex-col gap-3">
              {execReports.map((report: any) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between border-b-[2px] border-black pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <Star className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-bold">{report.name}</p>
                      <p className="font-mono text-[10px] text-black/50">
                        {report.format} · {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <NeoBadge tone={statusTone[report.status] ?? "info"}>
                      {report.status}
                    </NeoBadge>
                    {report.downloadUrl && (
                      <a
                        href={report.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-mono text-xs font-bold underline underline-offset-2 hover:opacity-70 transition-opacity"
                      >
                        Download <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </NeoCard>
        </section>
      )}

      {/* Section Navigation */}
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
