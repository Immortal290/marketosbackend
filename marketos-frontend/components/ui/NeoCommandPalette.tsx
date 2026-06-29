"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Search, LayoutDashboard, List, Palette, BarChart2, Users, Settings, Bell, DollarSign, Contact } from "lucide-react";

export function NeoCommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-none border-[3px] border-black bg-neo-surface p-0 shadow-[8px_8px_0_0_#000] outline-none"
      overlayClassName="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
    >
      <div className="flex items-center border-b-[3px] border-black px-4 py-3">
        <Search className="mr-3 h-5 w-5 text-black" />
        <Command.Input 
          placeholder="Type a command or search..." 
          className="w-full bg-transparent font-mono text-base font-bold text-black placeholder:text-black/50 focus:outline-none"
        />
      </div>
      <Command.List className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
        <Command.Empty className="py-6 text-center font-mono text-sm font-bold text-black/70">No results found.</Command.Empty>
        
        <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-black/50">
          <Command.Item onSelect={() => runCommand(() => router.push("/dashboard"))} className="flex cursor-pointer items-center gap-3 rounded-none border-2 border-transparent px-3 py-2 font-bold transition-colors aria-selected:border-black aria-selected:bg-neo-yellow aria-selected:shadow-[2px_2px_0_0_#000]">
            <LayoutDashboard className="h-4 w-4" /> Mission Control
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/campaigns"))} className="flex cursor-pointer items-center gap-3 rounded-none border-2 border-transparent px-3 py-2 font-bold transition-colors aria-selected:border-black aria-selected:bg-neo-cyan aria-selected:shadow-[2px_2px_0_0_#000]">
            <List className="h-4 w-4" /> Campaigns
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/creative-studio"))} className="flex cursor-pointer items-center gap-3 rounded-none border-2 border-transparent px-3 py-2 font-bold transition-colors aria-selected:border-black aria-selected:bg-neo-pink aria-selected:shadow-[2px_2px_0_0_#000]">
            <Palette className="h-4 w-4" /> Creative Studio
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/reports"))} className="flex cursor-pointer items-center gap-3 rounded-none border-2 border-transparent px-3 py-2 font-bold transition-colors aria-selected:border-black aria-selected:bg-neo-lime aria-selected:shadow-[2px_2px_0_0_#000]">
            <BarChart2 className="h-4 w-4" /> Reports
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/audience"))} className="flex cursor-pointer items-center gap-3 rounded-none border-2 border-transparent px-3 py-2 font-bold transition-colors aria-selected:border-black aria-selected:bg-neo-yellow aria-selected:shadow-[2px_2px_0_0_#000]">
            <Users className="h-4 w-4" /> Audience
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/contacts"))} className="flex cursor-pointer items-center gap-3 rounded-none border-2 border-transparent px-3 py-2 font-bold transition-colors aria-selected:border-black aria-selected:bg-neo-cyan aria-selected:shadow-[2px_2px_0_0_#000]">
            <Contact className="h-4 w-4" /> Contacts
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/finance"))} className="flex cursor-pointer items-center gap-3 rounded-none border-2 border-transparent px-3 py-2 font-bold transition-colors aria-selected:border-black aria-selected:bg-neo-pink aria-selected:shadow-[2px_2px_0_0_#000]">
            <DollarSign className="h-4 w-4" /> Finance & ROI
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/monitoring"))} className="flex cursor-pointer items-center gap-3 rounded-none border-2 border-transparent px-3 py-2 font-bold transition-colors aria-selected:border-black aria-selected:bg-neo-lime aria-selected:shadow-[2px_2px_0_0_#000]">
            <Bell className="h-4 w-4" /> Alerts
          </Command.Item>
          <Command.Item onSelect={() => runCommand(() => router.push("/settings"))} className="flex cursor-pointer items-center gap-3 rounded-none border-2 border-transparent px-3 py-2 font-bold transition-colors aria-selected:border-black aria-selected:bg-neo-yellow aria-selected:shadow-[2px_2px_0_0_#000]">
            <Settings className="h-4 w-4" /> Settings
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
