"use client";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { AgentApprovalCard, AgentOutput } from "@/components/ui/AgentApprovalPanel";
import {
  Sparkles, Zap, Bot, TrendingUp, ArrowRight, Send, Lightbulb,
  Loader2, CheckCircle2, Brain, GitBranch, FileText, Cpu,
  Terminal, Download, ChevronDown, ChevronUp, CheckSquare, XSquare, Users,
  History, Clock, RefreshCw, ChevronRight, Activity, Radio, X,
} from "lucide-react";

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

/* ── Interactive Pipeline Tracker ─────────────────────────────────────────── */
function PipelineLog({ events, isExecuting }: { events: StageEvent[]; isExecuting: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [events]);

  const planEvent = events.find(e => e.stage === "GLM_REASONING" && e.status === "completed");
  const agentPlan: string[] = (planEvent?.data?.agents as string[]) || [];
  const intentLabel: string = (planEvent?.data?.intent as string) || "";
  const intentConfidence: number = (planEvent?.data?.confidence as number) || 0;

  const completedAgents = new Set(
    events
      .filter(e => e.stage === "AGENT_EXEC" && e.status === "completed")
      .map(e => e.agent || "")
  );
  const runningAgent = events.findLast
    ? events.findLast(e => e.stage === "AGENT_EXEC" && e.status === "running")?.agent || null
    : [...events].reverse().find(e => e.stage === "AGENT_EXEC" && e.status === "running")?.agent || null;

  const currentStage = events.length > 0 ? events[events.length - 1].stage : null;
  const overallProgress = agentPlan.length > 0 ? (completedAgents.size / agentPlan.length) * 100 : 0;

  if (!isExecuting && events.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 mt-4 w-full">

      {/* Live Status Banner */}
      <div className="flex items-center justify-between border-[3px] border-black bg-gray-900 px-5 py-3 shadow-[4px_4px_0_0_#000]">
        <div className="flex items-center gap-3 flex-wrap">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse flex-shrink-0" />
          <span className="font-mono text-xs font-bold uppercase text-cyan-400 tracking-widest">
            {isExecuting ? "Pipeline Running" : "Pipeline Complete"}
          </span>
          {currentStage && (
            <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold uppercase ${
              STAGE_COLORS[currentStage] || "text-white"
            } bg-white/10`}>
              {STAGE_LABELS[currentStage] || currentStage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
          <span className="font-mono text-xs text-gray-400">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Intent & Agent Plan */}
      {agentPlan.length > 0 && (
        <div className="border-[3px] border-black bg-neo-pink shadow-[4px_4px_0_0_#000] p-4">
          <div className="flex items-center gap-3 mb-3">
            <Brain className="w-5 h-5 text-black flex-shrink-0" />
            <div>
              <span className="font-mono text-[10px] font-bold uppercase text-black/60">Detected Intent</span>
              <p className="font-display font-black text-sm uppercase">
                {intentLabel}
                {intentConfidence > 0 && (
                  <span className="ml-2 font-mono text-xs font-normal text-black/60 normal-case">
                    ({Math.round(intentConfidence * 100)}% confidence)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {agentPlan.map((agentName, i) => {
              const isDone    = completedAgents.has(agentName);
              const isRunning = runningAgent === agentName;
              return (
                <span
                  key={i}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border-2 border-black transition-all duration-300 ${
                    isDone    ? "bg-green-400 text-black shadow-[2px_2px_0_0_#000]" :
                    isRunning ? "bg-cyan-400 text-black shadow-[3px_3px_0_0_#000] scale-105 animate-pulse" :
                               "bg-white/60 text-black/50"
                  }`}
                >
                  {isDone    ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                   isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                               <Bot className="w-3.5 h-3.5" />}
                  {agentName}
                  {isRunning && <span className="text-[9px] uppercase tracking-wider">· working</span>}
                </span>
              );
            })}
          </div>
          <div className="space-y-1">
            <div className="h-2 bg-black/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-black transition-all duration-700 ease-out rounded-full"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <div className="flex justify-between">
              <p className="font-mono text-[10px] text-black/60">
                {completedAgents.size} / {agentPlan.length} agents complete
              </p>
              <p className="font-mono text-[10px] font-bold text-black/80">
                {Math.round(overallProgress)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Log */}
      <div ref={ref} className="p-4 border-[3px] border-black bg-gray-900 font-mono text-sm h-64 overflow-y-auto shadow-[4px_4px_0_0_#000]">
        <div className="sticky top-0 flex justify-between items-center mb-3 pb-2 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-pink-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-pink-400">AI Agent Pipeline Log</span>
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
                {ev.stage === "AGENT_EXEC" && ev.status === "completed" && ev.data?.result_preview && (
                  <span className="text-[10px] text-lime-400 font-mono mt-0.5 break-all">
                    ↳ {String(ev.data.result_preview).slice(0, 150)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {isExecuting && <div className="flex gap-2"><span className="text-cyan-400">{">"}</span><span className="animate-pulse text-cyan-400">_</span></div>}
        </div>
      </div>
    </div>
  );
}

/* ── Final Report Panel ────────────────────────────────────────────────────── */
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
    <div className="border-[3px] border-black bg-white shadow-[4px_4px_0_0_#000]">
      <div className="flex items-center justify-between px-4 py-3 bg-neo-pink border-b-[3px] border-black">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="w-5 h-5 text-black flex-shrink-0" />
          <span className="font-display font-black text-sm uppercase">AI Structured Report</span>
          <span className="flex items-center gap-1 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3" /> {approvalStats.approved}/{approvalStats.total} Approved
          </span>
          {approvalStats.rejected > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">{approvalStats.rejected} Rejected</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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

/* ── Approval Summary Bar ──────────────────────────────────────────────────── */
function ApprovalBar({ outputs, onApproveAll, onRejectAll }: {
  outputs: AgentOutput[];
  onApproveAll: () => void;
  onRejectAll: () => void;
}) {
  const pending  = outputs.filter(o => o.status === "pending").length;
  const approved = outputs.filter(o => o.status === "approved" || o.status === "edited").length;
  const rejected = outputs.filter(o => o.status === "rejected").length;
  return (
    <div className="flex items-center justify-between bg-neo-yellow border-[3px] border-black px-4 py-3 shadow-[3px_3px_0_0_#000] flex-wrap gap-3">
      <div className="flex items-center gap-4 font-mono text-sm font-bold flex-wrap">
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

import { AgentApprovalModal, PendingApprovalData } from "@/components/ui/AgentApprovalModal";
import { TargetAudienceModal, AudienceData } from "@/components/ui/TargetAudienceModal";
import { io as socketIOClient } from "socket.io-client";
import { useSearchParams } from "next/navigation";

/* ══ MAIN PAGE ═══════════════════════════════════════════════════════════════ */
export default function MissionControlPage() {
  const searchParams = useSearchParams();
  const [commandInput, setCommandInput]   = useState(searchParams?.get("cmd") ? decodeURIComponent(searchParams.get("cmd")!) : "");
  const [checkpointId, setCheckpointId]   = useState<string | null>(searchParams?.get("checkpoint") || null);
  const [showSuggestions, setShowSugg]    = useState(false);
  const [isExecuting, setIsExecuting]     = useState(false);
  const [sseEvents, setSseEvents]         = useState<StageEvent[]>([]);
  const [agentOutputs, setAgentOutputs]   = useState<AgentOutput[]>([]);
  const [documentation, setDocumentation] = useState("");
  const [lastPrompt, setLastPrompt]       = useState("");

  const [isAudienceModalOpen, setIsAudienceModalOpen] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<PendingApprovalData | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [liveActivities, setLiveActivities] = useState<string[]>([]);
  const [agentStatusMap, setAgentStatusMap] = useState<Record<string, { status: string; task: string }>>({});
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Socket.io real-time listener
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
    const socket = socketIOClient(socketUrl, {
      transports: ["websocket", "polling"],
    });

    socket.on("workflow:step_update", (data: any) => {
      const { runId, agentName, status, output, requiresApproval } = data;
      setAgentStatusMap((prev) => ({
        ...prev,
        [agentName]: {
          status: status === "running" ? "RUNNING" : status === "awaiting_approval" ? "AWAITING APPROVAL" : status === "done" ? "DONE" : "IDLE",
          task: status === "running" ? `Executing task for workflow run ${runId.slice(0, 8)}...` : `Completed workflow step`,
        },
      }));
      const activityMsg = `[${agentName}] ${status.toUpperCase()} — Workflow run ${runId.slice(0, 8)}`;
      setLiveActivities((prev) => [activityMsg, ...prev.slice(0, 15)]);
      if (status === "awaiting_approval" || requiresApproval) {
        setPendingApproval({
          runId,
          agentName,
          output: output || { status: "awaiting_approval", note: "Human authorization required before proceeding" },
        });
        setIsApprovalModalOpen(true);
      }
    });

    socket.on("workflow:awaiting_approval", (data: any) => {
      setPendingApproval({
        runId: data.runId,
        agentName: data.agentName,
        output: data.output || {},
      });
      setIsApprovalModalOpen(true);
    });

    socket.on("agentEvent", (eventData: any) => {
      const payload = eventData?.payload;
      if (payload && payload.message) {
        setLiveActivities((prev) => [`[${payload.agent_name || "Agent"}] ${payload.message}`, ...prev.slice(0, 15)]);
      }
    });

    socket.on("workflow:update", (data: any) => {
      if (data?.event === "COMPLETED" || data?.event === "FAILED" || data?.event === "CREATED") {
        setHistoryRefreshKey(k => k + 1);
      }
      if (data?.event === "COMPLETED") {
        const msg = `✅ Workflow completed: "${(data.command || "").slice(0, 60)}${(data.command||'').length > 60 ? '...' : ''}")`;
        setLiveActivities(prev => [msg, ...prev.slice(0, 15)]);
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  const handleApprove = (key: string) =>
    setAgentOutputs(prev => prev.map(o => o.agentKey === key ? { ...o, status: "approved" } : o));
  const handleReject = (key: string) =>
    setAgentOutputs(prev => prev.map(o => o.agentKey === key ? { ...o, status: "rejected" } : o));
  const handleEdit = (key: string, content: string) =>
    setAgentOutputs(prev => prev.map(o => o.agentKey === key ? { ...o, status: "edited", editedContent: content } : o));
  const approveAll = () => setAgentOutputs(prev => prev.map(o => ({ ...o, status: "approved" })));
  const rejectAll  = () => setAgentOutputs(prev => prev.map(o => ({ ...o, status: "rejected" })));

  const handleExecute = async (audienceData?: AudienceData, forceExecute: boolean = false) => {
    const prompt = audienceData?.query || commandInput;
    if (!prompt.trim()) {
      toast.error("Please enter a campaign prompt in the command bar.");
      return;
    }
    if (!forceExecute && !audienceData) {
      setIsAudienceModalOpen(true);
      return;
    }
    setShowSugg(false);
    setSseEvents([]);
    setAgentOutputs([]);
    setDocumentation("");
    setLastPrompt(prompt);
    setIsExecuting(true);

    try {
      fetch("/api/v1/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: prompt,
          recipient_email: audienceData?.recipientEmail,
          recipient_phone: audienceData?.recipientPhone,
          target_audience: audienceData?.targetAudience,
          sender_name: audienceData?.senderName,
          company_name: audienceData?.companyName,
          channels: audienceData?.channels,
        }),
      }).catch((err) => console.warn("[WorkflowEngine] Start workflow fetch warning:", err));

      let res = await fetch("/api/v1/ai-command-center/query/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: prompt,
          prompt: prompt,
          workspace_id: "00000000-0000-0000-0000-000000000000",
          recipient_email: audienceData?.recipientEmail,
          recipient_phone: audienceData?.recipientPhone,
          target_audience: audienceData?.targetAudience,
          sender_name: audienceData?.senderName,
          company_name: audienceData?.companyName,
          channels: audienceData?.channels || [],
          llm_model: audienceData?.llmModel,
          llm_api_key: audienceData?.llmApiKey,
          image_model: audienceData?.imageModel,
          image_api_key: audienceData?.imageApiKey,
        }),
      }).catch(() => null);

      if (!res || !res.ok || !res.body) {
        res = await fetch("/api/v1/ai-command-center/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: prompt,
            prompt: prompt,
            workspace_id: "00000000-0000-0000-0000-000000000000",
            recipient_email: audienceData?.recipientEmail,
            recipient_phone: audienceData?.recipientPhone,
            target_audience: audienceData?.targetAudience,
            sender_name: audienceData?.senderName,
            company_name: audienceData?.companyName,
            channels: audienceData?.channels,
            llm_model: audienceData?.llmModel,
            llm_api_key: audienceData?.llmApiKey,
            image_model: audienceData?.imageModel,
            image_api_key: audienceData?.imageApiKey,
          }),
        });
      }

      if (!res || !res.ok || !res.body) {
        throw new Error(`HTTP ${res?.status} — ${await res?.text().catch(() => "")}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event:") && line.includes("end")) continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '{"status":"done"}') continue;

          try {
            const ev: StageEvent = JSON.parse(jsonStr);
            setSseEvents(prev => [...prev, ev]);

            if (ev.stage === "AB_TEST" && ev.status === "completed" && ev.data?.ab_result) {
              const abResult = ev.data.ab_result;
              const output: AgentOutput = {
                agentKey:  "ab_test",
                agentName: "A/B Test Agent",
                elapsedMs: 0,
                result:    abResult,
                status:    "pending",
              };
              setAgentOutputs(prev => {
                const exists = prev.find(o => o.agentKey === "ab_test");
                return exists ? prev : [output, ...prev];
              });
            }

            if (ev.stage === "AGENT_EXEC" && ev.status === "completed") {
              const agentKey = (ev.data?.agent_key as string)
                || (ev.agent || "")
                    .toLowerCase()
                    .replace(/ agent$/i, "")
                    .replace(/\s+/g, "_")
                || "unknown";
              const result = ev.data?.result ?? { status: "completed", detail: ev.detail };
              const output: AgentOutput = {
                agentKey,
                agentName:  ev.agent || agentKey,
                elapsedMs:  (ev.data?.elapsed_ms as number) || 0,
                result,
                status:     "pending",
              };
              setAgentOutputs(prev => {
                const exists = prev.find(o => o.agentKey === agentKey);
                return exists ? prev : [...prev, output];
              });
            }

            if (
              (ev.stage === "SYNTHESIS" || ev.stage === "COMPLETE") &&
              ev.status === "completed" &&
              ev.data?.documentation
            ) {
              setDocumentation(ev.data.documentation as string);
            }

            if (ev.error) {
              toast.error(`Pipeline error: ${ev.error}`);
              setIsExecuting(false);
              return;
            }
          } catch (_) {
            // Skip malformed SSE lines
          }
        }
      }

      toast.success("Pipeline complete — review agent outputs below");
      setCommandInput("");

      // Auto-save run to campaign history
      try {
        await fetch("/api/v1/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            documentation: "",
            channels: audienceData?.channels || [],
            recipientEmail: audienceData?.recipientEmail || "",
            recipientPhone: audienceData?.recipientPhone || "",
            status: "completed",
          }),
        }).catch(() => null);
      } catch (_) { /* best-effort save */ }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Pipeline error — ${msg}`);
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
    <div className="theme-pastel flex flex-col gap-6 p-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Mission Control</h1>
          <p className="mt-1 font-mono text-xs text-black/60">Command centre for AI-powered marketing operations</p>
        </div>
        <NeoBadge tone="success"><span className="mr-2">●</span>All Systems Operational</NeoBadge>
      </div>

      {/* ── Checkpoint Banner ── */}
      {checkpointId && commandInput && (
        <div className="flex items-center gap-3 border-[3px] border-black bg-neo-yellow shadow-[4px_4px_0_0_#000] px-4 py-3">
          <History className="w-4 h-4 text-black flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-black text-xs uppercase">Resumed from Checkpoint</p>
            <p className="font-mono text-[11px] text-black/70 truncate">Command pre-loaded from history ID: {checkpointId.slice(0, 8)}…</p>
          </div>
          <button
            onClick={() => setCheckpointId(null)}
            className="font-mono text-[10px] font-bold uppercase border-2 border-black bg-black text-white px-2 py-1 hover:bg-black/80 transition-colors flex-shrink-0"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* ── AI Command Bar ── */}
      <section className="flex flex-col gap-0">
        <NeoCard title="AI Command Bar" accent="yellow">
          <div className="flex flex-col gap-4">
            <p className="font-medium text-black/70">Tell MarketOS what you want to accomplish in natural language</p>

            {/* Input row */}
            <div className="relative">
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <input
                  type="text"
                  value={commandInput}
                  onChange={e => { setCommandInput(e.target.value); setShowSugg(e.target.value.length > 0); }}
                  onFocus={() => setShowSugg(commandInput.length > 0)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 200)}
                  onKeyDown={e => { if (e.key === "Enter") handleExecute(); }}
                  placeholder='Try: "Create a campaign targeting enterprise CMOs on LinkedIn"'
                  disabled={isExecuting}
                  className="flex-1 min-w-0 border-neo border-neo-ink bg-neo-surface px-4 py-3 font-mono text-sm font-medium shadow-neo-sm focus:outline-none focus:shadow-neo disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setIsAudienceModalOpen(true)}
                  disabled={isExecuting}
                  className="flex items-center gap-2 border-neo border-neo-ink bg-neo-yellow px-4 py-3 font-display font-black text-xs uppercase shadow-neo-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo active:translate-x-px active:translate-y-px active:shadow-none disabled:opacity-50 whitespace-nowrap"
                  title="Configure target audience and brand parameters"
                >
                  <Users className="h-4 w-4 flex-shrink-0" /> Target Audience
                </button>
                <button
                  onClick={() => handleExecute()}
                  disabled={isExecuting}
                  className="flex items-center gap-2 border-neo border-neo-ink bg-neo-cyan px-6 py-3 font-display font-black uppercase shadow-neo-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-neo active:translate-x-px active:translate-y-px active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isExecuting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  {isExecuting ? "Running..." : "Execute"}
                </button>
              </div>

              {/* Autocomplete suggestions dropdown */}
              {showSuggestions && !isExecuting && (
                <div className="absolute top-full z-20 mt-1 w-full border-neo border-neo-ink bg-neo-surface shadow-neo-sm">
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

            {/* Quick example tags */}
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

        {/* ── Live Pipeline Log (renders directly below command bar, no overlap) ── */}
        {(isExecuting || sseEvents.length > 0) && (
          <div className="w-full mt-0">
            <PipelineLog events={sseEvents} isExecuting={isExecuting} />
          </div>
        )}
      </section>

      {/* ── Live Activity Feed (only shown when socket events arrive) ── */}
      {liveActivities.length > 0 && (
        <section>
          <div className="border-[3px] border-black bg-gray-900 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-black">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-lime-400 animate-pulse" />
                <span className="font-display font-black text-sm uppercase text-white">Live Activity</span>
              </div>
              <button
                onClick={() => setLiveActivities([])}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-white/5">
              {liveActivities.map((msg, i) => (
                <div key={i} className="px-4 py-2 font-mono text-xs text-gray-300">
                  {msg}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Agent Outputs — Review & Approve ── */}
      {agentOutputs.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
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

          <div className="flex flex-col gap-4">
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
            <div className="flex items-center gap-4 p-4 border-[3px] border-black bg-neo-lime shadow-[4px_4px_0_0_#000] flex-wrap">
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

      {/* ── Structured Report ── */}
      {documentation && (
        <section>
          <ReportPanel doc={documentation} prompt={lastPrompt} approvalStats={approvalStats} />
        </section>
      )}

      {/* ── Agent Approval Modal ── */}
      <AgentApprovalModal
        data={pendingApproval}
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        onDecision={(decision, runId) => {
          console.log(`[WorkflowDecision] Run ${runId} decision: ${decision}`);
        }}
      />

      {/* ── Target Audience & Live Send Pop-up ── */}
      <TargetAudienceModal
        isOpen={isAudienceModalOpen}
        onClose={() => setIsAudienceModalOpen(false)}
        initialPrompt={commandInput}
        onLaunch={(audienceData) => {
          setCommandInput(audienceData.query);
          handleExecute(audienceData, true);
        }}
      />
    </div>
  );
}
