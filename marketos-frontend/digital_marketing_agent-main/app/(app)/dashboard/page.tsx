"use client";

import { useState } from "react";
import { toast } from "sonner";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { NeoInput } from "@/components/ui/NeoInput";
import { 
  Sparkles, 
  Zap, 
  Bot, 
  TrendingUp,
  ArrowRight,
  Send,
  Lightbulb,
} from "lucide-react";
import useSWR from "swr";
import { fetcher, apiRequest } from "@/lib/api";

const kpis = [
  { label: "Active Campaigns", value: "12", tone: "info" as const },
  { label: "Signups (24h)", value: "487", tone: "success" as const },
  { label: "Spend (24h)", value: "$3,240", tone: "info" as const },
  { label: "Agents Online", value: "17", tone: "success" as const },
];

const agents = [
  { name: "Supervisor Agent", status: "Running", task: "Monitoring all operations" },
  { name: "Content Agent", status: "Running", task: "Generating blog posts" },
  { name: "Ads Agent", status: "Running", task: "Optimizing LinkedIn ads" },
  { name: "Analytics Agent", status: "Running", task: "Analyzing performance data" },
  { name: "Optimization Agent", status: "Running", task: "Budget reallocation" },
  { name: "Reporting Agent", status: "Running", task: "Compiling reports" },
];

const activity = [
  "Optimization Agent reallocated $200 from Ad Set A to Ad Set C.",
  "Content Agent published 3 new variants for the webinar landing page.",
  "Analytics Agent flagged a 12% CTR drop on the LinkedIn campaign.",
  "Reporting Agent compiled the daily performance digest.",
];

const quickActions = [
  { 
    label: "Create New Campaign", 
    description: "Launch a multi-channel campaign",
    icon: Sparkles,
    command: "create campaign",
  },
  { 
    label: "Generate Content", 
    description: "AI-powered content creation",
    icon: Zap,
    command: "generate content",
  },
  { 
    label: "Analyze Performance", 
    description: "Get insights on campaign performance",
    icon: TrendingUp,
    command: "analyze campaigns",
  },
  { 
    label: "Deploy Agent", 
    description: "Launch an AI agent for a task",
    icon: Bot,
    command: "deploy agent",
  },
];

const agentCommands = [
  "Create a LinkedIn campaign targeting enterprise CMOs",
  "Generate 10 email subject line variants",
  "Analyze top performing campaigns this month",
  "Optimize ad spend across all channels",
  "Create a campaign performance report",
  "Generate social media posts for product launch",
];

