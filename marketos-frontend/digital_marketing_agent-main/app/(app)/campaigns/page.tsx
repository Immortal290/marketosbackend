"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Zap, Bot, Send, Loader2, RefreshCw, CheckCircle2, AlertCircle,
  Search, Filter, Eye, ChevronDown, XCircle, Download, Archive,
  FileText, TrendingUp, Clock, Mail, MessageSquare, Share2,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { io as socketIOClient } from "socket.io-client";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface DispatchEntry {
  channel: string;
  status: string;
  sentAt: string;
  detail: string;
}

interface CampaignRun {
  id: string;
  prompt: string;
  status: string;
  channels: string[];
  recipientEmail: string | null;
  recipientPhone: string | null;
  documentation: string | null;
  agentOutputs: Record<string, any>;
  dispatchLog: DispatchEntry[] | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const STATUS_CFG: Record<string, { label: string; cls: string; stripe: string }> = {
  completed:         { label: "Completed",         cls: "bg-green-100 text-green-800 border-green-400",   stripe: "bg-green-400"  },
  dispatched:        { label: "Dispatched",        cls: "bg-blue-100 text-blue-800 border-blue-400",      stripe: "bg-blue-400"   },
  running:           { label: "Running",           cls: "bg-cyan-100 text-cyan-800 border-cyan-400",      stripe: "bg-cyan-400"   },
  awaiting_approval: { label: "Awaiting Approval", cls: "bg-yellow-100 text-yellow-800 border-yellow-400", stripe: "bg-yellow-400" },
  failed:            { label: "Failed",            cls: "bg-red-100 text-red-800 border-red-400",          stripe: "bg-red-400"    },
  archived:          { label: "Archived",          cls: "bg-gray-100 text-gray-500 border-gray-300",      stripe: "bg-gray-300"   },
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email:    <Mail className="w-3.5 h-3.5" />,
  sms:      <MessageSquare className="w-3.5 h-3.5" />,
  social:   <Share2 className="w-3.5 h-3.5" />,
  whatsapp: <MessageSquare className="w-3.5 h-3.5 text-green-600" />,
};

const CHANNEL_EMOJI: Record<string, string> = {
  email: "✉️", sms: "💬", whatsapp: "📱", social: "📡",
  linkedin: "🔗", google_ads: "🎯", meta: "📘", twitter: "🐦",
};

const ACCENT_COLORS = [
  "border-l-neo-yellow", "border-l-neo-cyan", "border-l-neo-pink", "border-l-neo-lime",
];

function formatAge(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Agent Output Accordion ─────────────────────────────────────────────── */
function AgentItem({ agentKey, output }: { agentKey: string; output: any }) {
  const [open, setOpen] = useState(false);
  const label = agentKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <div className="border-2 border-black overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-neo-yellow/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
          <span className="font-mono text-xs font-bold">{label}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-black/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="p-4 border-t-2 border-black bg-white max-h-56 overflow-y-auto">
          <pre className="font-mono text-[11px] text-black whitespace-pre-wrap leading-relaxed">
            {typeof output === "object" ? JSON.stringify(output, null, 2) : String(output)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Dispatch Modal ─────────────────────────────────────────────────────── */
function DispatchModal({ item, onClose, onDispatched }: {
  item: CampaignRun;
  onClose: () => void;
  onDispatched: (updated: CampaignRun) => void;
}) {
  const [channels, setChannels] = useState<string[]>(item.channels.length ? item.channels : ["email"]);
  const [email, setEmail]       = useState(item.recipientEmail || "");
  const [phone, setPhone]       = useState(item.recipientPhone || "");
  const [busy, setBusy]         = useState(false);

  const toggle = (ch: string) =>
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);

  const send = async () => {
    if (!channels.length) { toast.error("Select at least one channel."); return; }
    setBusy(true);
    try {
      const res = await apiRequest<any>(`/history/${item.id}/dispatch`, {
        method: "POST",
        body: JSON.stringify({ channels, recipientEmail: email || undefined, recipientPhone: phone || undefined }),
      });
      toast.success("Dispatched successfully.");
      onDispatched({ ...item, status: "dispatched", dispatchLog: res.data?.dispatchLog });
      onClose();
    } catch (err: any) {
      toast.error("Dispatch failed: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md border-[4px] border-black bg-white shadow-[10px_10px_0_0_#000]">
        <div className="flex items-center justify-between border-b-[4px] border-black bg-neo-cyan px-5 py-4">
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5" />
            <h3 className="font-display font-black text-base uppercase">Send Campaign</h3>
          </div>
          <button onClick={onClose} className="border-2 border-black bg-white p-1.5 hover:bg-red-50 transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="bg-gray-50 border-2 border-black p-3">
            <p className="font-mono text-[10px] text-black/50 uppercase mb-1">Campaign</p>
            <p className="font-mono text-xs font-bold line-clamp-2">{item.prompt}</p>
          </div>
          <div>
            <label className="font-display font-black text-xs uppercase mb-2 block">Send via</label>
            <div className="flex flex-wrap gap-2">
              {["email","sms","social","whatsapp"].map(ch => (
                <button key={ch} onClick={() => toggle(ch)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-black font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px transition-all ${channels.includes(ch) ? "bg-neo-cyan" : "bg-white text-gray-400 hover:text-black"}`}>
                  {CHANNEL_ICONS[ch]} {ch}
                </button>
              ))}
            </div>
          </div>
          {channels.includes("email") && (
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-black/60 mb-1.5 block">Recipient Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com"
                className="w-full border-2 border-black p-2.5 font-mono text-xs focus:outline-none" />
            </div>
          )}
          {channels.includes("sms") && (
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-black/60 mb-1.5 block">Recipient Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91xxxxxxxxxx"
                className="w-full border-2 border-black p-2.5 font-mono text-xs focus:outline-none" />
            </div>
          )}
          <div className="flex gap-3 border-t-2 border-black pt-3">
            <button onClick={onClose}
              className="flex-1 border-2 border-black bg-white py-2.5 font-display font-black text-xs uppercase shadow-[3px_3px_0_0_#000]">
              Cancel
            </button>
            <button onClick={send} disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-black bg-neo-cyan py-2.5 font-display font-black text-xs uppercase shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {busy ? "Sending…" : "Send Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Detail Panel ───────────────────────────────────────────────────────── */
function DetailPanel({ item, onClose, onDispatch, onArchive }: {
  item: CampaignRun;
  onClose: () => void;
  onDispatch: () => void;
  onArchive: () => void;
}) {
  const [tab, setTab] = useState<"report" | "agents" | "dispatch">("report");
  const agentKeys = Object.keys(item.agentOutputs || {});
  const cfg = STATUS_CFG[item.status] || STATUS_CFG.completed;

  const download = () => {
    if (!item.documentation) return;
    const blob = new Blob([item.documentation], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign_${item.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-6"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col border-[4px] border-black bg-white shadow-[12px_12px_0_0_#000]">

        {/* Header */}
        <div className="flex items-center justify-between border-b-[4px] border-black bg-gray-900 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-neo-cyan flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">{item.id.slice(0, 8)}</p>
              <p className="font-mono text-sm text-white font-bold line-clamp-1">{item.prompt}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <span className={`text-[10px] font-bold px-2 py-1 border rounded font-mono uppercase ${cfg.cls}`}>{cfg.label}</span>
            <button onClick={onClose} className="border-2 border-white/20 p-1.5 text-white hover:bg-white/10 transition-colors">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 px-5 py-2 bg-gray-50 border-b border-black/10 flex-shrink-0 flex-wrap">
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-black/50">
            <Clock className="w-3 h-3" />
            {new Date(item.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
          {item.recipientEmail && (
            <span className="font-mono text-[10px] text-black/50">{item.recipientEmail}</span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b-[3px] border-black flex-shrink-0">
          {[
            { key: "report",   label: "Report" },
            { key: "agents",   label: `Agents (${agentKeys.length})` },
            { key: "dispatch", label: "Dispatch Log" },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={`px-5 py-3 font-mono text-xs font-bold uppercase border-r-[3px] border-black transition-colors ${tab === key ? "bg-neo-yellow text-black" : "bg-white text-black/50 hover:bg-gray-50"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "report" && (
            item.documentation
              ? <pre className="whitespace-pre-wrap font-mono text-xs text-black leading-relaxed">{item.documentation}</pre>
              : <div className="flex flex-col items-center justify-center gap-3 py-20 text-black/30"><FileText className="w-12 h-12" /><p className="font-mono text-sm font-bold">No report for this run.</p></div>
          )}
          {tab === "agents" && (
            <div className="flex flex-col gap-3">
              {agentKeys.length === 0
                ? <div className="flex flex-col items-center justify-center gap-3 py-20 text-black/30"><Bot className="w-12 h-12" /><p className="font-mono text-sm font-bold">No agent outputs saved.</p></div>
                : agentKeys.map(k => <AgentItem key={k} agentKey={k} output={item.agentOutputs[k]} />)}
            </div>
          )}
          {tab === "dispatch" && (
            <div className="flex flex-col gap-3">
              {!item.dispatchLog?.length
                ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-20 text-black/30">
                    <Send className="w-12 h-12" />
                    <p className="font-mono text-sm font-bold">Not sent yet.</p>
                    <button onClick={onDispatch}
                      className="flex items-center gap-2 border-2 border-black bg-neo-cyan px-4 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px transition-all text-black">
                      <Send className="w-3.5 h-3.5" /> Send Now
                    </button>
                  </div>
                )
                : item.dispatchLog.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 border-2 border-black bg-white">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-xs font-bold uppercase">{entry.channel}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded font-mono uppercase ${STATUS_CFG[entry.status]?.cls || ""}`}>{entry.status}</span>
                        </div>
                        <p className="font-mono text-[11px] text-black/70 break-all">{entry.detail}</p>
                        <p className="font-mono text-[9px] text-black/40 mt-1">{new Date(entry.sentAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t-[3px] border-black px-5 py-3 bg-gray-50 flex-shrink-0 flex-wrap">
          <button onClick={download} disabled={!item.documentation}
            className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px transition-all disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> Download
          </button>
          <button onClick={onArchive}
            className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:bg-red-50 transition-colors">
            <Archive className="w-3.5 h-3.5 text-red-500" /> Archive
          </button>
          <Link href={`/dashboard?cmd=${encodeURIComponent(item.prompt)}&checkpoint=${item.id}`} onClick={onClose}
            className="flex items-center gap-1.5 border-2 border-black bg-neo-yellow px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px transition-all">
            <Zap className="w-3.5 h-3.5" /> Re-run
          </Link>
          <div className="flex-1" />
          <button onClick={onDispatch}
            className="flex items-center gap-1.5 border-2 border-black bg-neo-cyan px-4 py-2 font-display font-black text-xs uppercase shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000] transition-all">
            <Send className="w-3.5 h-3.5" /> Send to Channels
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Campaign Card ──────────────────────────────────────────────────────── */
function CampaignCard({ item, index, onOpen, onDispatch, onArchive }: {
  item: CampaignRun;
  index: number;
  onOpen: () => void;
  onDispatch: () => void;
  onArchive: () => void;
}) {
  const cfg = STATUS_CFG[item.status] || STATUS_CFG.completed;
  const agentCount    = Object.keys(item.agentOutputs || {}).length;
  const dispatchCount = item.dispatchLog?.length || 0;
  const accent        = ACCENT_COLORS[index % ACCENT_COLORS.length];

  return (
    <div
      className={`group relative flex items-start gap-4 border-[3px] border-black border-l-[6px] ${accent} bg-white p-4 shadow-[4px_4px_0_0_#000] hover:shadow-[6px_6px_0_0_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer`}
      onClick={onOpen}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        <div className={`w-8 h-8 flex items-center justify-center border-2 border-black shadow-[1px_1px_0_0_#000] ${
          item.status === "completed" || item.status === "dispatched" ? "bg-green-100" :
          item.status === "failed" ? "bg-red-100" : "bg-gray-100"
        }`}>
          {item.status === "completed" || item.status === "dispatched"
            ? <CheckCircle2 className="w-4 h-4 text-green-600" />
            : <AlertCircle className={`w-4 h-4 ${item.status === "failed" ? "text-red-500" : "text-gray-400"}`} />
          }
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm font-bold text-black line-clamp-2 mb-2 leading-snug">{item.prompt}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 border rounded-sm font-mono uppercase ${cfg.cls}`}>
            {cfg.label}
          </span>
          <span className="font-mono text-[10px] text-black/50 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {formatAge(item.createdAt)}
          </span>
          {agentCount > 0 && (
            <span className="font-mono text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Bot className="w-3 h-3" /> {agentCount} agent{agentCount !== 1 ? "s" : ""}
            </span>
          )}
          {dispatchCount > 0 && (
            <span className="font-mono text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Send className="w-3 h-3" /> {dispatchCount} sent
            </span>
          )}
          {item.channels.map(ch => (
            <span key={ch} className="font-mono text-[9px] text-black/50 border border-black/15 bg-gray-50 px-1.5 py-0.5 rounded">
              {CHANNEL_EMOJI[ch] || ch}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={onOpen}
          className="flex items-center gap-1 border-2 border-black bg-white px-2.5 py-2 font-mono text-[10px] font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:bg-gray-50 transition-all">
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">View</span>
        </button>
        <button onClick={onDispatch}
          className="border-2 border-black bg-neo-cyan p-2 shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all">
          <Send className="w-3.5 h-3.5" />
        </button>
        <button onClick={onArchive}
          className="border-2 border-black bg-white p-2 shadow-[2px_2px_0_0_#000] hover:bg-red-50 transition-colors">
          <Archive className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>
    </div>
  );
}

/* ══ MAIN PAGE ══════════════════════════════════════════════════════════════ */
export default function CampaignsPage() {
  const [items, setItems]             = useState<CampaignRun[]>([]);
  const [loading, setLoading]         = useState(true);
  const [total, setTotal]             = useState(0);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatus]     = useState("all");
  const [page, setPage]               = useState(1);
  const [selected, setSelected]       = useState<CampaignRun | null>(null);
  const [dispatchTarget, setDispatch] = useState<CampaignRun | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiRequest<any>(`/history?${params.toString()}`);
      setItems(res.data || []);
      setTotal(res.meta?.total || (res.data?.length ?? 0));
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  /* Real-time updates — quietly refresh list on new events */
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
    const socket = socketIOClient(url, { transports: ["websocket", "polling"] });

    socket.on("workflow:update", (data: any) => {
      if (["COMPLETED", "FAILED", "CREATED"].includes(data?.event)) void load();
    });
    socket.on("workflow:step_update", (data: any) => {
      const { runId, status } = data;
      if (!runId) return;
      setItems(prev => prev.map(i => i.id === runId ? { ...i, status: status === "done" ? "completed" : status } : i));
    });

    return () => { socket.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleArchive = async (item: CampaignRun) => {
    try {
      await apiRequest(`/history/${item.id}`, { method: "DELETE" });
      setItems(prev => prev.filter(i => i.id !== item.id));
      setSelected(null);
      toast.success("Campaign archived.");
    } catch (err: any) {
      toast.error("Archive failed: " + err.message);
    }
  };

  const handleDispatched = (updated: CampaignRun) =>
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));

  const completedCount  = items.filter(i => i.status === "completed").length;
  const dispatchedCount = items.filter(i => i.status === "dispatched").length;
  const withReport      = items.filter(i => !!i.documentation).length;

  const STATUS_OPTIONS = ["all", "completed", "dispatched", "running", "awaiting_approval", "failed", "archived"];

  return (
    <div className="theme-pastel flex flex-col gap-6 p-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">All Campaigns</h1>
          <p className="mt-1 font-mono text-xs text-black/60">
            Every AI campaign run — view outputs, re-run commands, or send to channels.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => { setPage(1); void load(); }}
            className="flex items-center gap-2 border-[3px] border-black bg-white px-4 py-2.5 font-mono text-xs font-bold uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000] transition-all">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <Link href="/dashboard"
            className="flex items-center gap-2 border-[3px] border-black bg-neo-cyan px-4 py-2.5 font-display font-black text-xs uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000] transition-all text-black">
            <Zap className="w-4 h-4" /> New Campaign
          </Link>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total",      value: total,          color: "bg-neo-cyan"   },
          { label: "Completed",  value: completedCount,  color: "bg-neo-yellow" },
          { label: "Dispatched", value: dispatchedCount, color: "bg-neo-lime"   },
          { label: "With Report",value: withReport,      color: "bg-neo-pink"   },
        ].map(({ label, value, color }) => (
          <div key={label} className={`flex items-center gap-3 border-[3px] border-black ${color} px-4 py-3 shadow-[4px_4px_0_0_#000]`}>
            <span className="font-display font-black text-3xl">{value}</span>
            <span className="font-mono text-xs font-bold uppercase text-black/60">{label}</span>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search campaigns…"
            className="w-full border-[3px] border-black pl-10 pr-4 py-3 font-mono text-sm shadow-[4px_4px_0_0_#000] focus:outline-none bg-white" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
          <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="border-[3px] border-black pl-9 pr-8 py-3 font-mono text-sm shadow-[4px_4px_0_0_#000] bg-white focus:outline-none appearance-none cursor-pointer">
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s === "all" ? "All Status" : s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-black/60" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-4 py-24 border-[3px] border-dashed border-black/20">
          <Loader2 className="w-8 h-8 animate-spin text-black/30" />
          <span className="font-mono text-sm text-black/50">Loading campaigns…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-5 py-24 border-[3px] border-dashed border-black/20">
          <div className="w-16 h-16 flex items-center justify-center border-[3px] border-dashed border-black/20 bg-gray-50">
            <TrendingUp className="w-8 h-8 text-black/20" />
          </div>
          <div className="text-center">
            <p className="font-display font-black text-xl text-black/30">
              {search ? `No campaigns match "${search}"` : "No campaigns yet"}
            </p>
            <p className="font-mono text-sm text-black/40 mt-2 max-w-sm">
              {search ? "Try a different search or clear the filter." : "Run a campaign from Mission Control — it will appear here."}
            </p>
          </div>
          <Link href="/dashboard"
            className="flex items-center gap-2 border-[3px] border-black bg-neo-cyan px-6 py-3 font-display font-black text-sm uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 transition-all text-black">
            <Zap className="w-4 h-4" /> Launch a Campaign
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs text-black/50">{total} campaign{total !== 1 ? "s" : ""}</p>
          {items.map((item, i) => (
            <CampaignCard
              key={item.id}
              item={item}
              index={i}
              onOpen={() => setSelected(item)}
              onDispatch={() => setDispatch(item)}
              onArchive={() => handleArchive(item)}
            />
          ))}
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
        </div>
      )}

      {selected && (
        <DetailPanel
          item={selected}
          onClose={() => setSelected(null)}
          onDispatch={() => { setDispatch(selected); setSelected(null); }}
          onArchive={() => handleArchive(selected)}
        />
      )}

      {dispatchTarget && (
        <DispatchModal
          item={dispatchTarget}
          onClose={() => setDispatch(null)}
          onDispatched={updated => { handleDispatched(updated); setDispatch(null); }}
        />
      )}
    </div>
  );
}
