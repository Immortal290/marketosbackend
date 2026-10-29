"use client";

import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";

const incidents = [
  { id: "INC-001", title: "API Gateway Timeout Spike", severity: "critical", status: "resolved", duration: "12m", date: "Oct 26, 2026", root_cause: "Upstream agent service overloaded" },
  { id: "INC-002", title: "Database Connection Pool Exhausted", severity: "warning", status: "resolved", duration: "5m", date: "Oct 25, 2026", root_cause: "Surge in campaign launch requests" },
  { id: "INC-003", title: "Redis Cache Miss Rate High", severity: "info", status: "resolved", duration: "8m", date: "Oct 23, 2026", root_cause: "Cache key expiry misconfiguration" },
  { id: "INC-004", title: "Email Agent Queue Backlog", severity: "warning", status: "resolved", duration: "22m", date: "Oct 20, 2026", root_cause: "Kafka consumer group rebalancing" },
];

const severityColors: Record<string, string> = {
  critical: "bg-red-300",
  warning: "bg-yellow-300",
  info: "bg-cyan-300",
};

export default function IncidentsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-sm font-bold uppercase tracking-wider text-black/50">
            <Link href="/monitoring" className="hover:underline">Monitoring</Link> / Incident History
          </div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Incident History</h1>
          <p className="mt-1 font-medium text-black/70">Track and review past incidents and their resolutions</p>
        </div>
        <NeoButton variant="secondary">Export Report</NeoButton>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <NeoCard title="Total Incidents (30d)" accent="yellow"><p className="text-4xl font-black">4</p></NeoCard>
        <NeoCard title="Avg Resolution Time" accent="cyan"><p className="text-4xl font-black">11m</p></NeoCard>
        <NeoCard title="MTTR" accent="lime"><p className="text-4xl font-black">11m</p></NeoCard>
      </div>

      {/* Incident List */}
      <div className="flex flex-col gap-4">
        {incidents.map((inc) => (
          <div key={inc.id} className="rounded-2xl border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black ${severityColors[inc.severity]}`}>
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-black/50">{inc.id}</span>
                  <h3 className="font-bold text-lg">{inc.title}</h3>
                  <span className="ml-auto flex items-center gap-1 rounded-full border border-black bg-lime-300 px-3 py-0.5 text-xs font-bold uppercase">
                    <CheckCircle className="h-3 w-3" /> Resolved
                  </span>
                </div>
                <p className="mt-1 text-sm text-black/60">{inc.root_cause}</p>
                <div className="mt-3 flex items-center gap-4 text-sm font-medium text-black/50">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Duration: {inc.duration}</span>
                  <span>·</span>
                  <span>{inc.date}</span>
                  <span>·</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase border border-black ${severityColors[inc.severity]}`}>{inc.severity}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
