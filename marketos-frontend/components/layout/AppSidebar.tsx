"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  List,
  Palette,
  BarChart2,
  TrendingUp,
  Users,
  Contact,
  DollarSign,
  Bell,
  Settings as SettingsIcon,
  LogOut,
  Linkedin,
  MonitorPlay,
  Facebook,
  Twitter,
  MessageCircle,
  Mail,
  MessageSquare,
  Phone,
  User,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";

const sidebarGroups = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Mission Control", icon: LayoutDashboard },
    ],
  },
  {
    title: "Channels",
    items: [
      { href: "/channels/linkedin", label: "LinkedIn", icon: Linkedin },
      { href: "/channels/google-ads", label: "Google Ads", icon: MonitorPlay },
      { href: "/channels/meta-ads", label: "Meta Ads", icon: Facebook },
      { href: "/channels/twitter", label: "Twitter / X", icon: Twitter },
      { href: "/channels/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { href: "/channels/email", label: "Email", icon: Mail },
      { href: "/channels/sms", label: "SMS", icon: MessageSquare },
      { href: "/channels/phone", label: "Phone", icon: Phone },
    ],
  },
  {
    title: "Campaigns",
    items: [
      { href: "/campaigns", label: "All Campaigns", icon: List },
      { href: "/creative-studio", label: "Creative Studio", icon: Palette },
    ],
  },
  {
    title: "Insights & Analytics",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart2 },
      { href: "/analytics", label: "Overview", icon: TrendingUp },
      { href: "/audience", label: "Audience", icon: Users },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/contacts", label: "Contacts", icon: Contact },
      { href: "/finance", label: "Finance & ROI", icon: DollarSign },
      { href: "/monitoring", label: "Monitoring", icon: Bell },
      { href: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "MarketOS";
  const { user, isLoading, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const displayName =
    user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
      : null;

  return (
    <aside className="sticky top-0 h-screen w-64 flex-shrink-0 flex-col overflow-y-auto border-r-[3px] border-black bg-neo-surface hidden md:flex shadow-[4px_0_0_0_#000] z-40">
      {/* Logo */}
      <div className="flex h-16 items-center border-b-[3px] border-black bg-neo-yellow px-6 py-3">
        <Link
          href="/dashboard"
          className="font-display text-2xl font-black uppercase tracking-tight"
        >
          {appName}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 px-4 py-6">
        {sidebarGroups.map((group) => (
          <div key={group.title} className="flex flex-col gap-2">
            <h3 className="font-mono text-[10px] font-bold uppercase text-black/50 px-2">
              {group.title}
            </h3>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-bold text-black transition-all hover:bg-neo-pink hover:translate-x-1",
                      active &&
                        "bg-neo-yellow translate-x-1 shadow-[2px_2px_0_0_#000] border-black border-2"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded border-2 border-black bg-white shadow-[1px_1px_0_0_#000] group-hover:bg-neo-cyan group-hover:shadow-[2px_2px_0_0_#000]",
                        active && "bg-neo-cyan"
                      )}
                    >
                      <item.icon size={14} />
                    </div>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t-[3px] border-black bg-neo-bg p-4 flex flex-col gap-3">
        {/* User info */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[2px] border-black bg-neo-cyan shadow-[1px_1px_0_0_#000]">
            <User size={14} />
          </div>
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <>
                <div className="h-3 w-24 animate-pulse rounded bg-black/20" />
                <div className="mt-1 h-2 w-32 animate-pulse rounded bg-black/10" />
              </>
            ) : displayName ? (
              <>
                <p className="truncate text-xs font-black">{displayName}</p>
                <p className="truncate font-mono text-[10px] text-black/50">
                  {user?.email}
                </p>
              </>
            ) : (
              <p className="font-mono text-[10px] text-black/50">Not signed in</p>
            )}
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={() => logout()}
          className="flex w-full items-center justify-center gap-3 border-[2px] border-black bg-white px-3 py-2 text-sm font-bold text-black shadow-[2px_2px_0_0_#000] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:bg-neo-lime hover:shadow-[4px_4px_0_0_#000]"
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
