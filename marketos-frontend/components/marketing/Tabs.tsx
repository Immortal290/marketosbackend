"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
}

export function Tabs({ tabs }: TabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "border-[3px] border-black rounded-none px-4 py-2 font-mono text-sm font-bold uppercase shadow-[3px_3px_0_0_#000] transition-transform",
                isActive
                  ? "bg-neo-pink translate-x-[-1px] translate-y-[-1px] shadow-[5px_5px_0_0_#000]"
                  : "bg-neo-surface hover:bg-neo-yellow",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="border-[3px] border-black bg-neo-surface p-6 shadow-[6px_6px_0_0_#000]">
        {active?.content}
      </div>
    </div>
  );
}
