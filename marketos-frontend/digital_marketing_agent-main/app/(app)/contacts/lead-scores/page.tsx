"use client";

import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { Star, TrendingUp, Settings } from "lucide-react";
import Link from "next/link";

const scoringFactors = [
  { factor: "Email Opens", weight: 5, description: "Each email open" },
  { factor: "Website Visit", weight: 3, description: "Each page visit" },
  { factor: "Demo Request", weight: 30, description: "Booked a demo" },
  { factor: "Pricing Page View", weight: 15, description: "Viewed pricing page" },
  { factor: "Trial Signup", weight: 25, description: "Started free trial" },
  { factor: "Content Download", weight: 10, description: "Downloaded resource" },
];

const topContacts = [
  { name: "Alice Johnson", score: 92, company: "Acme Corp", trend: "+5" },
  { name: "David Park", score: 88, company: "Enterprise Ltd", trend: "+12" },
  { name: "Bob Martinez", score: 74, company: "TechWave", trend: "+3" },
  { name: "Carol Smith", score: 58, company: "Startup Co", trend: "-2" },
  { name: "Eva Chen", score: 45, company: "Growth Co", trend: "+8" },
];

export default function LeadScoresPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-sm font-bold uppercase tracking-wider text-black/50">
            <Link href="/contacts" className="hover:underline">Contacts</Link> / Lead Scores
          </div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Lead Scores</h1>
          <p className="mt-1 font-medium text-black/70">Configure scoring models and view ranked leads</p>
        </div>
        <NeoButton variant="secondary"><Settings className="mr-2 h-4 w-4" />Configure Model</NeoButton>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <NeoCard title="Avg Score" accent="yellow"><p className="text-4xl font-black">71</p></NeoCard>
        <NeoCard title="Hot Leads (80+)" accent="pink"><p className="text-4xl font-black">2</p></NeoCard>
        <NeoCard title="Warm Leads (50-79)" accent="cyan"><p className="text-4xl font-black">2</p></NeoCard>
        <NeoCard title="Cold Leads (&lt;50)" accent="lime"><p className="text-4xl font-black">1</p></NeoCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scoring Model */}
        <NeoCard title="Scoring Factors" accent="cyan">
          <div className="flex flex-col gap-2 mt-2">
            {scoringFactors.map((f) => (
              <div key={f.factor} className="flex items-center justify-between rounded-xl border border-black/20 bg-white p-3">
                <div>
                  <p className="font-bold text-sm">{f.factor}</p>
                  <p className="text-xs text-black/50">{f.description}</p>
                </div>
                <span className="rounded-full border border-black bg-yellow-300 px-3 py-1 text-sm font-black">+{f.weight}</span>
              </div>
            ))}
          </div>
        </NeoCard>

        {/* Top Contacts */}
        <NeoCard title="Top Leads by Score" accent="yellow">
          <div className="flex flex-col gap-2 mt-2">
            {topContacts.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3 rounded-xl border border-black/20 bg-white p-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-yellow-300 font-black text-sm">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-bold text-sm">{c.name}</p>
                  <p className="text-xs text-black/50">{c.company}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-black">{c.score}</span>
                  </div>
                  <span className={`text-xs font-bold ${c.trend.startsWith("+") ? "text-green-600" : "text-red-500"}`}>{c.trend} this week</span>
                </div>
              </div>
            ))}
          </div>
        </NeoCard>
      </div>
    </div>
  );
}
