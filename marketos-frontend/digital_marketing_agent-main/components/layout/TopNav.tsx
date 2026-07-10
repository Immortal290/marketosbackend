"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Menu, X, Search, List, FileText, Save, Palette,
  BarChart2, TrendingUp, Target, Radio, Filter, Map as MapIcon, Users,
  Contact, DollarSign, Bell, Settings as SettingsIcon, ChevronRight, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/cn";
import { NeoButton } from "@/components/ui/NeoButton";
import { primaryNav } from "@/lib/marketing";

const menuGroups = [
  {
    title: "Campaigns",
    items: [
      { href: "/campaigns/views", label: "All Campaigns", icon: List },
      { href: "/campaigns/templates", label: "Campaign Templates", icon: FileText },
      { href: "/campaigns/drafts", label: "Campaign Drafts", icon: Save },
      { href: "/creative-studio", label: "Creative Studio", icon: Palette },
    ]
  },
  {
    title: "Insights & Analytics",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart2 },
      { href: "/analytics-pipeline", label: "Pipeline Analytics", icon: TrendingUp },
      { href: "/analytics-attribution", label: "Attribution Analytics", icon: Target },
      { href: "/analytics-channel", label: "Channel Analytics", icon: Radio },
      { href: "/analytics-funnel", label: "Funnel Analytics", icon: Filter },
      { href: "/analytics-journey", label: "Journey Analytics", icon: MapIcon },
      { href: "/analytics-cohort", label: "Cohort Analysis", icon: Users },
    ]
  },
  {
    title: "Management",
    items: [
      { href: "/contacts", label: "Contacts", icon: Contact },
      { href: "/competitive-intelligence", label: "Competitive Intel", icon: Search },
      { href: "/finance", label: "Finance & ROI", icon: DollarSign },
      { href: "/monitoring", label: "Monitoring", icon: Bell },
      { href: "/settings", label: "Settings", icon: SettingsIcon },
    ]
  }
];

