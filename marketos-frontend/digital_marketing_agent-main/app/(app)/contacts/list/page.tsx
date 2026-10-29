"use client";

import { useState } from "react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Users, Search, Mail, Phone } from "lucide-react";
import Link from "next/link";

const contacts = [
  { id: 1, name: "Alice Johnson", email: "alice@acmecorp.com", company: "Acme Corp", score: 92, stage: "Customer" },
  { id: 2, name: "Bob Martinez", email: "bob@techwave.io", company: "TechWave", score: 74, stage: "MQL" },
  { id: 3, name: "Carol Smith", email: "carol@startup.co", company: "Startup Co", score: 58, stage: "Lead" },
  { id: 4, name: "David Park", email: "david@enterprise.com", company: "Enterprise Ltd", score: 88, stage: "SQL" },
  { id: 5, name: "Eva Chen", email: "eva@growthco.com", company: "Growth Co", score: 45, stage: "Prospect" },
];

const stageColors: Record<string, string> = {
  Customer: "bg-lime-300",
  MQL: "bg-cyan-300",
  SQL: "bg-yellow-300",
  Lead: "bg-pink-300",
  Prospect: "bg-purple-200",
};

export default function ContactsListPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-sm font-bold uppercase tracking-wider text-black/50">
            <Link href="/contacts" className="hover:underline">Contacts</Link> / All Contacts
          </div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Contacts</h1>
          <p className="mt-1 font-medium text-black/70">Manage your full contact database</p>
        </div>
        <div className="flex gap-2">
          <NeoButton variant="secondary">Import CSV</NeoButton>
          <NeoButton variant="primary" onClick={() => setIsOpen(true)}>+ Add Contact</NeoButton>
        </div>
      </div>

      <NeoModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Add Contact">
        <div className="flex flex-col gap-4">
          <NeoInput label="Full Name" placeholder="Jane Doe" />
          <NeoInput label="Email" placeholder="jane@company.com" />
          <NeoInput label="Company" placeholder="Acme Corp" />
          <NeoInput label="Phone" placeholder="+1 555 000 0000" />
          <NeoButton variant="primary" className="mt-2" onClick={() => setIsOpen(false)}>Save Contact</NeoButton>
        </div>
      </NeoModal>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <NeoCard title="Total Contacts" accent="yellow"><p className="text-4xl font-black">5</p></NeoCard>
        <NeoCard title="Customers" accent="lime"><p className="text-4xl font-black">1</p></NeoCard>
        <NeoCard title="MQLs" accent="cyan"><p className="text-4xl font-black">1</p></NeoCard>
        <NeoCard title="Avg Lead Score" accent="pink"><p className="text-4xl font-black">71</p></NeoCard>
      </div>

      {/* Search + Table */}
      <div className="rounded-2xl border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-3 border-b-2 border-black p-4">
          <Search className="h-5 w-5 text-black/40" />
          <input
            className="flex-1 bg-transparent font-medium outline-none placeholder:text-black/30"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-medium">
            <thead>
              <tr className="border-b-2 border-black bg-yellow-50">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Score</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-black/10 hover:bg-yellow-50/50 last:border-0">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-bold">{c.name}</p>
                      <p className="text-xs text-black/50">{c.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{c.company}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border border-black px-2.5 py-0.5 text-xs font-bold ${stageColors[c.stage] ?? "bg-gray-200"}`}>
                      {c.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full border border-black bg-black/10">
                        <div className="h-full rounded-full bg-yellow-400" style={{ width: `${c.score}%` }} />
                      </div>
                      <span className="font-bold">{c.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="rounded-lg border border-black p-1.5 hover:bg-yellow-100"><Mail className="h-3.5 w-3.5" /></button>
                      <button className="rounded-lg border border-black p-1.5 hover:bg-yellow-100"><Phone className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
