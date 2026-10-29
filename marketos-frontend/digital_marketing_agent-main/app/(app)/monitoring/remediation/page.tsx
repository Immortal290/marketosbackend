"use client";

import { useState } from "react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Wrench, Play, Pause, CheckCircle } from "lucide-react";
import Link from "next/link";

const rules = [
  { id: 1, name: "Auto-scale Agent Workers", trigger: "CPU > 80% for 2m", action: "Scale worker pool +2", status: "active", runs: 12 },
  { id: 2, name: "Restart Failed Consumers", trigger: "Kafka consumer lag > 1000", action: "Restart consumer group", status: "active", runs: 3 },
  { id: 3, name: "Clear Redis Cache", trigger: "Memory > 85%", action: "Flush expired keys", status: "active", runs: 7 },
  { id: 4, name: "Rate Limit AI Requests", trigger: "Error rate > 10%", action: "Enable request throttling", status: "paused", runs: 1 },
];

export default function RemediationPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-sm font-bold uppercase tracking-wider text-black/50">
            <Link href="/monitoring" className="hover:underline">Monitoring</Link> / Auto Remediation
          </div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Auto Remediation</h1>
          <p className="mt-1 font-medium text-black/70">Configure automated responses to common system issues</p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsOpen(true)}>+ New Rule</NeoButton>
      </div>

      <NeoModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Create Remediation Rule">
        <div className="flex flex-col gap-4">
          <NeoInput label="Rule Name" placeholder="e.g. Auto-scale Workers" />
          <NeoInput label="Trigger Condition" placeholder="e.g. CPU > 80% for 2m" />
          <NeoInput label="Automated Action" placeholder="e.g. Restart service" />
          <NeoInput label="Cooldown Period" placeholder="e.g. 10 minutes" />
          <NeoButton variant="primary" className="mt-2" onClick={() => setIsOpen(false)}>Save Rule</NeoButton>
        </div>
      </NeoModal>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <NeoCard title="Active Rules" accent="lime"><p className="text-4xl font-black">3</p></NeoCard>
        <NeoCard title="Total Executions" accent="cyan"><p className="text-4xl font-black">23</p></NeoCard>
        <NeoCard title="Issues Auto-resolved" accent="yellow"><p className="text-4xl font-black">23</p></NeoCard>
      </div>

      {/* Rules */}
      <div className="flex flex-col gap-4">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-2xl border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black ${rule.status === "active" ? "bg-lime-400" : "bg-yellow-300"}`}>
                <Wrench className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg">{rule.name}</h3>
                  <span className={`ml-auto rounded-full border border-black px-3 py-0.5 text-xs font-bold uppercase ${rule.status === "active" ? "bg-lime-300" : "bg-yellow-200"}`}>
                    {rule.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-black/60"><span className="font-bold">Trigger:</span> {rule.trigger}</p>
                <p className="text-sm text-black/60"><span className="font-bold">Action:</span> {rule.action}</p>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-black/50">
                  <CheckCircle className="h-3 w-3 text-lime-600" />
                  Executed {rule.runs} times
                </div>
              </div>
              <div className="flex gap-2">
                <NeoButton variant="secondary" className="text-xs">
                  {rule.status === "active" ? <><Pause className="h-3 w-3" /> Pause</> : <><Play className="h-3 w-3" /> Enable</>}
                </NeoButton>
                <NeoButton variant="secondary" className="text-xs">Edit</NeoButton>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
