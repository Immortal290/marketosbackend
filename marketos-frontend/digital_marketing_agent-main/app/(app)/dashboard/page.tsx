"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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
  Terminal,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Brain,
  GitBranch,
  FileText,
  Cpu,
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

// ── Stage event types ─────────────────────────────────────────────────────────

type StageEvent = {
  stage:     "INIT" | "GLM_REASONING" | "AB_TEST" | "AGENT_EXEC" | "SYNTHESIS" | "COMPLETE" | "error";
  agent:     string;
  status:    "starting" | "running" | "completed" | "error" | "skipped";
  detail:    string;
  data:      Record<string, any>;
  timestamp: string;
};

const STAGE_ICONS: Record<string, React.ReactNode> = {
  INIT:         <Cpu     className="w-4 h-4" />,
  GLM_REASONING:<Brain   className="w-4 h-4" />,
  AB_TEST:      <GitBranch className="w-4 h-4" />,
  AGENT_EXEC:   <Bot     className="w-4 h-4" />,
  SYNTHESIS:    <FileText className="w-4 h-4" />,
  COMPLETE:     <CheckCircle2 className="w-4 h-4" />,
};

const STAGE_COLORS: Record<string, string> = {
  INIT:          "text-neo-cyan",
  GLM_REASONING: "text-neo-pink",
  AB_TEST:       "text-yellow-500",
  AGENT_EXEC:    "text-neo-lime",
  SYNTHESIS:     "text-purple-400",
  COMPLETE:      "text-green-400",
};

// User-friendly stage labels (no model names exposed)
const STAGE_LABELS: Record<string, string> = {
  INIT:          "Initialising",
  GLM_REASONING: "Intent Analysis",
  AB_TEST:       "A/B Testing",
  AGENT_EXEC:    "Agent Processing",
  SYNTHESIS:     "Report Generation",
  COMPLETE:      "Complete",
};

function DecryptingText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  
  useEffect(() => {
    let iteration = 0;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
    const interval = setInterval(() => {
      setDisplayed(
        text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
            if (index < iteration) return text[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );
      if (iteration >= text.length) clearInterval(interval);
      iteration += 1 / 2;
    }, 20);
    return () => clearInterval(interval);
  }, [text]);

  return <span>{displayed}</span>;
}

// ── Stage-aware terminal stream ───────────────────────────────────────────────

