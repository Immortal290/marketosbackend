"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import useSWR from "swr";
import { fetcher, apiRequest } from "@/lib/api";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { Image, Palette, Sparkles, Layout, Edit, Zap, Loader2 } from "lucide-react";

const studioSections = [
  {
    title: "Asset Library",
    href: "/creative-studio/assets",
    description: "Browse and manage all your creative assets in one place",
    icon: Image,
    accent: "yellow" as const,
    metaKey: "assets",
  },
  {
    title: "Brand Kit",
    href: "/creative-studio/brand-kit",
    description: "Colors, fonts, logos, and brand guidelines",
    icon: Palette,
    accent: "pink" as const,
    metaKey: "brandKit",
  },
  {
    title: "Generated Creatives",
    href: "/creative-studio/generated",
    description: "AI-generated creative assets and variations",
    icon: Sparkles,
    accent: "cyan" as const,
    metaKey: "generated",
  },
  {
    title: "Templates",
    href: "/creative-studio/templates",
    description: "Pre-built templates for campaigns and content",
    icon: Layout,
    accent: "lime" as const,
    metaKey: "templates",
  },
  {
    title: "Design Editor",
    href: "/creative-studio/editor",
    description: "Create and edit designs with our visual editor",
    icon: Edit,
    accent: "pink" as const,
    metaKey: null,
  },
];

export default function CreativeStudioPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [assetType, setAssetType] = useState("SOCIAL_POST");
  const [generating, setGenerating] = useState(false);

  // Fetch live counts from backend
  const { data: assetsData } = useSWR("/creative-studio/assets?limit=1", fetcher);
  const { data: generatedData } = useSWR("/creative-studio/generated?limit=1", fetcher);
  const { data: templatesData } = useSWR("/creative-studio/templates", fetcher);
  const { data: brandKit } = useSWR("/creative-studio/brand-kit", fetcher);

  const liveCounts: Record<string, string | null> = {
    assets:    assetsData?.meta?.total != null ? `${assetsData.meta.total} assets` : null,
    generated: generatedData?.meta?.total != null ? `${generatedData.meta.total} generated` : null,
    templates: templatesData ? `${Array.isArray(templatesData) ? templatesData.length : 0} templates` : null,
    brandKit:  brandKit ? "Active" : null,
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      await apiRequest("/creative-studio/generate", {
        method: "POST",
        body: JSON.stringify({
          type: assetType,
          prompt,
          workspaceId: "00000000-0000-0000-0000-000000000000",
          variants: 3,
          brandKit: true,
        }),
      });
      toast.success("Creative generation queued!", {
        description: "Your AI-generated assets will be ready shortly.",
      });
      setIsModalOpen(false);
      setPrompt("");
    } catch {
      toast.error("Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

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
        <div className="flex gap-2">
          <NeoButton variant="secondary" onClick={() => setIsModalOpen(true)}>
            <Zap className="mr-1 h-4 w-4" /> AI Generate
          </NeoButton>
          <NeoButton variant="primary" onClick={() => setIsModalOpen(true)}>Create New Asset</NeoButton>
        </div>
      </div>

      {/* Brand Kit Quick View */}
      {brandKit && (
        <NeoCard title="Brand Kit — Active" accent="pink">
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[10px] uppercase text-black/50">Primary</p>
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 border-[2px] border-black shadow-[2px_2px_0_0_#000]"
                  style={{ backgroundColor: brandKit.colors?.primary ?? "#6C63FF" }}
                />
                <span className="font-mono text-xs font-bold">{brandKit.colors?.primary ?? "—"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[10px] uppercase text-black/50">Secondary</p>
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 border-[2px] border-black shadow-[2px_2px_0_0_#000]"
                  style={{ backgroundColor: brandKit.colors?.secondary ?? "#FF6584" }}
                />
                <span className="font-mono text-xs font-bold">{brandKit.colors?.secondary ?? "—"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[10px] uppercase text-black/50">Tone</p>
              <p className="font-medium text-sm">{brandKit.toneOfVoice ?? "—"}</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[10px] uppercase text-black/50">Font</p>
              <p className="font-medium text-sm">{brandKit.fonts?.heading ?? "—"}</p>
            </div>
          </div>
        </NeoCard>
      )}

      <NeoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="AI Creative Generator"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-xs font-bold uppercase tracking-tight">Asset Type</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className="border-[3px] border-black rounded-none bg-neo-surface px-3 py-2 font-medium shadow-[2px_2px_0_0_#000]"
            >
              <option value="SOCIAL_POST">Social Post</option>
              <option value="EMAIL_COPY">Email Copy</option>
              <option value="AD_CREATIVE">Ad Creative</option>
              <option value="LANDING_PAGE">Landing Page</option>
              <option value="SMS_COPY">SMS Copy</option>
            </select>
          </div>
          <NeoInput
            label="Prompt"
            placeholder="e.g. Write a compelling subject line for Q4 product launch targeting CTOs"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <NeoButton variant="primary" className="mt-4" onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Generating...</span>
            ) : (
              <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Generate 3 Variants</span>
            )}
          </NeoButton>
        </div>
      </NeoModal>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {studioSections.map((section) => {
          const Icon = section.icon;
          const liveCount = section.metaKey ? liveCounts[section.metaKey] : null;
          return (
            <Link key={section.href} href={section.href}>
              <NeoCard title={section.title} accent={section.accent}>
                <Icon className="mb-3 h-8 w-8" />
                <p className="font-medium text-black/70">{section.description}</p>
                {liveCount && (
                  <p className="mt-2 font-mono text-[10px] font-bold uppercase text-black/40 tracking-wider">
                    {liveCount}
                  </p>
                )}
              </NeoCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
