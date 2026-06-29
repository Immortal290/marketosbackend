"use client";

import { useState } from "react";
import type { SecurityPolicy } from "@/lib/types";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoToggle } from "@/components/ui/NeoToggle";
import { NeoInput } from "@/components/ui/NeoInput";
import { NeoButton } from "@/components/ui/NeoButton";

const initialPolicies: SecurityPolicy[] = [
  {
    id: "s1",
    label: "Require Two-Factor Authentication",
    description: "All members must use 2FA to sign in.",
    enabled: true,
  },
  {
    id: "s2",
    label: "Enforce SSO (SAML)",
    description: "Restrict login to the company identity provider.",
    enabled: false,
  },
  {
    id: "s3",
    label: "Auto Session Timeout",
    description: "Log out idle sessions automatically.",
    enabled: true,
  },
  {
    id: "s4",
    label: "IP Allowlist",
    description: "Only permit access from approved IP ranges.",
    enabled: false,
  },
];

export default function SecuritySettingsPage() {
  const [policies, setPolicies] = useState<SecurityPolicy[]>(initialPolicies);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState("30");

  const toggle = (id: string, next: boolean) =>
    setPolicies((list) =>
      list.map((p) => (p.id === id ? { ...p, enabled: next } : p)),
    );

  return (
    <NeoCard title="Security" accent="pink">
      <ul className="flex flex-col">
        {policies.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-4 border-b-[2px] border-black py-3"
          >
            <div>
              <div className="font-display font-black">{p.label}</div>
              <p className="font-medium text-black/70">{p.description}</p>
            </div>
            <NeoToggle
              checked={p.enabled}
              onCheckedChange={(next) => toggle(p.id, next)}
            />
          </li>
        ))}
      </ul>
      <div className="mt-4 max-w-xs">
        <NeoInput
          label="Session timeout (minutes)"
          name="timeout"
          type="number"
          value={sessionTimeoutMinutes}
          onChange={(e) => setSessionTimeoutMinutes(e.target.value)}
        />
      </div>
      <div className="mt-4">
        <NeoButton variant="primary">Save Security Settings</NeoButton>
      </div>
    </NeoCard>
  );
}
