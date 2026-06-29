"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface NeoTabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export function NeoTabs({ tabs, defaultTab }: NeoTabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id);

  const activeContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className="flex flex-col">
      {/* Tab Headers */}
      <div className="flex flex-wrap gap-2 border-b-[3px] border-black bg-neo-surface p-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "border-[3px] border-black px-4 py-2 font-mono text-sm font-bold uppercase transition-all",
              activeTab === tab.id
                ? "bg-neo-yellow shadow-[3px_3px_0_0_#000]"
                : "bg-neo-surface shadow-[2px_2px_0_0_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_#000]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="border-[3px] border-t-0 border-black bg-neo-surface p-6">
        {activeContent}
      </div>
    </div>
  );
}
