"use client";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { AgentApprovalCard, AgentOutput } from "@/components/ui/AgentApprovalPanel";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import {
  Sparkles, Zap, Bot, TrendingUp, ArrowRight, Send, Lightbulb,
  Loader2, CheckCircle2, Brain, GitBranch, FileText, Cpu,
  Terminal, Download, ChevronDown, ChevronUp, CheckSquare, XSquare,
} from "lucide-react";

const kpis = [
  { label: "Active Campaigns", value: "12", tone: "info" as const },
  { label: "Signups (24h)", value: "487", tone: "success" as const },
  { label: "Spend (24h)", value: "$3,240", tone: "info" as const },
  { label: "Agents Online", value: "17", tone: "success" as const },
];
const agents = [
  { name: "Supervisor Agent", status: "Running", task: "Monitoring all operations" },
  { name: "Content Agent",    status: "Running", task: "Generating blog posts" },
  { name: "Analytics Agent",  status: "Running", task: "Analysing performance" },
];
const activity = [
  "Optimisation Agent reallocated $200 from Ad Set A to Ad Set C.",
  "Content Agent published 3 new variants for the landing page.",
  "Analytics Agent flagged a 12% CTR drop on LinkedIn.",
];
const agentCommands = [
  "Create a LinkedIn campaign targeting enterprise CMOs",
  "Generate 10 email subject line variants",
  "Analyse top performing campaigns this month",
  "Optimise ad spend across all channels",
  "Create a campaign performance report",
  "Generate social media posts for product launch",
];

type StageEvent = {
  stage?: string;
  agent?: string;
  status?: string;
  detail?: string;
  data?: Record<string, any>;
  error?: string;
};

const STAGE_ICONS: Record<string, React.ReactNode> = {
  INIT:          <Cpu className="w-4 h-4" />,
  GLM_REASONING: <Brain className="w-4 h-4" />,
  AB_TEST:       <GitBranch className="w-4 h-4" />,
  AGENT_EXEC:    <Bot className="w-4 h-4" />,
  SYNTHESIS:     <FileText className="w-4 h-4" />,
  COMPLETE:      <CheckCircle2 className="w-4 h-4" />,
};
const STAGE_COLORS: Record<string, string> = {
  INIT: "text-cyan-400", GLM_REASONING: "text-pink-400", AB_TEST: "text-yellow-400",
  AGENT_EXEC: "text-lime-400", SYNTHESIS: "text-purple-400", COMPLETE: "text-green-400",
};
const STAGE_LABELS: Record<string, string> = {
  INIT: "Initialising", GLM_REASONING: "Intent Analysis", AB_TEST: "A/B Testing",
  AGENT_EXEC: "Agent Processing", SYNTHESIS: "Report Generation", COMPLETE: "Complete",
};

