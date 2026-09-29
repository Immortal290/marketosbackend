"use client";

import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import {
  History, Search, Bot, FileText, Send, Trash2, RefreshCw,
  ChevronDown, ChevronUp, ChevronRight, Loader2, CheckCircle2,
  Mail, MessageSquare, Share2, Download, Clock, Eye, Zap,
  XCircle, AlertCircle, Play, Archive,
} from "lucide-react";

interface DispatchEntry {
  channel: string;
  status: "sent" | "failed" | "scheduled" | "skipped";
  sentAt: string;
  messageId: string;
  detail: string;
}

interface HistoryItem {
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

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="w-3.5 h-3.5" />,
  sms: <MessageSquare className="w-3.5 h-3.5" />,
  social: <Share2 className="w-3.5 h-3.5" />,
  whatsapp: <MessageSquare className="w-3.5 h-3.5 text-green-500" />,
  voice: <Zap className="w-3.5 h-3.5" />,
};

const STATUS_COLORS: Record<string, string> = {
  completed:  "bg-green-100 text-green-800 border-green-400",
  dispatched: "bg-blue-100 text-blue-800 border-blue-400",
  archived:   "bg-gray-100 text-gray-500 border-gray-300",
  failed:     "bg-red-100 text-red-800 border-red-400",
  sent:       "bg-green-100 text-green-800 border-green-300",
  scheduled:  "bg-yellow-100 text-yellow-800 border-yellow-300",
  skipped:    "bg-gray-100 text-gray-500 border-gray-200",
};

