"use client";

import { useState } from "react";
import type { TeamMember } from "@/lib/types";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoInput } from "@/components/ui/NeoInput";
import { neoTokens } from "@/lib/theme";

const statusTone = {
  active: "success",
  invited: "warning",
  suspended: "danger",
} as const;

const initialMembers: TeamMember[] = [
  {
    id: "u1",
    name: "Mara Lin",
    email: "mara@acme.io",
    role: "Owner",
    status: "active",
    avatarColor: neoTokens.colors.pink,
  },
  {
    id: "u2",
    name: "Devon Park",
    email: "devon@acme.io",
    role: "Admin",
    status: "active",
    avatarColor: neoTokens.colors.cyan,
  },
  {
    id: "u3",
    name: "Sam Ortiz",
    email: "sam@acme.io",
    role: "Editor",
    status: "invited",
    avatarColor: neoTokens.colors.lime,
  },
  {
    id: "u4",
    name: "Rae Cho",
    email: "rae@acme.io",
    role: "Viewer",
    status: "suspended",
    avatarColor: neoTokens.colors.yellow,
  },
];

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [email, setEmail] = useState("");

  const invite = () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setMembers((m) => [
      ...m,
      {
        id: `u${m.length + 1}`,
        name: trimmed.split("@")[0],
        email: trimmed,
        role: "Viewer",
        status: "invited",
        avatarColor: neoTokens.colors.cyan,
      },
    ]);
    setEmail("");
  };

  return (
    <NeoCard title="Team" accent="pink">
      <div className="mb-4 flex items-end gap-3">
        <div className="flex-1">
          <NeoInput
            label="Invite by email"
            name="invite"
            type="email"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <NeoButton variant="primary" onClick={invite}>
          Invite
        </NeoButton>
      </div>
      <table className="w-full border-[3px] border-black">
        <thead>
          <tr className="bg-neo-yellow text-left">
            <th className="border-b-[3px] border-black px-3 py-2 font-mono text-xs uppercase">
              Member
            </th>
            <th className="border-b-[3px] border-black px-3 py-2 font-mono text-xs uppercase">
              Role
            </th>
            <th className="border-b-[3px] border-black px-3 py-2 font-mono text-xs uppercase">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b-[2px] border-black">
              <td className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <span
                    className="h-8 w-8 border-[3px] border-black"
                    style={{ backgroundColor: m.avatarColor }}
                  />
                  <div>
                    <div className="font-bold">{m.name}</div>
                    <div className="font-mono text-xs text-black/60">
                      {m.email}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2">
                <NeoBadge tone="info">{m.role}</NeoBadge>
              </td>
              <td className="px-3 py-2">
                <NeoBadge tone={statusTone[m.status]}>{m.status}</NeoBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </NeoCard>
  );
}