/* ── Small terminal log ──────────────────────────────────────────────────── */
function PipelineLog({ events, isExecuting }: { events: StageEvent[]; isExecuting: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [events]);
  if (!isExecuting && events.length === 0) return null;
  return (
    <div ref={ref} className="p-4 rounded-none border-[3px] border-black bg-gray-900 font-mono text-sm h-56 overflow-y-auto shadow-[4px_4px_0_0_#000]">
      <div className="sticky top-0 flex justify-between items-center mb-3 pb-2 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-pink-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-pink-400">AI Agent Pipeline</span>
        </div>
        {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
      </div>
      <div className="flex flex-col gap-2">
        {events.map((ev, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span className={`mt-0.5 flex-shrink-0 ${ev.error ? "text-red-500" : (ev.stage ? STAGE_COLORS[ev.stage] || "text-cyan-400" : "text-cyan-400")}`}>
              {ev.stage ? STAGE_ICONS[ev.stage] || ">" : ">"}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{ev.stage ? STAGE_LABELS[ev.stage] || ev.stage : ""}</span>
                <span className="font-bold text-white text-xs">{ev.agent}</span>
                <span className={`text-[10px] uppercase font-bold px-1 rounded ${
                  ev.status==="completed" ? "bg-green-500/20 text-green-400" :
                  ev.status==="running"   ? "bg-blue-500/20 text-cyan-400" :
                  ev.status==="error"     ? "bg-red-500/20 text-red-400" :
                  ev.status==="skipped"   ? "bg-gray-500/20 text-gray-400" :
                  "bg-yellow-500/20 text-yellow-400"}`}>{ev.status}</span>
              </div>
              <span className="text-xs text-gray-300 break-all">{ev.error || ev.detail}</span>
            </div>
          </div>
        ))}
        {isExecuting && <div className="flex gap-2"><span className="text-cyan-400">{">"}</span><span className="animate-pulse text-cyan-400">_</span></div>}
      </div>
    </div>
  );
}

/* ── Final Report Panel ──────────────────────────────────────────────────── */
function ReportPanel({ doc, prompt, approvalStats }: { doc: string; prompt: string; approvalStats: { approved: number; rejected: number; total: number } }) {
  const [open, setOpen] = useState(true);
  const download = () => {
    const blob = new Blob([doc], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(prompt || "report").toLowerCase().replace(/[^a-z0-9]+/g,"_").slice(0,40)}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="border-[3px] border-black bg-white shadow-[4px_4px_0_0_#000] mt-2">
      <div className="flex items-center justify-between px-4 py-3 bg-neo-pink border-b-[3px] border-black">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-black" />
          <span className="font-display font-black text-sm uppercase">AI Structured Report</span>
          <span className="flex items-center gap-1 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3" /> {approvalStats.approved}/{approvalStats.total} Approved
          </span>
          {approvalStats.rejected > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">{approvalStats.rejected} Rejected</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={download} className="flex items-center gap-2 bg-black text-white px-3 py-1.5 text-xs font-bold uppercase hover:bg-black/80 transition-colors">
            <Download className="w-3 h-3" /> Download
          </button>
          <button onClick={() => setOpen(!open)} className="p-1 hover:bg-black/10 rounded">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 py-4 max-h-96 overflow-y-auto">
          <pre className="whitespace-pre-wrap font-mono text-xs text-black leading-relaxed">{doc}</pre>
        </div>
      )}
    </div>
  );
}

