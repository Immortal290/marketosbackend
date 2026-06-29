"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, BarChart3, Users, Megaphone, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/cn";
import { appNav } from "@/lib/marketing";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "/dashboard": LayoutDashboard,
  "/campaigns": Megaphone,
  "/analytics": BarChart3,
  "/audience": Users,
  "/settings": Settings,
};

export function AppNav() {
  const pathname = usePathname();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "MarketOS";

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-black bg-neo-yellow">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link
          href="/dashboard"
          className="font-display text-2xl font-black uppercase tracking-tight"
        >
          {appName}
        </Link>

        <nav className="flex items-center gap-1">
          {appNav.map((item) => {
            const Icon = iconMap[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 font-mono text-sm font-bold uppercase transition-all",
                  isActive(item.href)
                    ? "border-[3px] border-black bg-neo-pink px-3 py-2 shadow-[3px_3px_0_0_#000]"
                    : "px-3 py-2 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:bg-neo-surface hover:shadow-[2px_2px_0_0_#000]",
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs font-bold uppercase text-black/70 md:inline">
            user@company.com
          </span>
          <div className="h-8 w-8 border-[3px] border-black bg-neo-cyan shadow-[2px_2px_0_0_#000]" />
        </div>
      </div>
    </header>
  );
}