// ── Dispatch Modal ────────────────────────────────────────────────────────────
function DispatchModal({
  item,
  onClose,
  onDispatched,
}: {
  item: HistoryItem;
  onClose: () => void;
  onDispatched: (updated: HistoryItem) => void;
}) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>(item.channels);
  const [recipientEmail, setRecipientEmail] = useState(item.recipientEmail || "");
  const [recipientPhone, setRecipientPhone] = useState(item.recipientPhone || "");
  const [dispatching, setDispatching] = useState(false);

  const toggleChannel = (ch: string) =>
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );

  const handleDispatch = async () => {
    if (!selectedChannels.length) {
      toast.error("Select at least one channel.");
      return;
    }
    setDispatching(true);
    try {
      const res = await apiRequest<any>(`/history/${item.id}/dispatch`, {
        method: "POST",
        body: JSON.stringify({
          channels: selectedChannels,
          recipientEmail: recipientEmail || undefined,
          recipientPhone: recipientPhone || undefined,
        }),
      });
      toast.success("Messages dispatched!", {
        description: `Sent via: ${selectedChannels.join(", ")}`,
      });
      onDispatched({ ...item, status: "dispatched", dispatchLog: res.data?.dispatchLog });
      onClose();
    } catch (err: any) {
      toast.error("Dispatch failed: " + err.message);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md border-[4px] border-black bg-white shadow-[10px_10px_0_0_#000]">
        <div className="flex items-center justify-between border-b-[4px] border-black bg-neo-cyan px-5 py-4">
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5 text-black" />
            <h3 className="font-display font-black text-base uppercase">Dispatch Campaign</h3>
          </div>
          <button onClick={onClose} className="border-2 border-black bg-white p-1 hover:bg-red-100 transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="bg-gray-50 border-2 border-black p-3">
            <p className="font-mono text-[10px] text-black/50 uppercase mb-1">Campaign</p>
            <p className="font-mono text-xs text-black font-bold line-clamp-2">{item.prompt}</p>
          </div>

          <div>
            <label className="font-display font-black text-xs uppercase mb-2 block">Channels to send:</label>
            <div className="flex flex-wrap gap-2">
              {["email", "sms", "social", "whatsapp"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => toggleChannel(ch)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-black font-mono text-xs font-bold uppercase transition-all shadow-[2px_2px_0_0_#000] hover:-translate-y-px ${
                    selectedChannels.includes(ch)
                      ? "bg-neo-cyan text-black"
                      : "bg-white text-gray-400 hover:text-black"
                  }`}
                >
                  {CHANNEL_ICONS[ch]} {selectedChannels.includes(ch) ? "✓ " : ""}{ch}
                </button>
              ))}
            </div>
          </div>

          {selectedChannels.includes("email") && (
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-black/60 mb-1 block">Recipient Email</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full border-2 border-black p-2 font-mono text-xs shadow-[2px_2px_0_0_#000]"
              />
            </div>
          )}
          {selectedChannels.includes("sms") && (
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-black/60 mb-1 block">Recipient Phone</label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="+91xxxxxxxxxx"
                className="w-full border-2 border-black p-2 font-mono text-xs shadow-[2px_2px_0_0_#000]"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t-2 border-black">
            <button
              onClick={onClose}
              className="flex-1 border-2 border-black bg-white py-2.5 font-display font-black text-xs uppercase shadow-[3px_3px_0_0_#000] hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleDispatch}
              disabled={dispatching}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-black bg-neo-cyan py-2.5 font-display font-black text-xs uppercase shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50"
            >
              {dispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {dispatching ? "Sending..." : "Send Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── HistoryDetailPanel ────────────────────────────────────────────────────────
function HistoryDetailPanel({
  item,
  onClose,
  onArchive,
  onDispatch,
}: {
  item: HistoryItem;
  onClose: () => void;
  onArchive: () => void;
  onDispatch: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"report" | "outputs" | "dispatch">("report");

  const downloadReport = () => {
    if (!item.documentation) return;
    const blob = new Blob([item.documentation], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign_${item.id.slice(0, 8)}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const agentKeys = Object.keys(item.agentOutputs || {});

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-6">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col border-[4px] border-black bg-white shadow-[12px_12px_0_0_#000]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[4px] border-black bg-gray-900 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-neo-cyan" />
            <div>
              <p className="font-mono text-[10px] text-gray-400 uppercase">Saved Campaign</p>
              <p className="font-mono text-sm text-white font-bold line-clamp-1">{item.prompt}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-1 border rounded font-mono uppercase ${STATUS_COLORS[item.status] || STATUS_COLORS.completed}`}>
              {item.status}
            </span>
            <button onClick={onClose} className="border-2 border-white/20 bg-transparent p-1 text-white hover:bg-white/10 transition-colors">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b-[3px] border-black flex-shrink-0">
          {[
            { key: "report", label: "AI Report", icon: <FileText className="w-3.5 h-3.5" /> },
            { key: "outputs", label: `Agent Outputs (${agentKeys.length})`, icon: <Bot className="w-3.5 h-3.5" /> },
            { key: "dispatch", label: "Dispatch Log", icon: <Send className="w-3.5 h-3.5" /> },
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "report" && (
            <div>
              {item.documentation ? (
                <pre className="whitespace-pre-wrap font-mono text-xs text-black leading-relaxed">{item.documentation}</pre>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-black/40">
                  <FileText className="w-10 h-10" />
                  <p className="font-mono text-sm">No report saved for this run.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "outputs" && (
            <div className="flex flex-col gap-3">
              {agentKeys.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-black/40">
                  <Bot className="w-10 h-10" />
                  <p className="font-mono text-sm">No agent outputs saved.</p>
                </div>
              ) : agentKeys.map((agentKey) => (
                <AgentOutputCard key={agentKey} agentKey={agentKey} output={item.agentOutputs[agentKey]} />
              ))}
            </div>
          )}

          {activeTab === "dispatch" && (
            <div className="flex flex-col gap-3">
              {(!item.dispatchLog || item.dispatchLog.length === 0) ? (
                <div className="flex flex-col items-center gap-3 py-12 text-black/40">
                  <Send className="w-10 h-10" />
                  <p className="font-mono text-sm">Not dispatched yet.</p>
                </div>
              ) : item.dispatchLog.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border-2 border-black shadow-[2px_2px_0_0_#000]">
                  <div className="mt-0.5">{CHANNEL_ICONS[entry.channel] || <Zap className="w-3.5 h-3.5" />}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold uppercase">{entry.channel}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded font-mono uppercase ${STATUS_COLORS[entry.status] || ""}`}>
                        {entry.status}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-black/70">{entry.detail}</p>
                    <p className="font-mono text-[9px] text-black/40 mt-1">{new Date(entry.sentAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 border-t-[3px] border-black px-5 py-3 bg-gray-50 flex-shrink-0">
          <button
            onClick={downloadReport}
            disabled={!item.documentation}
            className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </button>
          <button
            onClick={onArchive}
            className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:bg-red-50 transition-colors"
          >
            <Archive className="w-3.5 h-3.5" /> Archive
          </button>
          <div className="flex-1" />
          <button
            onClick={onDispatch}
            className="flex items-center gap-1.5 border-2 border-black bg-neo-cyan px-4 py-2 font-display font-black text-xs uppercase shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000] transition-all"
          >
            <Send className="w-3.5 h-3.5" /> Dispatch to Channels
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Agent Output Card (collapsible) ──────────────────────────────────────────
function AgentOutputCard({ agentKey, output }: { agentKey: string; output: any }) {
  const [open, setOpen] = useState(false);
  const label = agentKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const preview = typeof output === "object" ? JSON.stringify(output).slice(0, 120) + "…" : String(output || "").slice(0, 120);

  return (
    <div className="border-2 border-black shadow-[2px_2px_0_0_#000]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-600" />
          <span className="font-mono text-xs font-bold">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-black/40 max-w-48 truncate hidden sm:block">{preview}</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && (
        <div className="px-4 py-3 border-t-2 border-black bg-white max-h-64 overflow-y-auto">
          <pre className="font-mono text-[11px] text-black whitespace-pre-wrap">
            {typeof output === "object" ? JSON.stringify(output, null, 2) : String(output)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main History Page ─────────────────────────────────────────────────────────
export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [dispatchTarget, setDispatchTarget] = useState<HistoryItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) params.set("search", search);
      const res = await apiRequest<any>(`/history?${params.toString()}`);
      setItems(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch (err: any) {
      toast.error("Failed to load history: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);

  const handleArchive = async (item: HistoryItem) => {
    try {
      await apiRequest(`/history/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedItem(null);
      toast.success("Campaign archived.");
    } catch (err: any) {
      toast.error("Archive failed: " + err.message);
    }
  };

  const handleDispatched = (updated: HistoryItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const formatAge = (dateStr: string) => {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <History className="w-8 h-8" />
            Campaign History
          </h1>
          <p className="font-mono text-xs text-black/60 mt-1">
            All your saved AI campaigns — browse outputs, re-dispatch to channels, or download reports.
          </p>
        </div>
        <button
          onClick={() => { setPage(1); void load(); }}
          className="flex items-center gap-2 border-[3px] border-black bg-white px-4 py-2.5 font-mono text-xs font-bold uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000] transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search campaigns by prompt…"
            className="w-full border-[3px] border-black pl-10 pr-4 py-3 font-mono text-sm shadow-[4px_4px_0_0_#000] focus:outline-none focus:border-neo-blue"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 flex-wrap">
        {[
          { label: "Total Saved", value: total, color: "bg-neo-cyan" },
          { label: "Dispatched", value: items.filter(i => i.status === "dispatched").length, color: "bg-neo-lime" },
          { label: "Completed", value: items.filter(i => i.status === "completed").length, color: "bg-neo-yellow" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`flex items-center gap-3 border-[3px] border-black px-4 py-2.5 shadow-[3px_3px_0_0_#000] ${color}`}>
            <span className="font-display font-black text-2xl">{value}</span>
            <span className="font-mono text-xs font-bold uppercase text-black/60">{label}</span>
          </div>
        ))}
      </div>

      {/* History list */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-black/40">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="font-mono text-sm">Loading campaign history…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 border-[3px] border-dashed border-black/20 text-black/40">
          <History className="w-14 h-14" />
          <p className="font-display font-black text-xl">No campaigns saved yet</p>
          <p className="font-mono text-sm text-center max-w-sm">
            Run a campaign from the dashboard — it will automatically appear here so you can re-use the outputs.
          </p>
          <a
            href="/dashboard"
            className="flex items-center gap-2 border-2 border-black bg-neo-cyan px-5 py-2.5 font-display font-black text-sm uppercase shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 transition-all text-black"
          >
            <Play className="w-4 h-4" /> Launch a Campaign
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              formatAge={formatAge}
              onOpen={() => setSelectedItem(item)}
              onDispatch={() => setDispatchTarget(item)}
              onArchive={() => handleArchive(item)}
            />
          ))}

          {/* Pagination */}
          {total > 15 && (
            <div className="flex items-center justify-between border-t-[3px] border-black pt-4 mt-2">
              <span className="font-mono text-xs text-black/50">{total} total campaigns</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-2 border-black px-3 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0_0_#000] hover:-translate-y-px disabled:opacity-40 transition-all"
                >
                  ← Prev
                </button>
                <span className="flex items-center font-mono text-xs px-3">Page {page}</span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 15 >= total}
                  className="border-2 border-black px-3 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0_0_#000] hover:-translate-y-px disabled:opacity-40 transition-all"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <HistoryDetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onArchive={() => handleArchive(selectedItem)}
          onDispatch={() => { setDispatchTarget(selectedItem); setSelectedItem(null); }}
        />
      )}

      {/* Dispatch Modal */}
      {dispatchTarget && (
        <DispatchModal
          item={dispatchTarget}
          onClose={() => setDispatchTarget(null)}
          onDispatched={(updated) => { handleDispatched(updated); setDispatchTarget(null); }}
        />
      )}
    </div>
  );
}

// ── HistoryCard ───────────────────────────────────────────────────────────────
function HistoryCard({
  item,
  formatAge,
  onOpen,
  onDispatch,
  onArchive,
}: {
  item: HistoryItem;
  formatAge: (d: string) => string;
  onOpen: () => void;
  onDispatch: () => void;
  onArchive: () => void;
}) {
  const agentCount = Object.keys(item.agentOutputs || {}).length;
  const dispatchCount = item.dispatchLog?.length || 0;

  return (
    <div className="flex items-start gap-4 border-[3px] border-black bg-white p-4 shadow-[4px_4px_0_0_#000] hover:shadow-[5px_5px_0_0_#000] hover:-translate-y-0.5 transition-all">
      {/* Status dot */}
      <div className="flex-shrink-0 mt-1">
        {item.status === "dispatched" ? (
          <CheckCircle2 className="w-5 h-5 text-blue-600" />
        ) : item.status === "completed" ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <AlertCircle className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm font-bold text-black line-clamp-2 mb-2">{item.prompt}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[9px] font-bold px-2 py-0.5 border rounded font-mono uppercase ${STATUS_COLORS[item.status] || ""}`}>
            {item.status}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-black/50">
            <Clock className="w-3 h-3" /> {formatAge(item.createdAt)}
          </span>
          {agentCount > 0 && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-purple-700 bg-purple-50 border border-purple-300 px-1.5 py-0.5 rounded">
              <Bot className="w-3 h-3" /> {agentCount} agent{agentCount !== 1 ? "s" : ""}
            </span>
          )}
          {dispatchCount > 0 && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-blue-700 bg-blue-50 border border-blue-300 px-1.5 py-0.5 rounded">
              <Send className="w-3 h-3" /> {dispatchCount} sent
            </span>
          )}
          {item.channels.map((ch) => (
            <span key={ch} className="flex items-center gap-1 font-mono text-[9px] text-black/50 border border-black/20 px-1.5 py-0.5 rounded">
              {CHANNEL_ICONS[ch]} {ch}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onOpen}
          title="View outputs & report"
          className="border-2 border-black bg-white p-2 shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:bg-gray-50 transition-all"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={onDispatch}
          title="Send to channels"
          className="border-2 border-black bg-neo-cyan p-2 shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
        <button
          onClick={onArchive}
          title="Archive"
          className="border-2 border-black bg-white p-2 shadow-[2px_2px_0_0_#000] hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>
  );
}
