"use client";

import { useState } from "react";
import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Activity, Bell, AlertTriangle, Wrench } from "lucide-react";

const monitoringSections = [
  {
    title: "Health Dashboard",
    href: "/monitoring/health",
    description: "System health and performance monitoring",
    icon: Activity,
    accent: "yellow" as const,
  },
  {
    title: "Alert Center",
    href: "/monitoring/alerts",
    description: "View and manage all system alerts and notifications",
    icon: Bell,
    accent: "pink" as const,
  },
  {
    title: "Incident History",
    href: "/monitoring/incidents",
    description: "Track past incidents and resolutions",
    icon: AlertTriangle,
    accent: "cyan" as const,
  },
  {
    title: "Auto Remediation",
    href: "/monitoring/remediation",
    description: "Configure automated responses to common issues",
    icon: Wrench,
    accent: "lime" as const,
  },
];

export default function MonitoringPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Monitoring & Alerts
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Monitor system health and manage alerts proactively
          </p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsModalOpen(true)}>Create Alert</NeoButton>
      </div>

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Alert"
      >
        <div className="flex flex-col gap-4">
          <NeoInput label="Alert Name" placeholder="e.g. High Error Rate" />
          <NeoInput label="Metric to Monitor" placeholder="e.g. API Errors" />
          <div className="grid grid-cols-2 gap-4">
            <NeoInput label="Condition" placeholder="e.g. >" />
            <NeoInput label="Threshold" placeholder="e.g. 5%" />
          </div>
          <NeoInput label="Notification Channel" placeholder="e.g. Email, Slack" />
          <NeoButton variant="primary" className="mt-4" onClick={() => setIsModalOpen(false)}>
            Save Alert
          </NeoButton>
        </div>
      </NeoModal>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {monitoringSections.map((section) => {
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
