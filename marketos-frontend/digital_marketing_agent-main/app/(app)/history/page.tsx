"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { io as socketIOClient } from "socket.io-client";
import { toast } from "sonner";
import {
  History, Search, Bot, FileText, Send, Trash2, RefreshCw,
  ChevronDown, ChevronUp, Loader2, CheckCircle2,
  Mail, MessageSquare, Share2, Download, Clock, Eye, Zap,
  XCircle, AlertCircle, Play, Archive, Flag, Activity, Filter,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────────── */
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

/* ── Constants ─────────────────────────────────────────────────────────────── */
const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email:    <Mail className="w-3.5 h-3.5" />,
  sms:      <MessageSquare className="w-3.5 h-3.5" />,
  social:   <Share2 className="w-3.5 h-3.5" />,
  whatsapp: <MessageSquare className="w-3.5 h-3.5 text-green-500" />,
  voice:    <Zap className="w-3.5 h-3.5" />,
};

const CHANNEL_EMOJI: Record<string, string> = {
  email: "✉️", sms: "💬", whatsapp: "📱", social: "📡",
  linkedin: "🔗", google_ads: "🎯", meta: "📘", twitter: "🐦",
};

const STATUS_CFG: Record<string, { label: string; cls: string; dot: string }> = {
  completed:  { label: "Completed",  cls: "bg-green-100 text-green-800 border-green-400",  dot: "bg-green-500"  },
  dispatched: { label: "Dispatched", cls: "bg-blue-100 text-blue-800 border-blue-400",    dot: "bg-blue-500"   },
  archived:   { label: "Archived",   cls: "bg-gray-100 text-gray-500 border-gray-300",    dot: "bg-gray-400"   },
  failed:     { label: "Failed",     cls: "bg-red-100 text-red-800 border-red-400",        dot: "bg-red-500"    },
  running:    { label: "Running",    cls: "bg-cyan-100 text-cyan-800 border-cyan-400",     dot: "bg-cyan-500"   },
  sent:       { label: "Sent",       cls: "bg-green-100 text-green-800 border-green-300", dot: "bg-green-400"  },
  scheduled:  { label: "Scheduled", cls: "bg-yellow-100 text-yellow-800 border-yellow-300", dot: "bg-yellow-500" },
  skipped:    { label: "Skipped",   cls: "bg-gray-100 text-gray-500 border-gray-200",    dot: "bg-gray-400"   },
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function formatAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ── Agent Output Card ─────────────────────────────────────────────────────── */
function AgentOutputCard({ agentKey, output }: { agentKey: string; output: any }) {
  const [open, setOpen] = useState(false);
  const label = agentKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const preview =
    typeof output === "object"
      ? JSON.stringify(output).slice(0, 100) + "…"
      : String(output || "").slice(0, 100);

  return (
    <div className="border-2 border-black shadow-[2px_2px_0_0_#000] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-neo-yellow/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0 w-6 h-6 border-2 border-black bg-purple-100 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-purple-700" />
          </div>
          <span className="font-mono text-xs font-bold text-black">{label}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="font-mono text-[10px] text-black/40 max-w-36 truncate hidden sm:block">{preview}</span>
          {open ? <ChevronUp className="w-4 h-4 text-black/60" /> : <ChevronDown className="w-4 h-4 text-black/60" />}
        </div>
      </button>
      {open && (
        <div className="px-4 py-3 border-t-2 border-black bg-white max-h-64 overflow-y-auto">
          <pre className="font-mono text-[11px] text-black whitespace-pre-wrap leading-relaxed">
            {typeof output === "object" ? JSON.stringify(output, null, 2) : String(output)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── History Detail Panel ────────────────────────────────────────────────── */
function HistoryDetailPanel({
  item, onClose, onArchive, onDispatch,
}: {
  item: HistoryItem;
  onClose: () => void;
  onArchive: () => void;
  onDispatch: () => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"report" | "outputs" | "dispatch">("report");
  const agentKeys = Object.keys(item.agentOutputs || {});
  const cfg = STATUS_CFG[item.status] || STATUS_CFG.completed;

  const handleResume = () => {
    onClose();
    toast.success("Resuming from checkpoint…", { description: item.prompt.slice(0, 80) });
    router.push(`/dashboard?cmd=${encodeURIComponent(item.prompt)}&checkpoint=${item.id}`);
  };

  const download = () => {
    if (!item.documentation) return;
    const blob = new Blob([item.documentation], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign_${item.id.slice(0, 8)}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-sm p-0 md:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col border-[4px] border-black bg-white shadow-[12px_12px_0_0_#000]">

        {/* Header */}
        <div className="flex items-center justify-between border-b-[4px] border-black bg-gray-900 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-neo-cyan border-2 border-white/20">
              <FileText className="w-4 h-4 text-black" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">
                Saved Campaign · {item.id.slice(0, 8)}
              </p>
              <p className="font-mono text-sm text-white font-bold line-clamp-1">{item.prompt}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <span className={`text-[10px] font-bold px-2 py-1 border rounded-sm font-mono uppercase ${cfg.cls}`}>
              {cfg.label}
            </span>
            <button onClick={onClose} className="border-2 border-white/20 bg-transparent p-1.5 text-white hover:bg-white/10 transition-colors">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 px-5 py-2 bg-gray-50 border-b-2 border-black/10 flex-shrink-0 flex-wrap">
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-black/50">
            <Clock className="w-3 h-3" />
            {new Date(item.createdAt).toLocaleDateString("en-IN", {
              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </span>
          {item.recipientEmail && (
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-black/50">
              <Mail className="w-3 h-3" /> {item.recipientEmail}
            </span>
          )}
          {item.channels.length > 0 && (
            <span className="font-mono text-[10px] text-black/50">
              {item.channels.map((ch) => CHANNEL_EMOJI[ch] || ch).join(" ")}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b-[3px] border-black flex-shrink-0">
          {[
            { key: "report",   label: "AI Report",                   icon: <FileText className="w-3.5 h-3.5" /> },
            { key: "outputs",  label: `Agents (${agentKeys.length})`, icon: <Bot className="w-3.5 h-3.5" /> },
            { key: "dispatch", label: "Dispatch Log",                 icon: <Send className="w-3.5 h-3.5" /> },
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
            item.documentation
              ? <pre className="whitespace-pre-wrap font-mono text-xs text-black leading-relaxed">{item.documentation}</pre>
              : (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-black/30">
                  <FileText className="w-12 h-12" />
                  <p className="font-mono text-sm font-bold">No AI report saved for this run.</p>
                </div>
              )
          )}
          {activeTab === "outputs" && (
            <div className="flex flex-col gap-3">
              {agentKeys.length === 0
                ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-black/30">
                    <Bot className="w-12 h-12" />
                    <p className="font-mono text-sm font-bold">No agent outputs saved.</p>
                  </div>
                )
                : agentKeys.map((agentKey) => (
                    <AgentOutputCard key={agentKey} agentKey={agentKey} output={item.agentOutputs[agentKey]} />
                  ))}
            </div>
          )}
          {activeTab === "dispatch" && (
            <div className="flex flex-col gap-3">
              {(!item.dispatchLog || item.dispatchLog.length === 0)
                ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-black/30">
                    <Send className="w-12 h-12" />
                    <p className="font-mono text-sm font-bold">Not dispatched yet.</p>
                    <button
                      onClick={onDispatch}
                      className="flex items-center gap-2 border-2 border-black bg-neo-cyan px-4 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px transition-all text-black"
                    >
                      <Send className="w-3.5 h-3.5" /> Dispatch Now
                    </button>
                  </div>
                )
                : item.dispatchLog.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 border-2 border-black shadow-[2px_2px_0_0_#000] bg-white">
                      <div className="mt-0.5 flex-shrink-0">{CHANNEL_ICONS[entry.channel] || <Zap className="w-3.5 h-3.5" />}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-xs font-bold uppercase">{entry.channel}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded font-mono uppercase ${STATUS_CFG[entry.status]?.cls || ""}`}>
                            {entry.status}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-black/70 break-all">{entry.detail}</p>
                        <p className="font-mono text-[9px] text-black/40 mt-1">
                          {new Date(entry.sentAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t-[3px] border-black px-5 py-3 bg-gray-50 flex-shrink-0 flex-wrap">
          <button
            onClick={download}
            disabled={!item.documentation}
            className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </button>
          <button
            onClick={onArchive}
            className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:bg-red-50 transition-colors"
          >
            <Archive className="w-3.5 h-3.5 text-red-500" /> Archive
          </button>
          <button
            onClick={handleResume}
            className="flex items-center gap-1.5 border-2 border-black bg-neo-yellow px-3 py-2 font-display font-black text-xs uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all"
          >
            <Flag className="w-3.5 h-3.5" /> Resume Checkpoint
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

/* ── Dispatch Modal ───────────────────────────────────────────────────────── */
function DispatchModal({
  item, onClose, onDispatched,
}: {
  item: HistoryItem;
  onClose: () => void;
  onDispatched: (updated: HistoryItem) => void;
}) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>(
    item.channels.length > 0 ? item.channels : ["email"]
  );
  const [recipientEmail, setRecipientEmail] = useState(item.recipientEmail || "");
  const [recipientPhone, setRecipientPhone] = useState(item.recipientPhone || "");
  const [dispatching, setDispatching] = useState(false);

  const toggle = (ch: string) =>
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );

  const handleDispatch = async () => {
    if (!selectedChannels.length) { toast.error("Select at least one channel."); return; }
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
      toast.success("Messages dispatched!", { description: `Sent via: ${selectedChannels.join(", ")}` });
      onDispatched({ ...item, status: "dispatched", dispatchLog: res.data?.dispatchLog });
      onClose();
    } catch (err: any) {
      toast.error("Dispatch failed: " + err.message);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md border-[4px] border-black bg-white shadow-[10px_10px_0_0_#000]">
        <div className="flex items-center justify-between border-b-[4px] border-black bg-neo-cyan px-5 py-4">
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5 text-black" />
            <h3 className="font-display font-black text-base uppercase">Dispatch Campaign</h3>
          </div>
          <button onClick={onClose} className="border-2 border-black bg-white p-1.5 hover:bg-red-100 transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="bg-gray-50 border-2 border-black p-3 shadow-[2px_2px_0_0_#000]">
            <p className="font-mono text-[10px] text-black/50 uppercase mb-1">Campaign prompt</p>
            <p className="font-mono text-xs text-black font-bold line-clamp-2">{item.prompt}</p>
          </div>
          <div>
            <label className="font-display font-black text-xs uppercase mb-2 block">Send via channels:</label>
            <div className="flex flex-wrap gap-2">
              {["email", "sms", "social", "whatsapp"].map((ch) => (
                <button
                  key={ch}
                  onClick={() => toggle(ch)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-black font-mono text-xs font-bold uppercase transition-all shadow-[2px_2px_0_0_#000] hover:-translate-y-px ${
                    selectedChannels.includes(ch) ? "bg-neo-cyan text-black" : "bg-white text-gray-400 hover:text-black"
                  }`}
                >
                  {CHANNEL_ICONS[ch]} {selectedChannels.includes(ch) ? "✓ " : ""}{ch}
                </button>
              ))}
            </div>
          </div>
          {selectedChannels.includes("email") && (
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-black/60 mb-1.5 block">Recipient Email</label>
              <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full border-2 border-black p-2.5 font-mono text-xs shadow-[2px_2px_0_0_#000] focus:outline-none" />
            </div>
          )}
          {selectedChannels.includes("sms") && (
            <div>
              <label className="font-mono text-[10px] font-bold uppercase text-black/60 mb-1.5 block">Recipient Phone</label>
              <input type="tel" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="+91xxxxxxxxxx"
                className="w-full border-2 border-black p-2.5 font-mono text-xs shadow-[2px_2px_0_0_#000] focus:outline-none" />
            </div>
          )}
          <div className="flex gap-3 pt-2 border-t-2 border-black">
            <button onClick={onClose}
              className="flex-1 border-2 border-black bg-white py-2.5 font-display font-black text-xs uppercase shadow-[3px_3px_0_0_#000] hover:bg-gray-100">
              Cancel
            </button>
            <button onClick={handleDispatch} disabled={dispatching}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-black bg-neo-cyan py-2.5 font-display font-black text-xs uppercase shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50">
              {dispatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {dispatching ? "Sending…" : "Send Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── History Card ─────────────────────────────────────────────────────────── */
function HistoryCard({
  item, formatAge, onOpen, onDispatch, onArchive,
}: {
  item: HistoryItem;
  formatAge: (d: string) => string;
  onOpen: () => void;
  onDispatch: () => void;
  onArchive: () => void;
}) {
  const cfg = STATUS_CFG[item.status] || STATUS_CFG.completed;
  const agentCount    = Object.keys(item.agentOutputs || {}).length;
  const dispatchCount = item.dispatchLog?.length || 0;

  return (
    <div className="group flex flex-col border-[3px] border-black bg-white shadow-[4px_4px_0_0_#000] hover:shadow-[6px_6px_0_0_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150">
      {/* Status accent stripe */}
      <div className={`h-1 w-full ${
        item.status === "completed"  ? "bg-green-400" :
        item.status === "dispatched" ? "bg-blue-400"  :
        item.status === "failed"     ? "bg-red-400"   : "bg-gray-300"
      }`} />

      <div className="flex items-start gap-4 p-4">
        {/* Status icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className={`w-8 h-8 flex items-center justify-center border-2 border-black shadow-[1px_1px_0_0_#000] ${
            item.status === "dispatched" ? "bg-blue-100"  :
            item.status === "completed"  ? "bg-green-100" :
            item.status === "failed"     ? "bg-red-100"   : "bg-gray-100"
          }`}>
            {item.status === "dispatched" || item.status === "completed"
              ? <CheckCircle2 className={`w-4 h-4 ${item.status === "dispatched" ? "text-blue-600" : "text-green-600"}`} />
              : <AlertCircle className={`w-4 h-4 ${item.status === "failed" ? "text-red-500" : "text-gray-400"}`} />
            }
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-bold text-black line-clamp-2 mb-2 leading-snug">
            {item.prompt}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 border rounded-sm font-mono uppercase ${cfg.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
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
              <span key={ch} className="flex items-center gap-1 font-mono text-[9px] text-black/50 border border-black/20 bg-gray-50 px-1.5 py-0.5 rounded">
                {CHANNEL_EMOJI[ch] || ch}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onOpen} title="View"
            className="flex items-center gap-1 border-2 border-black bg-white px-2.5 py-2 font-mono text-[10px] font-bold uppercase shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:bg-gray-50 transition-all">
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">View</span>
          </button>
          <button onClick={onDispatch} title="Dispatch"
            className="border-2 border-black bg-neo-cyan p-2 shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all">
            <Send className="w-3.5 h-3.5" />
          </button>
          <button onClick={onArchive} title="Archive"
            className="border-2 border-black bg-white p-2 shadow-[2px_2px_0_0_#000] hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══ MAIN PAGE ═══════════════════════════════════════════════════════════════ */
export default function HistoryPage() {
  const [items, setItems]               = useState<HistoryItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [dispatchTarget, setDispatch]   = useState<HistoryItem | null>(null);
  const [liveCount, setLiveCount]       = useState(0);
  const [isLive, setIsLive]             = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
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

  /* Socket.io live sync */
  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "http://localhost:3001";
    const socket = socketIOClient(url, { transports: ["websocket", "polling"] });

    socket.on("connect",    () => setIsLive(true));
    socket.on("disconnect", () => setIsLive(false));

    socket.on("workflow:update", (data: any) => {
      if (data?.event === "COMPLETED" || data?.event === "FAILED" || data?.event === "CREATED") {
        setLiveCount((c) => c + 1);
        void load();
      }
    });

    socket.on("workflow:step_update", (data: any) => {
      const { runId, status } = data;
      if (!runId) return;
      setItems((prev) =>
        prev.map((item) =>
          item.id === runId
            ? { ...item, status: status === "done" ? "completed" : status }
            : item
        )
      );
    });

    return () => { socket.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleDispatched = (updated: HistoryItem) =>
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));

  const completedCount  = items.filter((i) => i.status === "completed").length;
  const dispatchedCount = items.filter((i) => i.status === "dispatched").length;

  return (
    <div className="theme-pastel flex flex-col gap-6 p-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <History className="w-8 h-8" />
            Command History
          </h1>
          <p className="font-mono text-xs text-black/60 mt-1">
            All your saved AI campaigns — browse outputs, re-dispatch to channels, or download reports.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex items-center gap-2 border-2 border-black px-3 py-1.5 shadow-[2px_2px_0_0_#000] ${isLive ? "bg-neo-lime" : "bg-gray-100"}`}>
            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${isLive ? "bg-green-600 animate-pulse" : "bg-gray-400"}`} />
            <span className="font-mono text-[10px] font-bold uppercase">{isLive ? "Live Sync" : "Offline"}</span>
          </div>
          <button
            onClick={() => { setPage(1); void load(); }}
            className="flex items-center gap-2 border-[3px] border-black bg-white px-4 py-2.5 font-mono text-xs font-bold uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000] transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <a
            href="/dashboard"
            className="flex items-center gap-2 border-[3px] border-black bg-neo-cyan px-4 py-2.5 font-display font-black text-xs uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000] transition-all text-black"
          >
            + New Campaign
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Total Saved",  value: total,          color: "bg-neo-cyan"   },
          { label: "Completed",    value: completedCount,  color: "bg-neo-yellow" },
          { label: "Dispatched",   value: dispatchedCount, color: "bg-neo-lime"   },
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
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search campaigns by prompt…"
            className="w-full border-[3px] border-black pl-10 pr-4 py-3 font-mono text-sm shadow-[4px_4px_0_0_#000] focus:outline-none focus:border-neo-cyan bg-white"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border-[3px] border-black pl-9 pr-8 py-3 font-mono text-sm shadow-[4px_4px_0_0_#000] bg-white focus:outline-none appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="dispatched">Dispatched</option>
            <option value="failed">Failed</option>
            <option value="archived">Archived</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-black/60" />
        </div>
      </div>

      {/* Live update banner */}
      {liveCount > 0 && (
        <div className="flex items-center gap-3 border-2 border-green-400 bg-green-50 px-4 py-2.5 shadow-[2px_2px_0_0_#000]">
          <Activity className="w-4 h-4 text-green-700 animate-pulse flex-shrink-0" />
          <span className="font-mono text-xs font-bold text-green-800">
            {liveCount} live update{liveCount !== 1 ? "s" : ""} received — list is up-to-date.
          </span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 border-[3px] border-dashed border-black/20">
          <Loader2 className="w-8 h-8 animate-spin text-black/30" />
          <span className="font-mono text-sm text-black/50">Loading campaign history…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-5 py-24 border-[3px] border-dashed border-black/20">
          <div className="w-16 h-16 flex items-center justify-center border-[3px] border-dashed border-black/20 bg-gray-50">
            <History className="w-8 h-8 text-black/20" />
          </div>
          <div className="text-center">
            <p className="font-display font-black text-xl text-black/30">
              {search ? `No campaigns match "${search}"` : "No campaigns saved yet"}
            </p>
            <p className="font-mono text-sm text-black/40 mt-2 max-w-sm">
              {search
                ? "Try a different search term or clear the filter."
                : "Run a campaign from Mission Control — it will automatically appear here."}
            </p>
          </div>
          <a
            href="/dashboard"
            className="flex items-center gap-2 border-2 border-black bg-neo-cyan px-5 py-2.5 font-display font-black text-sm uppercase shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 transition-all text-black"
          >
            <Play className="w-4 h-4" /> Launch a Campaign
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs text-black/50">{total} campaign{total !== 1 ? "s" : ""} saved</p>
          {items.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              formatAge={formatAge}
              onOpen={() => setSelectedItem(item)}
              onDispatch={() => setDispatch(item)}
              onArchive={() => handleArchive(item)}
            />
          ))}
          {total > 15 && (
            <div className="flex items-center justify-between border-t-[3px] border-black pt-4 mt-2">
              <span className="font-mono text-xs text-black/50">{total} total campaigns</span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="border-2 border-black px-3 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0_0_#000] hover:-translate-y-px disabled:opacity-40 transition-all bg-white">
                  ← Prev
                </button>
                <span className="flex items-center font-mono text-xs px-3 border-2 border-black/20 bg-gray-50">Page {page}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={page * 15 >= total}
                  className="border-2 border-black px-3 py-1.5 font-mono text-xs font-bold shadow-[2px_2px_0_0_#000] hover:-translate-y-px disabled:opacity-40 transition-all bg-white">
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedItem && (
        <HistoryDetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onArchive={() => handleArchive(selectedItem)}
          onDispatch={() => { setDispatch(selectedItem); setSelectedItem(null); }}
        />
      )}

      {dispatchTarget && (
        <DispatchModal
          item={dispatchTarget}
          onClose={() => setDispatch(null)}
          onDispatched={(updated) => { handleDispatched(updated); setDispatch(null); }}
        />
      )}
    </div>
  );
}