export function TopNav() {
  const pathname = usePathname();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "MarketOS";
  const [open, setOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const appMenuRef = useRef<HTMLDivElement>(null);

  // Close app menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (appMenuRef.current && !appMenuRef.current.contains(event.target as Node)) {
        setAppMenuOpen(false);
      }
    }

    if (appMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      // Reset search after animation out
      setTimeout(() => setSearchQuery(""), 200);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [appMenuOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(group => group.items.length > 0);

  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-black bg-neo-yellow">
      <div className="mx-auto flex max-w-full items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="font-display text-2xl font-black uppercase tracking-tight"
        >
          {appName}
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-6 lg:flex">
          <Link
            href="/dashboard"
            className={cn(
              "font-mono text-sm font-bold uppercase",
              isActive("/dashboard")
                ? "border-[3px] border-black bg-neo-pink px-2 py-1 shadow-[2px_2px_0_0_#000]"
                : "px-2 py-1 hover:underline",
            )}
          >
            Dashboard
          </Link>

          {/* Product Dropdown */}
          <div className="group relative">
            <button className="flex items-center gap-1 px-2 py-1 font-mono text-sm font-bold uppercase hover:underline">
              Product <ChevronDown size={14} />
            </button>
            <div className="absolute left-0 top-full hidden w-48 flex-col border-[3px] border-black bg-white shadow-[4px_4px_0_0_#000] group-hover:flex z-50">
              <Link href="/platform" className="border-b-[2px] border-black px-4 py-3 font-mono text-sm font-bold uppercase hover:bg-neo-yellow">Platform</Link>
              <Link href="/agents" className="border-b-[2px] border-black px-4 py-3 font-mono text-sm font-bold uppercase hover:bg-neo-yellow">Agents</Link>
              <Link href="/solutions" className="px-4 py-3 font-mono text-sm font-bold uppercase hover:bg-neo-yellow">Solutions</Link>
            </div>
          </div>

          {/* Workspace Dropdown */}
          <div className="group relative">
            <button className="flex items-center gap-1 px-2 py-1 font-mono text-sm font-bold uppercase hover:underline">
              Workspace <ChevronDown size={14} />
            </button>
            <div className="absolute left-0 top-full hidden w-48 flex-col border-[3px] border-black bg-white shadow-[4px_4px_0_0_#000] group-hover:flex z-50">
              <Link href="/campaigns" className="border-b-[2px] border-black px-4 py-3 font-mono text-sm font-bold uppercase hover:bg-neo-yellow">Campaigns</Link>
              <Link href="/audience" className="px-4 py-3 font-mono text-sm font-bold uppercase hover:bg-neo-yellow">Audience</Link>
            </div>
          </div>

          <Link
            href="/analytics"
            className={cn(
              "font-mono text-sm font-bold uppercase",
              isActive("/analytics")
                ? "border-[3px] border-black bg-neo-pink px-2 py-1 shadow-[2px_2px_0_0_#000]"
                : "px-2 py-1 hover:underline",
            )}
          >
            Analytics
          </Link>

          {/* Learn Dropdown */}
          <div className="group relative">
            <button className="flex items-center gap-1 px-2 py-1 font-mono text-sm font-bold uppercase hover:underline">
              Learn <ChevronDown size={14} />
            </button>
            <div className="absolute left-0 top-full hidden w-48 flex-col border-[3px] border-black bg-white shadow-[4px_4px_0_0_#000] group-hover:flex z-50">
              <Link href="/resources" className="border-b-[2px] border-black px-4 py-3 font-mono text-sm font-bold uppercase hover:bg-neo-yellow">Resources</Link>
              <Link href="/company" className="px-4 py-3 font-mono text-sm font-bold uppercase hover:bg-neo-yellow">Company</Link>
            </div>
          </div>

          <Link
            href="/pricing"
            className={cn(
              "font-mono text-sm font-bold uppercase",
              isActive("/pricing")
                ? "border-[3px] border-black bg-neo-pink px-2 py-1 shadow-[2px_2px_0_0_#000]"
                : "px-2 py-1 hover:underline",
            )}
          >
            Pricing
          </Link>
        </nav>

        <div className="hidden items-center gap-6 lg:flex">
          {/* App Menu Button (Hamburger for Desktop) */}
          <div className="relative" ref={appMenuRef}>
            <button
              type="button"
              aria-label="Toggle app menu"
              onClick={() => setAppMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-neo-cyan shadow-[3px_3px_0_0_#000] transition-transform hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              {appMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Desktop App Menu Mega Dropdown */}
            {appMenuOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-[600px] border-[3px] border-black bg-neo-surface shadow-[6px_6px_0_0_#000]">
                <div className="flex flex-col">
                  {/* Header & Search */}
                  <div className="border-b-[3px] border-black bg-neo-yellow px-4 py-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-display text-sm font-black uppercase tracking-tight">
                        Application Menu
                      </p>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50" />
                      <input 
                        type="text" 
                        placeholder="Search menu..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full border-[2px] border-black bg-white py-2 pl-9 pr-4 font-mono text-sm shadow-[2px_2px_0_0_#000] outline-none placeholder:text-black/50 focus:shadow-[4px_4px_0_0_#000]"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Mega Menu Grid */}
                  <div className="max-h-[60vh] overflow-y-auto p-4">
                    {filteredGroups.length === 0 ? (
                      <div className="py-8 text-center font-mono text-sm text-black/60">
                        No results found for &quot;{searchQuery}&quot;
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        {filteredGroups.map((group) => (
                          <div key={group.title} className={cn(
                            "flex flex-col",
                            // Make specific large groups span full width if needed, but 2 cols is fine for now
                          )}>
                            <h3 className="mb-2 font-mono text-xs font-bold uppercase text-black/50">
                              {group.title}
                            </h3>
                            <div className="flex flex-col gap-1">
                              {group.items.map((item) => (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  onClick={() => setAppMenuOpen(false)}
                                  className={cn(
                                    "group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-bold text-black transition-all hover:bg-neo-pink hover:translate-x-1",
                                    isActive(item.href) && "bg-neo-yellow"
                                  )}
                                >
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border-2 border-black bg-white shadow-[1px_1px_0_0_#000] group-hover:bg-neo-cyan group-hover:shadow-[2px_2px_0_0_#000]">
                                    <item.icon size={14} />
                                  </div>
                                  {item.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Footer Action */}
                  <div className="border-t-[3px] border-black bg-neo-bg px-4 py-3">
                     <Link
                       href="/settings"
                       onClick={() => setAppMenuOpen(false)}
                       className="group flex w-full items-center justify-between font-mono text-sm font-bold uppercase hover:underline"
                     >
                       <span>All Application Settings</span>
                       <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                     </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="ml-2 flex items-center gap-3 border-l-[3px] border-black pl-8">
            <Link href="/login">
              <NeoButton variant="ghost" size="sm">
                Login
              </NeoButton>
            </Link>
            <Link href="/signup">
              <NeoButton variant="primary" size="sm">
                Start Free Trial
              </NeoButton>
            </Link>
          </div>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-neo-surface shadow-[3px_3px_0_0_#000] lg:hidden"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open ? (
        <div className="border-t-[3px] border-black bg-neo-surface lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 max-h-[80vh] overflow-y-auto">
            <p className="font-mono text-[10px] font-bold uppercase text-black/60">
              Marketing
            </p>
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-[3px] border-black bg-neo-bg px-3 py-2 font-mono text-sm font-bold uppercase shadow-[3px_3px_0_0_#000]"
              >
                {item.label}
              </Link>
            ))}
            
            <div className="mt-4 mb-2 h-[3px] w-full bg-black/10"></div>
            
            <p className="font-mono text-[10px] font-bold uppercase text-black/60">
              Application
            </p>
            
            {menuGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-2">
                <p className="mt-2 font-mono text-[10px] font-bold uppercase text-black/40">
                  {group.title}
                </p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 border-[3px] border-black bg-neo-bg px-3 py-2 text-sm font-bold shadow-[3px_3px_0_0_#000]"
                  >
                    <item.icon size={16} />
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}

            <div className="mt-4 flex gap-2">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                <NeoButton variant="ghost" size="sm" fullWidth>
                  Login
                </NeoButton>
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                <NeoButton variant="primary" size="sm" fullWidth>
                  Start Free Trial
                </NeoButton>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
