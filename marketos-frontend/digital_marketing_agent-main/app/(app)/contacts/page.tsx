"use client";

import { useState } from "react";
import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { Users, UserCircle, Star, GitBranch } from "lucide-react";

const contactSections = [
  {
    title: "Contacts",
    href: "/contacts/list",
    description: "Manage your contact database and view contact profiles",
    icon: Users,
    accent: "yellow" as const,
  },
  {
    title: "Segments",
    href: "/contacts/segments",
    description: "Create and manage dynamic contact segments",
    icon: GitBranch,
    accent: "pink" as const,
  },
  {
    title: "Lead Scores",
    href: "/contacts/lead-scores",
    description: "Configure lead scoring models and view scores",
    icon: Star,
    accent: "cyan" as const,
  },
  {
    title: "Personas",
    href: "/contacts/personas",
    description: "Define buyer personas and customer profiles",
    icon: UserCircle,
    accent: "lime" as const,
  },
  {
    title: "Lifecycle Stages",
    href: "/contacts/lifecycle-stages",
    description: "Set up and manage contact lifecycle stages",
    icon: GitBranch,
    accent: "yellow" as const,
  },
];

export default function ContactsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Contacts
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Manage contacts, segments, scoring, and lifecycle stages
          </p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsModalOpen(true)}>Import Contacts</NeoButton>
      </div>

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Import Contacts"
      >
        <div className="flex flex-col gap-4">
          <p className="font-medium text-black/70">This feature is coming soon!</p>
          <NeoButton variant="primary" className="mt-4" onClick={() => setIsModalOpen(false)}>
            Close
          </NeoButton>
        </div>
      </NeoModal>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contactSections.map((section) => {
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
