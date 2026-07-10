"use client";

import { useState } from "react";
import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Mail, Share2, FileText } from "lucide-react";

const templateTypes = [
  {
    title: "Email Templates",
    href: "/campaigns/templates/email",
    description: "Pre-designed email templates for campaigns",
    icon: Mail,
    count: 24,
    accent: "yellow" as const,
  },
  {
    title: "Social Templates",
    href: "/campaigns/templates/social",
    description: "Ready-to-use social media post templates",
    icon: Share2,
    count: 18,
    accent: "pink" as const,
  },
  {
    title: "Landing Pages",
    href: "/campaigns/templates/landing-pages",
    description: "Conversion-optimized landing page templates",
    icon: FileText,
    count: 12,
    accent: "cyan" as const,
  },
];

export default function CampaignTemplatesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Campaign Templates
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Start with pre-built templates to launch faster
          </p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsModalOpen(true)}>Create Template</NeoButton>
      </div>

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Template"
      >
        <div className="flex flex-col gap-4">
          <NeoInput label="Template Name" placeholder="e.g. Standard Newsletter" />
          <NeoInput label="Platform" placeholder="e.g. Email, Social" />
          <NeoButton variant="primary" className="mt-4" onClick={() => setIsModalOpen(false)}>
            Save Template
          </NeoButton>
        </div>
      </NeoModal>

      <div className="grid gap-4 md:grid-cols-3">
        {templateTypes.map((template) => {
          const Icon = template.icon;
          return (
            <Link key={template.href} href={template.href}>
              <NeoCard title={template.title} accent={template.accent}>
                <Icon className="mb-3 h-8 w-8" />
                <p className="mb-3 font-medium text-black/70">{template.description}</p>
                <p className="font-display text-2xl font-black">{template.count}</p>
                <p className="font-mono text-xs text-black/60">Available templates</p>
              </NeoCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