/* ── Approval Summary Bar ────────────────────────────────────────────────── */
function ApprovalBar({ outputs, onApproveAll, onRejectAll }: {
  outputs: AgentOutput[];
  onApproveAll: () => void;
  onRejectAll: () => void;
}) {
  const pending  = outputs.filter(o => o.status === "pending").length;
  const approved = outputs.filter(o => o.status === "approved" || o.status === "edited").length;
  const rejected = outputs.filter(o => o.status === "rejected").length;
  return (
    <div className="flex items-center justify-between bg-neo-yellow border-[3px] border-black px-4 py-3 shadow-[3px_3px_0_0_#000]">
      <div className="flex items-center gap-4 font-mono text-sm font-bold">
        <span className="text-gray-700">{outputs.length} Agents</span>
        <span className="text-green-700">✓ {approved} Approved</span>
        {rejected > 0 && <span className="text-red-700">✗ {rejected} Rejected</span>}
        {pending > 0 && <span className="text-amber-700">⏳ {pending} Pending</span>}
      </div>
      <div className="flex gap-2">
        <button onClick={onApproveAll} className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 text-xs font-bold uppercase border-[2px] border-black shadow-[2px_2px_0_0_#000] hover:shadow-[3px_3px_0_0_#000] hover:-translate-x-px hover:-translate-y-px active:shadow-none transition-all">
          <CheckSquare className="w-3 h-3" /> Approve All
        </button>
        <button onClick={onRejectAll} className="flex items-center gap-1 bg-red-400 text-white px-3 py-1.5 text-xs font-bold uppercase border-[2px] border-black shadow-[2px_2px_0_0_#000] hover:shadow-[3px_3px_0_0_#000] hover:-translate-x-px hover:-translate-y-px active:shadow-none transition-all">
          <XSquare className="w-3 h-3" /> Reject All
        </button>
      </div>
    </div>
  );
}

/* ══ MAIN PAGE ══════════════════════════════════════════════════════════════ */
export default function MissionControlPage() {
  const [commandInput, setCommandInput]   = useState("");
  const [showSuggestions, setShowSugg]    = useState(false);
  const [isExecuting, setIsExecuting]     = useState(false);
  const [sseEvents, setSseEvents]         = useState<StageEvent[]>([]);
  const [agentOutputs, setAgentOutputs]   = useState<AgentOutput[]>([]);
  const [documentation, setDocumentation] = useState("");
  const [lastPrompt, setLastPrompt]       = useState("");

  const { data: kpisData }    = useSWR("/dashboard/kpis?workspaceId=00000000-0000-0000-0000-000000000000", fetcher);
  const { data: agentsData }  = useSWR("/dashboard/agents?workspaceId=00000000-0000-0000-0000-000000000000", fetcher);
  const { data: activityData }= useSWR("/dashboard/activity?workspaceId=00000000-0000-0000-0000-000000000000", fetcher);

  const displayKpis = kpisData ? [
    { label: "Active Campaigns", value: kpisData.activeCampaigns?.toString() || "0", tone: "info" as const },
    { label: "Revenue Gen",      value: `$${(kpisData.revenueGenerated||0).toLocaleString()}`, tone: "success" as const },
    { label: "Leads Gen",        value: kpisData.leadsGenerated?.toLocaleString() || "0", tone: "info" as const },
    { label: "Agents Online",    value: kpisData.activeAgents?.toString() || "0", tone: "success" as const },
  ] : kpis;

  const handleApprove = (key: string) =>
    setAgentOutputs(prev => prev.map(o => o.agentKey === key ? { ...o, status: "approved" } : o));
  const handleReject = (key: string) =>
    setAgentOutputs(prev => prev.map(o => o.agentKey === key ? { ...o, status: "rejected" } : o));
  const handleEdit = (key: string, content: string) =>
    setAgentOutputs(prev => prev.map(o => o.agentKey === key ? { ...o, status: "edited", editedContent: content } : o));
  const approveAll = () => setAgentOutputs(prev => prev.map(o => ({ ...o, status: "approved" })));
  const rejectAll  = () => setAgentOutputs(prev => prev.map(o => ({ ...o, status: "rejected" })));

  const handleExecute = async () => {
    if (!commandInput.trim()) return;
    const prompt = commandInput;
    setIsExecuting(true);
    setShowSugg(false);
    setSseEvents([]);
    setAgentOutputs([]);
    setDocumentation("");
    setLastPrompt(prompt);

    try {
      const res = await fetch("/api/v1/ai-command-center/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, workspaceId: "00000000-0000-0000-0000-000000000000" }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '{"status":"done"}') continue;
          try {
            const ev: StageEvent = JSON.parse(jsonStr);
            setSseEvents(prev => [...prev, ev]);

            // Collect full agent outputs for approval panel
            if (ev.stage === "AGENT_EXEC" && ev.status === "completed" && ev.data?.result) {
              const agentKey = ev.data.agent_key || ev.agent?.toLowerCase().replace(/ agent$/,"").replace(/ /,"_") || "unknown";
              const output: AgentOutput = {
                agentKey,
                agentName: ev.agent || agentKey,
                elapsedMs: ev.data.elapsed_ms || 0,
                result: ev.data.result,
                status: "pending",
              };
              setAgentOutputs(prev => {
                const exists = prev.find(o => o.agentKey === agentKey);
                return exists ? prev : [...prev, output];
              });
            }
            // AB_TEST result
            if (ev.stage === "AB_TEST" && ev.status === "completed" && ev.data?.ab_result) {
              const output: AgentOutput = {
                agentKey: "ab_test",
                agentName: "A/B Test Agent",
                elapsedMs: 0,
                result: ev.data.ab_result,
                status: "pending",
              };
              setAgentOutputs(prev => {
                const exists = prev.find(o => o.agentKey === "ab_test");
                return exists ? prev : [output, ...prev];
              });
            }
            if (ev.stage === "SYNTHESIS" && ev.status === "completed" && ev.data?.documentation) {
              setDocumentation(ev.data.documentation);
            }
            if (ev.stage === "COMPLETE" && ev.data?.documentation) {
              setDocumentation(ev.data.documentation);
            }
            if (ev.error) { setIsExecuting(false); toast.error("Pipeline error"); return; }
          } catch (_) {}
        }
      }
      toast.success("Pipeline complete — review agent outputs below");
      setCommandInput("");
    } catch (err) {
      toast.error("Pipeline error — please try again");
    } finally {
      setIsExecuting(false);
    }
  };

  const approvalStats = {
    total:    agentOutputs.length,
    approved: agentOutputs.filter(o => o.status === "approved" || o.status === "edited").length,
    rejected: agentOutputs.filter(o => o.status === "rejected").length,
  };

  return (
    <div className="theme-pastel flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Mission Control</h1>
          <p className="mt-1 font-mono text-xs text-black/60">Command centre for AI-powered marketing operations</p>
        </div>
        <NeoBadge tone="success"><span className="mr-2">●</span>All Systems Operational</NeoBadge>
      </div>

      {/* AI Command Bar */}
      <section>
        <NeoCard title="AI Command Bar" accent="yellow">
          <div className="flex flex-col gap-3">
            <p className="font-medium text-black/70">Tell MarketOS what you want to accomplish in natural language</p>
            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commandInput}
                  onChange={e => { setCommandInput(e.target.value); setShowSugg(e.target.value.length > 0); }}
                  onFocus={() => setShowSugg(commandInput.length > 0)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 200)}
                  onKeyDown={e => { if (e.key === "Enter") handleExecute(); }}
                  placeholder='Try: "Create a campaign targeting enterprise CMOs on LinkedIn"'
                  disabled={isExecuting}
                  className="flex-1 border-neo border-neo-ink bg-neo-surface px-4 py-3 font-mono text-sm font-medium shadow-neo-sm focus:outline-none focus:shadow-neo disabled:opacity-60"
                />
                <button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="flex items-center gap-2 border-neo border-neo-ink bg-neo-cyan px-6 py-3 font-display font-black uppercase shadow-neo-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo active:translate-x-px active:translate-y-px active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExecuting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  {isExecuting ? "Running..." : "Execute"}
                </button>
              </div>
              {showSuggestions && !isExecuting && (
                <div className="absolute top-full z-10 mt-2 w-full border-neo border-neo-ink bg-neo-surface shadow-neo-sm">
                  <div className="border-b-neo border-neo-ink bg-neo-pink px-4 py-2">
                    <p className="font-mono text-xs font-bold uppercase">Suggested Commands</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {agentCommands.filter(c => c.toLowerCase().includes(commandInput.toLowerCase())).map((cmd, i) => (
                      <button key={i} onClick={() => { setCommandInput(cmd); setShowSugg(false); }}
                        className="flex w-full items-center gap-3 border-b-neo border-neo-ink px-4 py-3 text-left transition-colors hover:bg-neo-yellow last:border-0">
                        <Sparkles className="h-4 w-4 flex-shrink-0" />
                        <span className="font-medium">{cmd}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <p className="w-full font-mono text-[10px] uppercase text-black/60">Quick examples:</p>
              {["Campaign Creation","Agent Commands","Content Generation","Performance Analysis"].map(tag => (
                <button key={tag} onClick={() => setCommandInput(tag.toLowerCase())}
                  className="border-neo border-neo-ink bg-neo-surface px-2 py-1 font-mono text-xs font-bold uppercase transition-all hover:bg-neo-cyan hover:shadow-neo-sm">
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </NeoCard>

        {/* Pipeline Log */}
        {(isExecuting || sseEvents.length > 0) && (
          <div className="mt-4">
            <PipelineLog events={sseEvents} isExecuting={isExecuting} />
          </div>
        )}
      </section>

      {/* Agent Approval Section */}
      {agentOutputs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl font-black uppercase flex items-center gap-2">
                <Bot className="w-6 h-6" /> Agent Outputs — Review &amp; Approve
              </h2>
              <p className="font-mono text-xs text-black/60 mt-1">
                Review each agent's output. Approve, edit, or reject before finalising the campaign.
              </p>
            </div>
          </div>

          <ApprovalBar outputs={agentOutputs} onApproveAll={approveAll} onRejectAll={rejectAll} />

          <div className="flex flex-col gap-4 mt-4">
            {agentOutputs.map(output => (
              <AgentApprovalCard
                key={output.agentKey}
                output={output}
                onApprove={handleApprove}
                onReject={handleReject}
                onEdit={handleEdit}
              />
            ))}
          </div>

          {/* Finalise Button */}
          {agentOutputs.length > 0 && !isExecuting && (
            <div className="mt-6 flex items-center gap-4 p-4 border-[3px] border-black bg-neo-lime shadow-[4px_4px_0_0_#000]">
              <div className="flex-1">
                <p className="font-display font-black text-sm uppercase">Ready to Finalise?</p>
                <p className="font-mono text-xs text-black/70">
                  {approvalStats.approved} of {approvalStats.total} agents approved.
                  {approvalStats.rejected > 0 ? ` ${approvalStats.rejected} rejected agents will be skipped.` : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  const summary = agentOutputs.map(o => `${o.agentName}: ${o.status.toUpperCase()}`).join(", ");
                  toast.success("Campaign finalised!", { description: summary });
                }}
                className="flex items-center gap-2 bg-black text-white px-6 py-3 font-display font-black uppercase text-sm border-[2px] border-black shadow-[3px_3px_0_0_#333] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#333] transition-all"
              >
                <CheckCircle2 className="w-5 h-5" /> Finalise Campaign
              </button>
            </div>
          )}
        </section>
      )}

      {/* Structured Report */}
      {documentation && (
        <section>
          <ReportPanel doc={documentation} prompt={lastPrompt} approvalStats={approvalStats} />
        </section>
      )}

      {/* KPIs */}
      <section className="grid gap-4 md:grid-cols-4">
        {displayKpis.map((kpi: any) => (
          <NeoCard key={kpi.label} title={kpi.label} accent="cyan">
            <div className="flex items-center justify-between">
              <span className="font-display text-3xl font-black">{kpi.value}</span>
              <NeoBadge tone={kpi.tone}>Live</NeoBadge>
            </div>
          </NeoCard>
        ))}
      </section>

      {/* Agents & Activity */}
      <section className="grid gap-4 md:grid-cols-2">
        <NeoCard title="Autonomous Agents" accent="pink">
          <ul className="flex flex-col gap-2">
            {(agentsData || agents).map((agent: any) => (
              <li key={agent.name} className="flex flex-col gap-1 border-b-neo border-neo-ink pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{agent.name}</span>
                  <NeoBadge tone={agent.status === "ERROR" ? "danger" : "success"}>{agent.status}</NeoBadge>
                </div>
                <p className="font-mono text-xs text-black/60">{agent.currentTask || agent.task}</p>
              </li>
            ))}
          </ul>
        </NeoCard>
        <NeoCard title="Recent Activity" accent="lime">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {(activityData ? activityData.map((a: any) => a.message) : activity).map((item: any, i: number) => (
              <li key={i} className="font-medium">{item}</li>
            ))}
          </ul>
        </NeoCard>
      </section>

      {/* Prompt Examples */}
      <section>
        <NeoCard title="Natural Language Prompt Examples" accent="cyan">
          <div className="flex items-start gap-3 mb-4">
            <Lightbulb className="h-6 w-6 flex-shrink-0 text-black" />
            <p className="font-medium text-black/70">Examples of what you can ask the AI Command Bar:</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {agentCommands.map((cmd, i) => (
              <button key={i} onClick={() => setCommandInput(cmd)}
                className="flex items-start gap-3 border-neo border-neo-ink bg-neo-surface p-3 text-left transition-all hover:-translate-x-px hover:-translate-y-px hover:bg-neo-lime hover:shadow-neo-sm">
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
