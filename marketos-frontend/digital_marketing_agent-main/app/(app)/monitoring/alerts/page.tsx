"use client";

import { useState } from "react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Bell, AlertTriangle, Info, CheckCircle } from "lucide-react";
import Link from "next/link";

const alerts = [
  { id: 1, name: "High API Error Rate", severity: "critical", status: "active", metric: "Error Rate > 5%", time: "2m ago" },
  { id: 2, name: "Agent Response Slow", severity: "warning", status: "active", metric: "Latency > 2s", time: "15m ago" },
  { id: 3, name: "DB Connection Pool", severity: "info", status: "resolved", metric: "Pool > 80%", time: "1h ago" },
  { id: 4, name: "Redis Memory Usage", severity: "warning", status: "resolved", metric: "Memory > 75%", time: "3h ago" },
];

const severityStyle: Record<string, string> = {
  critical: "bg-red-400 border-black",
  warning: "bg-yellow-400 border-black",
  info: "bg-cyan-400 border-black",
};

const SeverityIcon: Record<string, React.ElementType> = {
  critical: AlertTriangle,
  warning: Bell,
  info: Info,
};

export default function AlertsPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-sm font-bold uppercase tracking-wider text-black/50">
            <Link href="/monitoring" className="hover:underline">Monitoring</Link> / Alert Center
          </div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Alert Center</h1>
          <p className="mt-1 font-medium text-black/70">View and manage all system alerts and notifications</p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsOpen(true)}>+ Create Alert</NeoButton>
      </div>

      <NeoModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create Alert">
        <div className="flex flex-col gap-4">
          <NeoInput label="Alert Name" placeholder="e.g. High Error Rate" />
          <NeoInput label="Metric" placeholder="e.g. API Error Rate" />
          <div className="grid grid-cols-2 gap-4">
            <NeoInput label="Condition" placeholder="e.g. >" />
            <NeoInput label="Threshold" placeholder="e.g. 5%" />
          </div>
          <NeoInput label="Notify via" placeholder="e.g. Email, Slack" />
          <NeoButton variant="primary" className="mt-2" onClick={() => setIsOpen(false)}>Save Alert</NeoButton>
        </div>
      </NeoModal>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <NeoCard title="Active Alerts" accent="pink"><p className="text-4xl font-black">2</p></NeoCard>
        <NeoCard title="Resolved Today" accent="lime"><p className="text-4xl font-black">2</p></NeoCard>
        <NeoCard title="Alert Rules" accent="cyan"><p className="text-4xl font-black">4</p></NeoCard>
      </div>

      {/* Alert List */}
      <NeoCard title="All Alerts" accent="yellow">
        <div className="flex flex-col gap-3">
          {alerts.map((alert) => {
            const Icon = SeverityIcon[alert.severity];
            return (
              <div key={alert.id} className="flex items-center gap-4 rounded-xl border-2 border-black p-4">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${severityStyle[alert.severity]}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <p className="font-bold">{alert.name}</p>
                  <p className="text-sm text-black/60">{alert.metric} · {alert.time}</p>
                </div>
                <span className={`rounded-full border border-black px-3 py-1 text-xs font-bold uppercase ${alert.status === "active" ? "bg-red-200" : "bg-lime-200"}`}>
                  {alert.status}
                </span>
                {alert.status === "active" && (
                  <NeoButton variant="secondary" className="text-xs">Resolve</NeoButton>
                )}
              </div>
            );
          })}
        </div>
      </NeoCard>
    </div>
  );
}
