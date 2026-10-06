"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { NeoCard } from "@/components/ui/NeoCard";
import {
  Zap, Bot, Send, Loader2, RefreshCw, CheckCircle2, AlertCircle,
  Activity, Radio, TrendingUp, Search, Filter, Eye, ChevronDown,
  XCircle, Download, Archive, FileText,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { io as socketIOClient } from "socket.io-client";

interface CampaignRun {
  id: string;
  prompt: string;
  status: string;
  channels: string[];
  recipientEmail: string | null;
  recipientPhone: string | null;
  documentation: string | null;
  agentOutputs: Record<string, any>;
  dispatchLog: any[] | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
  completed:         { label: "Completed",        cls: "bg-green-100 text-green-800 border-green-400",  icon: CheckCircle2 },
  dispatched:        { label: "Dispatched",       cls: "bg-blue-100 text-blue-800 border-blue-400",     icon: Send },
  running:           { label: "Running",          cls: "bg-cyan-100 text-cyan-800 border-cyan-400",     icon: Activity },
  awaiting_approval: { label: "Awaiting Approval", cls: "bg-yellow-100 text-yellow-800 border-yellow-400", icon: AlertCircle },
  failed:            { label: "Failed",           cls: "bg-red-100 text-red-800 border-red-400",        icon: XCircle },
  archived:          { label: "Archived",         cls: "bg-gray-100 text-gray-500 border-gray-300",     icon: Archive },
};

const ACCENT_CYCLE = ["yellow", "pink", "cyan", "lime"] as const;

const CHANNEL_EMOJIS: Record<string, string> = {
  email: "✉️", sms: "💬", whatsapp: "📱", social: "📡",
  linkedin: "🔗", google_ads: "🎯", meta: "📘", twitter: "🐦",
};

function formatAge(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function CampaignCard({ run, index, onView }: { run: CampaignRun; index: number; onView: () => void }) {
  const cfg = STATUS_CFG[run.status] || STATUS_CFG.completed;
  const StatusIcon = cfg.icon;
  const accent = ACCENT_CYCLE[index % ACCENT_CYCLE.length];
  const agentCount = Object.keys(run.agentOutputs || {}).length;
  const dispatchCount = run.dispatchLog?.length || 0;

  return (
    <div
      className="relative border-[3px] border-black bg-white p-5 shadow-[5px_5px_0_0_#000] hover:shadow-[7px_7px_0_0_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group"
      onClick={onView}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        accent === "yellow" ? "bg-neo-yellow" :
        accent === "pink"   ? "bg-neo-pink"   :
        accent === "cyan"   ? "bg-neo-cyan"   : "bg-neo-lime"
      }`} />
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 pt-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 border rounded font-mono ${cfg.cls}`}>
                <StatusIcon className="w-3 h-3" /> {cfg.label}
              </span>
              {agentCount > 0 && (
                <span className="flex items-center gap-1 font-mono text-[10px] text-purple-700 bg-purple-50 border border-purple-300 px-1.5 py-0.5 rounded">
                  <Bot className="w-3 h-3" /> {agentCount} agent{agentCount !== 1 ? "s" : ""}
                </span>
              )}
              {dispatchCount > 0 && (
                <span className="flex items-center gap-1 font-mono text-[10px] text-blue-700 bg-blue-50 border border-blue-300 px-1.5 py-0.5 rounded">
                  <Send className="w-3 h-3" /> {dispatchCount} dispatched
                </span>
              )}
            </div>
            <p className="font-mono text-sm font-bold text-black line-clamp-2 leading-snug">{run.prompt}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="flex-shrink-0 flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] hover:bg-gray-50 transition-all opacity-0 group-hover:opacity-100"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t-[2px] border-black/10 pt-3 sm:grid-cols-4">
          <div>
            <p className="font-mono text-[10px] uppercase text-black/50">Created</p>
            <p className="font-mono text-xs font-bold">{formatAge(run.createdAt)}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase text-black/50">Channels</p>
            <p className="font-mono text-xs font-bold">
              {run.channels.length > 0 ? run.channels.map(ch => CHANNEL_EMOJIS[ch] || ch).join(" ") : "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase text-black/50">Report</p>
            <p className="font-mono text-xs font-bold">{run.documentation ? "✅ Ready" : "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase text-black/50">Updated</p>
            <p className="font-mono text-xs font-bold">{formatAge(run.updatedAt)}</p>
          </div>
        </div>
        {run.channels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {run.channels.map((ch) => (
              <span key={ch} className="border-[2px] border-black/20 bg-neo-surface px-2 py-0.5 font-mono text-[10px] font-bold uppercase">{ch}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignDetailPanel({ run, onClose }: { run: CampaignRun; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"report" | "agents" | "dispatch">("report");
  const agentKeys = Object.keys(run.agentOutputs || {});

  const download = () => {
    if (!run.documentation) return;
    const blob = new Blob([run.documentation], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign_${run.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-6"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col border-[4px] border-black bg-white shadow-[12px_12px_0_0_#000] animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between border-b-[4px] border-black bg-gray-900 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-neo-cyan flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">Campaign Run · {run.id.slice(0, 8)}</p>
              <p className="font-mono text-sm text-white font-bold line-clamp-1">{run.prompt}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <span className={`text-[10px] font-bold px-2 py-1 border rounded font-mono uppercase ${STATUS_CFG[run.status]?.cls || ""}`}>{STATUS_CFG[run.status]?.label || run.status}</span>
            <button onClick={onClose} className="border-2 border-white/20 bg-transparent p-1.5 text-white hover:bg-white/10 transition-colors">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex border-b-[3px] border-black flex-shrink-0">
          {[
            { key: "report",   label: "AI Report",             icon: <FileText className="w-3.5 h-3.5" /> },
            { key: "agents",   label: `Agents (${agentKeys.length})`, icon: <Bot className="w-3.5 h-3.5" /> },
            { key: "dispatch", label: "Dispatch Log",          icon: <Send className="w-3.5 h-3.5" /> },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-1.5 px-4 py-3 font-mono text-xs font-bold uppercase border-r-[3px] border-black transition-colors ${
                activeTab === key ? "bg-neo-yellow text-black" : "bg-white text-black/50 hover:bg-gray-50"
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "report" && (
            run.documentation
              ? <pre className="whitespace-pre-wrap font-mono text-xs text-black leading-relaxed">{run.documentation}</pre>
              : <div className="flex flex-col items-center justify-center gap-3 py-16 text-black/30"><FileText className="w-12 h-12" /><p className="font-mono text-sm font-bold">No report generated for this run.</p></div>
          )}
          {activeTab === "agents" && (
            <div className="flex flex-col gap-3">
              {agentKeys.length === 0
                ? <div className="flex flex-col items-center justify-center gap-3 py-16 text-black/30"><Bot className="w-12 h-12" /><p className="font-mono text-sm font-bold">No agent outputs saved.</p></div>
                : agentKeys.map((k) => (
                    <div key={k} className="border-2 border-black shadow-[2px_2px_0_0_#000] p-4 bg-white">
                      <p className="font-mono text-xs font-bold uppercase mb-2 text-black">{k.replace(/_/g, " ")}</p>
                      <pre className="font-mono text-[11px] text-black whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                        {typeof run.agentOutputs[k] === "object" ? JSON.stringify(run.agentOutputs[k], null, 2) : String(run.agentOutputs[k])}
                      </pre>
                    </div>
                  ))
              }
            </div>
          )}
          {activeTab === "dispatch" && (
            <div className="flex flex-col gap-3">
              {(!run.dispatchLog || run.dispatchLog.length === 0)
                ? <div className="flex flex-col items-center justify-center gap-3 py-16 text-black/30"><Send className="w-12 h-12" /><p className="font-mono text-sm font-bold">Not dispatched yet.</p></div>
                : run.dispatchLog.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 border-2 border-black shadow-[2px_2px_0_0_#000] bg-white">
                      <div className="mt-0.5 flex-shrink-0"><Zap className="w-4 h-4 text-black" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-xs font-bold uppercase">{entry.channel}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded font-mono uppercase ${STATUS_CFG[entry.status]?.cls || ""}`}>{entry.status}</span>
                        </div>
                        <p className="font-mono text-[11px] text-black/70 break-all">{entry.detail}</p>
                        <p className="font-mono text-[9px] text-black/40 mt-1">{new Date(entry.sentAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))
              }
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 border-t-[3px] border-black px-5 py-3 bg-gray-50 flex-shrink-0 flex-wrap">
          <button
            onClick={download}
            disabled={!run.documentation}
            className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Download Report
          </button>
          <Link
            href={`/dashboard?cmd=${encodeURIComponent(run.prompt)}&checkpoint=${run.id}`}
            onClick={onClose}
            className="flex items-center gap-1.5 border-2 border-black bg-neo-yellow px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all"
          >
            <Zap className="w-3.5 h-3.5" /> Re-run Command
          </Link>
          <div className="flex-1" />
          <button onClick={onClose} className="font-mono text-xs font-bold uppercase text-black/40 hover:text-black transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const [runs, setRuns]           = useState<CampaignRun[]>([]);
  const [loading, setLoading]     = useState(true);
  const [total, setTotal]         = useState(0);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [page, setPage]           = useState(1);
  const [selectedRun, setSelected] = useState<CampaignRun | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [isLive, setIsLive]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiRequest<any>(`/history?${params.toString()}`);
      setRuns(res.data || []);
      setTotal(res.meta?.total || (res.data?.length ?? 0));
    } catch {
      setRuns([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const socketUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "http://localhost:3001";
    const socket = socketIOClient(socketUrl, { transports: ["websocket", "polling"] });

    socket.on("connect", () => setIsLive(true));
    socket.on("disconnect", () => setIsLive(false));

    socket.on("workflow:update", (data: any) => {
      if (data?.event === "COMPLETED" || data?.event === "FAILED" || data?.event === "CREATED") {
        setLiveCount(c => c + 1);
        void load();
      }
    });
    socket.on("workflow:step_update", (data: any) => {
      const { runId, status } = data;
      if (!runId) return;
      setRuns(prev => prev.map(r => r.id === runId ? { ...r, status: status === "done" ? "completed" : status } : r));
    });
    return () => { socket.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statTiles = [
    { label: "Total Campaigns", value: total,                                               accent: "yellow" },
    { label: "Completed",       value: runs.filter(r => r.status === "completed").length,   accent: "pink"   },
    { label: "Dispatched",      value: runs.filter(r => r.status === "dispatched").length,  accent: "cyan"   },
    { label: "With AI Report",  value: runs.filter(r => !!r.documentation).length,          accent: "lime"   },
  ];

  const STATUS_OPTIONS = ["all", "completed", "dispatched", "running", "awaiting_approval", "failed", "archived"];

  return (
    <div className="theme-pastel flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">All Campaigns</h1>
          <p className="mt-1 font-mono text-xs text-black/60">
            All AI campaign runs — synced in real-time from Mission Control.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-2 border-[2px] border-black px-3 py-1.5 shadow-[2px_2px_0_0_#000] transition-colors ${isLive ? "bg-neo-lime" : "bg-gray-100"}`}>
            <Radio className={`w-3.5 h-3.5 ${isLive ? "animate-pulse text-green-700" : "text-gray-400"}`} />
            <span className="font-mono text-[10px] font-bold uppercase">{isLive ? "Live Sync" : "Offline"}</span>
          </div>
          <button
            onClick={() => void load()}
            className="flex items-center gap-2 border-[3px] border-black bg-white px-4 py-2.5 font-mono text-xs font-bold uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000] transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 border-[3px] border-black bg-neo-cyan px-4 py-2.5 font-display font-black text-xs uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000] transition-all text-black"
          >
            <Zap className="w-4 h-4" /> New Campaign
          </Link>
        </div>
      </div>

      {/* Stats */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {statTiles.map(({ label, value, accent }) => (
          <NeoCard key={label} title={label} accent={accent as any}>
            <span className="font-display text-4xl font-black">{value}</span>
          </NeoCard>
        ))}
      </section>

      {/* Search + Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search campaigns by prompt…"
            className="w-full border-[3px] border-black pl-10 pr-4 py-3 font-mono text-sm shadow-[4px_4px_0_0_#000] focus:outline-none bg-white focus:border-neo-cyan"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="border-[3px] border-black pl-9 pr-8 py-3 font-mono text-sm shadow-[4px_4px_0_0_#000] bg-white focus:outline-none appearance-none cursor-pointer"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s === "all" ? "All Status" : s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-black/60" />
        </div>
      </div>

      {/* Live update banner */}
      {liveCount > 0 && (
        <div className="flex items-center gap-3 border-2 border-green-400 bg-green-50 px-4 py-2.5 shadow-[2px_2px_0_0_#000]">
          <Activity className="w-4 h-4 text-green-700 animate-pulse flex-shrink-0" />
          <span className="font-mono text-xs font-bold text-green-800">
            {liveCount} live update{liveCount !== 1 ? "s" : ""} received — list refreshed automatically.
          </span>
        </div>
      )}

      {/* Campaign list */}
      {loading ? (
        <div className="flex items-center justify-center gap-4 py-20 border-[3px] border-dashed border-black/20">
          <Loader2 className="w-8 h-8 animate-spin text-black/30" />
          <span className="font-mono text-sm text-black/50">Loading campaigns…</span>
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center gap-5 py-24 border-[3px] border-dashed border-black/20">
          <div className="w-16 h-16 flex items-center justify-center border-[3px] border-dashed border-black/20 bg-gray-50">
            <TrendingUp className="w-8 h-8 text-black/20" />
          </div>
          <div className="text-center">
            <p className="font-display font-black text-xl text-black/30">
              {search ? `No campaigns match "${search}"` : "No campaigns saved yet"}
            </p>
            <p className="font-mono text-sm text-black/40 mt-2 max-w-sm">
              {search
                ? "Try a different search term or clear the filter."
                : "Run an AI campaign from Mission Control — it will appear here automatically."}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 border-[3px] border-black bg-neo-cyan px-6 py-3 font-display font-black text-sm uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000] transition-all text-black"
          >
            <Zap className="w-4 h-4" /> Launch a Campaign
          </Link>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-mono text-xs text-black/50">{total} campaign{total !== 1 ? "s" : ""} total</p>
          </div>
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            {runs.map((run, i) => (
              <CampaignCard key={run.id} run={run} index={i} onView={() => setSelected(run)} />
            ))}
          </div>
          {total > 20 && (
            <div className="flex items-center justify-between border-t-[3px] border-black pt-4 mt-2 flex-wrap gap-3">
              <span className="font-mono text-xs text-black/50">{total} total</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="border-2 border-black px-3 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0_0_#000] hover:-translate-y-px disabled:opacity-40 transition-all bg-white">
                  ← Prev
                </button>
                <span className="flex items-center font-mono text-xs px-3 border-2 border-black/20 bg-gray-50">Page {page}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}
                  className="border-2 border-black px-3 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0_0_#000] hover:-translate-y-px disabled:opacity-40 transition-all bg-white">
                  Next →
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {selectedRun && (
        <CampaignDetailPanel run={selectedRun} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
