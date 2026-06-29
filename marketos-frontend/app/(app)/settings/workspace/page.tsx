"use client";

import { useState } from "react";
import type { WorkspaceSettings } from "@/lib/types";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoInput } from "@/components/ui/NeoInput";
import { NeoButton } from "@/components/ui/NeoButton";
import { cn } from "@/lib/cn";
import { neoTokens } from "@/lib/theme";

const timezones = ["UTC", "America/New_York", "Europe/London", "Asia/Kolkata"];
const swatches = [
  neoTokens.colors.yellow,
  neoTokens.colors.pink,
  neoTokens.colors.cyan,
  neoTokens.colors.lime,
  neoTokens.colors.green,
];

export default function WorkspaceSettingsPage() {
  const [settings, setSettings] = useState<WorkspaceSettings>({
    name: "Acme Marketing",
    subdomain: "acme",
    defaultTimezone: "UTC",
    brandColor: neoTokens.colors.yellow,
  });

  const update = <K extends keyof WorkspaceSettings>(
    key: K,
    value: WorkspaceSettings[K],
  ) => setSettings((s) => ({ ...s, [key]: value }));

  return (
    <NeoCard title="Workspace" accent="yellow">
      <div className="flex max-w-xl flex-col gap-4">
        <NeoInput
          label="Workspace Name"
          name="name"
          value={settings.name}
          onChange={(e) => update("name", e.target.value)}
        />
        <NeoInput
          label="Subdomain"
          name="subdomain"
          hint=".marketos.app"
          value={settings.subdomain}
          onChange={(e) => update("subdomain", e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <label
            htmlFor="tz"
            className="font-mono text-xs font-bold uppercase tracking-tight"
          >
            Default Timezone
          </label>
          <select
            id="tz"
            value={settings.defaultTimezone}
            onChange={(e) => update("defaultTimezone", e.target.value)}
            className="border-[3px] border-black rounded-none bg-neo-surface px-3 py-2 font-medium shadow-[2px_2px_0_0_#000]"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-tight">
            Brand Color
          </span>
          <div className="flex gap-2">
            {swatches.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Select ${color}`}
                onClick={() => update("brandColor", color)}
                style={{ backgroundColor: color }}
                className={cn(
                  "h-8 w-8 border-[3px] border-black shadow-[2px_2px_0_0_#000]",
                  settings.brandColor === color
                    ? "outline outline-[3px] outline-offset-2 outline-[#00E0FF]"
                    : "",
                )}
              />
            ))}
          </div>
        </div>
        {/* Save target (future): process.env.NEXT_PUBLIC_API_BASE_URL */}
        <div>
          <NeoButton variant="primary">Save Changes</NeoButton>
        </div>
      </div>
    </NeoCard>
  );
}
