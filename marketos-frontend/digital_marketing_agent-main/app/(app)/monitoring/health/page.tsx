"use client";

import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { Activity, CheckCircle, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";

const services = [
  { name: "API Gateway", status: "healthy", uptime: "99.98%", latency: "42ms" },
  { name: "Database (PostgreSQL)", status: "healthy", uptime: "99.99%", latency: "8ms" },
  { name: "Redis Cache", status: "healthy", uptime: "100%", latency: "1ms" },
  { name: "Kafka / Redpanda", status: "healthy", uptime: "99.95%", latency: "12ms" },
  { name: "AI Agents Service", status: "healthy", uptime: "99.90%", latency: "320ms" },
  { name: "ClickHouse Analytics", status: "healthy", uptime: "99.97%", latency: "18ms" },
];

const metrics = [
  { label: "Overall Uptime", value: "99.97%", icon: CheckCircle, accent: "lime" as const },
  { label: "Avg Response Time", value: "67ms", icon: Clock, accent: "cyan" as const },
  { label: "Active Services", value: "6 / 6", icon: Activity, accent: "yellow" as const },
  { label: "Open Incidents", value: "0", icon: AlertCircle, accent: "pink" as const },
];

export default function HealthPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-sm font-bold uppercase tracking-wider text-black/50">
            <Link href="/monitoring" className="hover:underline">Monitoring</Link> / Health Dashboard
          </div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Health Dashboard
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Real-time system health and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-lime-400 px-4 py-1.5 text-sm font-bold uppercase">
            <span className="h-2 w-2 rounded-full bg-black animate-pulse" />
            All Systems Operational
          </span>
          <NeoButton variant="secondary">Refresh</NeoButton>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <NeoCard key={m.label} title={m.label} accent={m.accent}>
              <Icon className="mb-2 h-7 w-7" />
              <p className="text-3xl font-black">{m.value}</p>
            </NeoCard>
          );
        })}
      </div>

      {/* Service Status Table */}
      <NeoCard title="Service Status" accent="yellow">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-medium">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-3 text-left">Service</th>
                <th className="py-3 text-left">Status</th>
                <th className="py-3 text-left">Uptime</th>
                <th className="py-3 text-left">Avg Latency</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.name} className="border-b border-black/10 last:border-0">
                  <td className="py-3 font-bold">{s.name}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-black bg-lime-300 px-2.5 py-0.5 text-xs font-bold uppercase">
                      <span className="h-1.5 w-1.5 rounded-full bg-black" />
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3">{s.uptime}</td>
                  <td className="py-3">{s.latency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NeoCard>
    </div>
  );
}
