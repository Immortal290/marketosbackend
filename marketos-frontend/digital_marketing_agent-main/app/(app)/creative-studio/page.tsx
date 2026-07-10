"use client";

import { useState } from "react";
import Link from "next/link";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Image, Palette, Sparkles, Layout, Edit } from "lucide-react";

const studioSections = [
  {
    title: "Asset Library",
    href: "/creative-studio/assets",
    description: "Browse and manage all your creative assets in one place",
    icon: Image,
    accent: "yellow" as const,
  },
  {
    title: "Brand Kit",
    href: "/creative-studio/brand-kit",
    description: "Colors, fonts, logos, and brand guidelines",
    icon: Palette,
    accent: "pink" as const,
  },
  {
    title: "Generated Creatives",
    href: "/creative-studio/generated",
    description: "AI-generated creative assets and variations",
    icon: Sparkles,
    accent: "cyan" as const,
  },
  {
    title: "Templates",
    href: "/creative-studio/templates",
    description: "Pre-built templates for campaigns and content",
    icon: Layout,
    accent: "lime" as const,
  },
  {
    title: "Design Editor",
    href: "/creative-studio/editor",
    description: "Create and edit designs with our visual editor",
    icon: Edit,
    accent: "pink" as const,
  },
];

export default function CreativeStudioPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Creative Studio
          </h1>
          <p className="mt-1 font-medium text-black/70">
            Design, generate, and manage all your marketing creatives
          </p>
        </div>
        <NeoButton variant="primary" onClick={() => setIsModalOpen(true)}>Create New Asset</NeoButton>
      </div>

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Asset"
      >
        <div className="flex flex-col gap-4">
          <NeoInput label="Asset Name" placeholder="e.g. Summer Banner" />
          <NeoInput label="Asset Type" placeholder="e.g. Image, Video, Copy" />
          <NeoInput label="Target Platform" placeholder="e.g. Instagram, LinkedIn" />
          <NeoButton variant="primary" className="mt-4" onClick={() => setIsModalOpen(false)}>
            Create Asset
          </NeoButton>
        </div>
      </NeoModal>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {studioSections.map((section) => {
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