export default function MissionControlPage() {
  const [commandInput, setCommandInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    if (!commandInput.trim()) return;
    setIsExecuting(true);
    try {
      const response = await apiRequest<any>("/ai-command-center/command", {
        method: "POST",
        body: JSON.stringify({
          prompt: commandInput,
          workspaceId: "00000000-0000-0000-0000-000000000000"
        })
      });
      toast.success("Command processing", {
        description: `Intent detected: ${response.data?.intent || 'Unknown'}`
      });
      setCommandInput("");
    } catch (err) {
      toast.error("Failed to execute command", {
        description: "Please check your connection and try again."
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const { data: kpisData } = useSWR("/dashboard/kpis?workspaceId=00000000-0000-0000-0000-000000000000", fetcher);
  const { data: agentsData } = useSWR("/dashboard/agents?workspaceId=00000000-0000-0000-0000-000000000000", fetcher);
  const { data: activityData } = useSWR("/dashboard/activity?workspaceId=00000000-0000-0000-0000-000000000000", fetcher);

  const displayKpis = kpisData ? [
    { label: "Active Campaigns", value: kpisData.activeCampaigns?.toString() || "0", tone: "info" as const },
    { label: "Revenue Gen", value: `$${(kpisData.revenueGenerated || 0).toLocaleString()}`, tone: "success" as const },
    { label: "Leads Gen", value: kpisData.leadsGenerated?.toLocaleString() || "0", tone: "info" as const },
    { label: "Agents Online", value: kpisData.activeAgents?.toString() || "0", tone: "success" as const },
  ] : kpis;

  const displayAgents = agentsData || agents;
  const displayActivity = activityData ? activityData.map((a: any) => a.message) : activity;

  return (
    <div className="theme-pastel flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Mission Control
          </h1>
          <p className="mt-1 font-mono text-xs text-black/60">
            Command center for AI-powered marketing operations
          </p>
        </div>
        <NeoBadge tone="success">
          <span className="mr-2">●</span> All Systems Operational
        </NeoBadge>
      </div>

      <NeoModal
        isOpen={activeModal !== null}
        onClose={() => setActiveModal(null)}
        title={activeModal || ""}
      >
        <div className="flex flex-col gap-4">
          <p className="font-medium text-black/70 mb-2">Configure and execute this action.</p>
          <NeoInput label="Additional Context (Optional)" placeholder="e.g. Target audience, specific goals..." />
          <NeoButton variant="primary" className="mt-4" onClick={() => setActiveModal(null)}>
            Confirm Action
          </NeoButton>
        </div>
      </NeoModal>

      {/* AI Command Bar */}
      <section>
        <NeoCard title="AI Command Bar" accent="yellow">
          <div className="flex flex-col gap-3">
            <p className="font-medium text-black/70">
              Tell MarketOS what you want to accomplish in natural language
            </p>
            
            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => {
                    setCommandInput(e.target.value);
                    setShowSuggestions(e.target.value.length > 0);
                  }}
                  onFocus={() => setShowSuggestions(commandInput.length > 0)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleExecute();
                    }
                  }}
                  placeholder='Try: "Create a campaign targeting enterprise CMOs on LinkedIn"'
                  className="flex-1 border-neo border-neo-ink bg-neo-surface px-4 py-3 font-mono text-sm font-medium shadow-neo-sm focus:outline-none focus:shadow-neo"
                />
                <button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="flex items-center gap-2 border-neo border-neo-ink bg-neo-cyan px-6 py-3 font-display font-black uppercase shadow-neo-sm transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
                  {isExecuting ? "Sending..." : "Execute"}
                </button>
              </div>

              {/* Natural Language Suggestions */}
              {showSuggestions && (
                <div className="absolute top-full z-10 mt-2 w-full border-neo border-neo-ink bg-neo-surface shadow-neo-sm">
                  <div className="border-b-neo border-neo-ink bg-neo-pink px-4 py-2">
                    <p className="font-mono text-xs font-bold uppercase">
                      Suggested Commands
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {agentCommands
                      .filter((cmd) =>
                        cmd.toLowerCase().includes(commandInput.toLowerCase())
                      )
                      .map((cmd, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setCommandInput(cmd);
                            setShowSuggestions(false);
                          }}
                          className="flex w-full items-center gap-3 border-b-neo border-neo-ink px-4 py-3 text-left transition-colors hover:bg-neo-yellow last:border-0"
                        >
                          <Sparkles className="h-4 w-4 flex-shrink-0" />
                          <span className="font-medium">{cmd}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <p className="w-full font-mono text-[10px] uppercase text-black/60">
                Quick examples:
              </p>
              {[
                "Campaign Creation",
                "Agent Commands",
                "Content Generation",
                "Performance Analysis",
              ].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setCommandInput(tag.toLowerCase())}
                  className="border-neo border-neo-ink bg-neo-surface px-2 py-1 font-mono text-xs font-bold uppercase transition-all hover:bg-neo-cyan hover:shadow-neo-sm"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </NeoCard>
      </section>

      {/* Quick Actions / Suggested Actions */}
      <section>
        <h2 className="mb-4 font-display text-xl font-black uppercase">
          Suggested Actions
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => setActiveModal(action.label)}
                className="group flex flex-col items-start gap-3 border-neo border-neo-ink bg-neo-surface p-4 text-left shadow-neo-sm transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:bg-neo-yellow hover:shadow-neo"
              >
                <div className="flex items-center justify-between w-full">
                  <Icon className="h-6 w-6" />
                  <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div>
                  <p className="font-display text-sm font-black uppercase">
                    {action.label}
                  </p>
                  <p className="mt-1 font-mono text-xs text-black/60">
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 md:grid-cols-4">
        {displayKpis.map((kpi: any) => (
          <NeoCard key={kpi.label} title={kpi.label} accent="cyan">
            <div className="flex items-center justify-between">
              <span className="font-display text-3xl font-black">
                {kpi.value}
              </span>
              <NeoBadge tone={kpi.tone}>Live</NeoBadge>
            </div>
          </NeoCard>
        ))}
      </section>

      {/* Agent Commands & Activity */}
      <section className="grid gap-4 md:grid-cols-2">
        <NeoCard title="Autonomous Agents" accent="pink">
          <ul className="flex flex-col gap-2">
            {displayAgents.map((agent: any) => (
              <li
                key={agent.name}
                className="flex flex-col gap-1 border-b-neo border-neo-ink pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{agent.name}</span>
                  <NeoBadge tone={agent.status === "ERROR" ? "danger" : "success"}>
                    {agent.status}
                  </NeoBadge>
                </div>
                <p className="font-mono text-xs text-black/60">{agent.currentTask || agent.task}</p>
              </li>
            ))}
          </ul>
        </NeoCard>

        <NeoCard title="Recent Activity" accent="lime">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {displayActivity.map((item: any, i: number) => (
              <li key={i} className="font-medium">
                {item}
              </li>
            ))}
          </ul>
        </NeoCard>
      </section>

      {/* Natural Language Prompt Examples */}
      <section>
        <NeoCard title="Natural Language Prompt Examples" accent="cyan">
          <div className="flex items-start gap-3 mb-4">
            <Lightbulb className="h-6 w-6 flex-shrink-0 text-black" />
            <p className="font-medium text-black/70">
              Here are some examples of what you can ask the AI Command Bar:
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {agentCommands.map((cmd, i) => (
              <button
                key={i}
                onClick={() => setCommandInput(cmd)}
                className="flex items-start gap-3 border-neo border-neo-ink bg-neo-surface p-3 text-left transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:bg-neo-lime hover:shadow-neo-sm"
              >
                <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="font-medium">{cmd}</span>
              </button>
            ))}
          </div>
        </NeoCard>
      </section>
    </div>
  );
}
