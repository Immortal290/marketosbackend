"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Bot, AlertTriangle, ShieldCheck, Mail, Cpu, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/lib/api";

export interface PendingApprovalData {
  runId: string;
  agentName: string;
  output: Record<string, any>;
  stepId?: string;
}

interface AgentApprovalModalProps {
  data: PendingApprovalData | null;
  isOpen: boolean;
  onClose: () => void;
  onDecision: (decision: "approved" | "rejected", runId: string) => void;
}

export function AgentApprovalModal({ data, isOpen, onClose, onDecision }: AgentApprovalModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !data) return null;

  const handleAction = async (decision: "approved" | "rejected") => {
    setSubmitting(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/workflows/${data.runId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });

      if (!res.ok) {
        throw new Error(`Failed to submit decision: HTTP ${res.status}`);
      }

      toast.success(
        decision === "approved"
          ? `Approved ${data.agentName}! Workflow resuming...`
          : `Rejected ${data.agentName}. Workflow terminated.`
      );

      onDecision(decision, data.runId);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to process decision");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl border-[3px] border-black bg-white shadow-[8px_8px_0_0_#000] p-0 overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[3px] border-black bg-neo-yellow px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-black text-white shadow-[2px_2px_0_0_#fff]">
              <ShieldCheck className="h-6 w-6 text-neo-yellow" />
            </div>
            <div>
              <h3 className="font-display text-lg font-black uppercase text-black">
                Human Approval Required
              </h3>
              <p className="font-mono text-xs font-bold text-black/70">
                Agent: <span className="underline">{data.agentName}</span>
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 border-2 border-black bg-neo-pink px-3 py-1 font-mono text-xs font-bold uppercase text-black shadow-[2px_2px_0_0_#000]">
            <AlertTriangle className="h-3.5 w-3.5" /> Action Required
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
          <div className="border-2 border-black bg-neo-surface p-4 shadow-[3px_3px_0_0_#000]">
            <p className="font-mono text-xs font-bold uppercase text-black/60 mb-1">
              Workflow Run ID
            </p>
            <p className="font-mono text-sm font-black text-black">{data.runId}</p>
          </div>

          <div>
            <h4 className="font-display text-sm font-black uppercase text-black mb-2 flex items-center gap-2">
              <Bot className="h-4 w-4" /> Agent Generated Output
            </h4>
            <div className="border-2 border-black bg-gray-900 p-4 font-mono text-xs text-lime-400 overflow-x-auto rounded-none shadow-[3px_3px_0_0_#000]">
              <pre className="whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(data.output, null, 2)}
              </pre>
            </div>
          </div>

          <div className="border-2 border-black bg-amber-50 p-3 font-mono text-xs font-bold text-amber-900">
            ⚠️ Review the output above before approving. Approving will allow the workflow to resume and execute downstream tasks.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 border-t-[3px] border-black bg-neo-surface px-6 py-4">
          <button
            onClick={() => handleAction("rejected")}
            disabled={submitting}
            className="flex items-center gap-2 border-2 border-black bg-red-500 px-5 py-2.5 font-display text-sm font-black uppercase text-white shadow-[3px_3px_0_0_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50 transition-all"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Reject Workflow
          </button>
          <button
            onClick={() => handleAction("approved")}
            disabled={submitting}
            className="flex items-center gap-2 border-2 border-black bg-green-500 px-6 py-2.5 font-display text-sm font-black uppercase text-white shadow-[3px_3px_0_0_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50 transition-all"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
}
