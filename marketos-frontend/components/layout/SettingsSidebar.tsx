"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Users,
  Plug,
  ShieldCheck,
  CreditCard,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { settingsNav } from "@/lib/settingsNav";

const icons: Record<string, LucideIcon> = {
  Building2,
  Users,
  Plug,
  ShieldCheck,
  CreditCard,
  Lock,
};

export function SettingsSidebar() {
  const pathname = usePathname();
  return (
    <nav className="w-64 shrink-0 border-r-[3px] border-black bg-neo-surface p-4">
      <span className="mb-3 block font-display text-lg font-black uppercase tracking-tight">
        Settings
      </span>
      <ul>
        {settingsNav.map((item) => {
          const Icon = icons[item.icon];
          const active = pathname === item.href;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className={cn(
                  "mb-2 flex items-center gap-2 border-[3px] border-black rounded-none px-3 py-2 font-mono text-sm font-bold uppercase shadow-[3px_3px_0_0_#000]",
                  active ? "bg-neo-pink" : "bg-neo-surface hover:bg-neo-yellow",
                )}
              >
                {Icon ? <Icon size={16} /> : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