function OrchestratorTerminal({
  isExecuting,
  events,
  documentation,
}: {
  isExecuting:   boolean;
  events:        StageEvent[];
  documentation: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events]);

  if (!isExecuting && events.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Terminal log */}
      <div
        ref={containerRef}
        className="p-4 rounded-none border-[3px] border-neo-ink bg-neo-surface font-mono text-sm h-72 overflow-y-auto shadow-neo-sm relative"
      >
        <div className="sticky top-0 flex justify-between items-center mb-3 pb-2 bg-neo-surface border-b border-neo-ink/30 z-10">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-neo-pink animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-neo-pink">AI Agent Pipeline — Processing</span>
          </div>
          {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-neo-cyan" />}
        </div>

        <div className="flex flex-col gap-2">
          {events.map((ev, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className={`mt-0.5 flex-shrink-0 ${STAGE_COLORS[ev.stage] || "text-neo-cyan"}`}>
                {STAGE_ICONS[ev.stage] || <span>&gt;</span>}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neo-ink/50">{STAGE_LABELS[ev.stage] || ev.stage}</span>
                  <span className="font-bold text-neo-ink text-xs">{ev.agent}</span>
                  <span className={`text-[10px] uppercase font-bold px-1 rounded ${
                    ev.status === "completed" ? "bg-green-500/20 text-green-400" :
                    ev.status === "running"   ? "bg-blue-500/20 text-neo-cyan" :
                    ev.status === "error"     ? "bg-red-500/20 text-red-400" :
                    ev.status === "skipped"   ? "bg-gray-500/20 text-gray-400" :
                    "bg-yellow-500/20 text-yellow-400"
                  }`}>{ev.status}</span>
                  {ev.status === "running" && <Loader2 className="w-3 h-3 animate-spin text-neo-cyan" />}
                  {ev.status === "completed" && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                </div>
                <span className="text-neo-ink/70 text-xs break-all">
                  {i === events.length - 1 && isExecuting
                    ? <DecryptingText text={ev.detail} />
                    : ev.detail}
                </span>
                {/* Show A/B result inline */}
                {ev.stage === "AB_TEST" && ev.status === "completed" && ev.data?.ab_result && (
                  <div className="mt-1 flex gap-2 flex-wrap">
                    <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1 rounded font-bold">
                      A/B: {ev.data.ab_result.decision?.toUpperCase()}
                    </span>
                    {ev.data.ab_result.winner_id && (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-1 rounded font-bold">
                        Winner: {ev.data.ab_result.winner_id}
                      </span>
                    )}
                  </div>
                )}
                {/* Show intent + agents on GLM completed */}
                {ev.stage === "GLM_REASONING" && ev.status === "completed" && ev.data?.agents && (
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {(ev.data.agents as string[]).map(a => (
                      <span key={a} className="text-[10px] bg-neo-pink/20 text-neo-pink px-1 rounded">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isExecuting && (
            <div className="flex gap-2">
              <span className="text-neo-cyan">&gt;</span>
              <span className="animate-pulse text-neo-cyan">_</span>
            </div>
          )}
        </div>
      </div>

      {/* Documentation panel — appears after SYNTHESIS completes */}
      {documentation && (
        <div className="border-[3px] border-neo-ink bg-white shadow-neo-sm">
          <div className="flex items-center gap-2 px-4 py-3 bg-neo-pink border-b-[3px] border-neo-ink">
            <FileText className="w-4 h-4" />
            <span className="font-display font-black text-sm uppercase">AI Structured Report</span>
          </div>
          <div className="px-4 py-4 max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap font-mono text-xs text-neo-ink leading-relaxed">
              {documentation}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MissionControlPage() {
  const router = useRouter();
  const [commandInput, setCommandInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [sseEvents, setSseEvents] = useState<StageEvent[]>([]);
  const [documentation, setDocumentation] = useState("");
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const [redirectionData, setRedirectionData] = useState<{
    active: boolean;
    taskId: string;
    intent: string;
    prompt: string;
    routeTo: string;
    agents: string;
  } | null>(null);

  const handleExecute = async () => {
    if (!commandInput.trim()) return;
    setIsExecuting(true);
    setShowSuggestions(false);
    setSseEvents([]);
    setDocumentation("");

    const prompt = commandInput;

    try {
      const res = await fetch("/api/v1/ai-command-center/command", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt, workspaceId: "00000000-0000-0000-0000-000000000000" }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      readerRef.current  = reader;
      const decoder      = new TextDecoder();
      let buffer         = "";
      let finalRouteTo   = "/dashboard";
      let finalIntent    = "GENERAL_QUERY";
      let finalTaskId    = `task-${Date.now()}`;
      let finalAgents    = "General AI";

      const processChunk = async () => {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "{\"status\":\"done\"}") continue;
              try {
                const ev: StageEvent = JSON.parse(jsonStr);
                setSseEvents(prev => [...prev, ev]);

                if (ev.stage === "COMPLETE" && ev.data) {
                  if (ev.data.routeTo)       finalRouteTo = ev.data.routeTo;
                  if (ev.data.intent)        finalIntent  = ev.data.intent;
                  if (ev.data.session_id)    finalTaskId  = ev.data.session_id;
                  if (ev.data.documentation) setDocumentation(ev.data.documentation);
                }
                if (ev.stage === "SYNTHESIS" && ev.status === "completed" && ev.data?.documentation) {
                  setDocumentation(ev.data.documentation);
                }
                if (ev.stage === "GLM_REASONING" && ev.status === "completed" && ev.data?.agents) {
                  finalAgents = (ev.data.agents as string[]).join(", ");
                  if (ev.data.routeTo) finalRouteTo = ev.data.routeTo;
                  if (ev.data.intent)  finalIntent  = ev.data.intent;
                }
              } catch (_e) {}
            }
          }
        }

        // Done
        toast.success("AI pipeline completed", { description: `Intent: ${finalIntent}` });
        setIsExecuting(false);

        if (finalRouteTo && finalRouteTo !== "/dashboard") {
          setRedirectionData({
            active: true,
            taskId: finalTaskId,
            intent: finalIntent,
            prompt,
            routeTo: finalRouteTo,
            agents: finalAgents,
          });
        }
        setCommandInput("");
      };

      await processChunk();
    } catch (err) {
      console.warn("SSE stream error:", err);
      setIsExecuting(false);
      toast.error("Pipeline error — please try again");
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

      <NeoModal
        isOpen={!!redirectionData?.active}
        onClose={() => setRedirectionData(null)}
        title="🚀 AI Command Completed — Route Guidance"
      >
        {redirectionData && (
          <div className="flex flex-col gap-4">
            <div className="border-[3px] border-black bg-neo-yellow/30 p-4 shadow-[2px_2px_0_0_#000]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold uppercase tracking-tight text-black/70">Detected Intent</span>
                <NeoBadge tone="success">{redirectionData.intent}</NeoBadge>
              </div>
              <p className="font-medium text-black italic">&quot;{redirectionData.prompt}&quot;</p>
              <div className="mt-3 flex items-center justify-between font-mono text-xs text-black/70 border-t-2 border-black/10 pt-2">
                <span>Task ID: {redirectionData.taskId}</span>
                <span>Agents: {redirectionData.agents}</span>
              </div>
            </div>

            <div className="border-[3px] border-black bg-neo-surface p-4 shadow-[2px_2px_0_0_#000]">
              <h4 className="font-display font-black text-lg mb-2 flex items-center gap-2 text-black">
                <Sparkles className="h-5 w-5 text-neo-pink" />
                Guiding Changes Prepared
              </h4>
              <p className="font-medium text-black/80 text-sm leading-relaxed">
                Your AI agents have pre-configured actionable steps and parameters for the <span className="font-bold underline">{redirectionData.routeTo.replace('/', '').toUpperCase() || 'DESTINATION'}</span> module based on your prompt. Proceeding will launch the module with a live AI guidance pop-up and interactive checklist.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <NeoButton
                variant="primary"
                className="flex-1 justify-center"
                onClick={() => {
                  sessionStorage.setItem(
                    "marketos_ai_guidance",
                    JSON.stringify({
                      ...redirectionData,
                      timestamp: Date.now(),
                    })
                  );
                  const target = redirectionData.routeTo;
                  setRedirectionData(null);
                  router.push(target);
                }}
              >
                Proceed to {redirectionData.routeTo.replace('/', '').toUpperCase() || 'Module'} with AI Guidance
                <ArrowRight className="ml-2 h-4 w-4 inline" />
              </NeoButton>
              <NeoButton
                variant="ghost"
                onClick={() => setRedirectionData(null)}
              >
                Stay Here
              </NeoButton>
            </div>
          </div>
        )}
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
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
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
                  className="relative z-20 flex items-center gap-2 border-neo border-neo-ink bg-neo-cyan px-6 py-3 font-display font-black uppercase shadow-neo-sm transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-neo active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
                  {isExecuting ? "Sending..." : "Execute"}
                </button>
              </div>

              {/* Natural Language Suggestions */}
              {showSuggestions && !isExecuting && (
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
        
        <OrchestratorTerminal
          isExecuting={isExecuting}
          events={sseEvents}
          documentation={documentation}
        />
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
