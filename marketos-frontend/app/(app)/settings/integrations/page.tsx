"use client";

import { useState } from "react";
import type { Integration } from "@/lib/types";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoToggle } from "@/components/ui/NeoToggle";
import { NeoBadge } from "@/components/ui/NeoBadge";

const initialIntegrations: Integration[] = [
  {
    id: "i1",
    name: "Google Ads",
    category: "Ads",
    connected: true,
    description: "Sync ad spend and campaign performance.",
  },
  {
    id: "i2",
    name: "Meta Ads",
    category: "Ads",
    connected: false,
    description: "Run and monitor Facebook and Instagram ads.",
  },
  {
    id: "i3",
    name: "GA4",
    category: "Analytics",
    connected: true,
    description: "Pull website conversion analytics.",
  },
  {
    id: "i4",
    name: "HubSpot",
    category: "CRM",
    connected: false,
    description: "Sync contacts and lifecycle stages.",
  },
  {
    id: "i5",
    name: "Mailchimp",
    category: "Email",
    connected: false,
    description: "Send and track email campaigns.",
  },
  {
    id: "i6",
    name: "LinkedIn",
    category: "Social",
    connected: true,
    description: "Publish and track social posts.",
  },
];

export default function IntegrationsSettingsPage() {
  const [integrations, setIntegrations] =
    useState<Integration[]>(initialIntegrations);

  const toggle = (id: string, next: boolean) =>
    setIntegrations((list) =>
      list.map((i) => (i.id === id ? { ...i, connected: next } : i)),
    );

  return (
    <NeoCard title="Integrations" accent="cyan">
      <ul className="flex flex-col">
        {integrations.map((i) => (
          <li
            key={i.id}
            className="flex items-center justify-between gap-4 border-b-[2px] border-black py-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black">{i.name}</span>
                <NeoBadge tone="info">{i.category}</NeoBadge>
              </div>
              <p className="font-medium text-black/70">{i.description}</p>
            </div>
            <NeoToggle
              checked={i.connected}
              onCheckedChange={(next) => toggle(i.id, next)}
              label={i.connected ? "On" : "Off"}
            />
          </li>
        ))}
      </ul>
    </NeoCard>
  );
}
