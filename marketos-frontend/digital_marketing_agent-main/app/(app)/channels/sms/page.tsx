"use client";

/**
 * SMS Integration Page — /channels/sms
 *
 * Dedicated SMS campaign setup + sending page using the user's own Twilio credentials.
 * Design matches the WhatsApp campaign page layout (2-column: left = compose, right = preview).
 *
 * Features:
 *  - Step 1: Twilio credentials setup + real-time verification
 *  - Step 2: Full SMS campaign composer with audience + live preview
 *  - Real SMS sending via Twilio API with per-number result tracking
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  Users,
  CheckCircle2,
  XCircle,
  Shield,
  Loader2,
  AlertTriangle,
  KeyRound,
  Phone,
  Eye,
  EyeOff,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronRight,
  Info,
  Smartphone,
} from "lucide-react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoModal } from "@/components/ui/NeoModal";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type ConnectionStatus = "idle" | "verifying" | "connected" | "error";

interface SendResult {
  to: string;
  ok: boolean;
  sid?: string;
  error?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function parseNumbers(raw: string): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => {
      const clean = s.startsWith("+") ? s : "+" + s.replace(/\D/g, "");
      const digits = clean.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) return invalid.push(s);
      if (!seen.has(digits)) {
        seen.add(digits);
        valid.push(clean);
      }
    });
  return { valid, invalid };
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function PasswordField({
  id, label, hint, placeholder, value, onChange,
}: {
  id: string; label: string; hint?: string; placeholder: string;
  value: string; onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="font-mono text-xs font-bold uppercase tracking-tight">
          {label} <span className="text-neo-red">*</span>
        </label>
        {hint && (
          <span className="group relative inline-block">
            <Info size={11} className="text-black/40 cursor-help" />
            <span className="absolute left-5 top-0 z-50 hidden group-hover:block w-60 bg-neo-ink text-white font-mono text-[10px] px-2 py-1.5 leading-relaxed shadow-neo">
              {hint}
            </span>
          </span>
        )}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2.5 font-mono font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function MonoField({
  id, label, placeholder, value, onChange, hint,
}: {
  id: string; label: string; placeholder: string; value: string;
  onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="font-mono text-xs font-bold uppercase tracking-tight">
          {label} <span className="text-neo-red">*</span>
        </label>
        {hint && (
          <span className="group relative inline-block">
            <Info size={11} className="text-black/40 cursor-help" />
            <span className="absolute left-5 top-0 z-50 hidden group-hover:block w-60 bg-neo-ink text-white font-mono text-[10px] px-2 py-1.5 leading-relaxed shadow-neo">
              {hint}
            </span>
          </span>
        )}
      </div>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2.5 font-mono font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
      />
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const cfg = {
    idle: { label: "Not Connected", cls: "bg-black/10 text-black/60", Icon: WifiOff },
    verifying: { label: "Verifying…", cls: "bg-neo-yellow animate-pulse", Icon: Loader2 },
    connected: { label: "Connected · Twilio", cls: "bg-neo-green text-white", Icon: Wifi },
    error: { label: "Auth Error", cls: "bg-neo-red text-white", Icon: XCircle },
  };
  const { label, cls, Icon } = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 border-[2px] border-black font-mono text-xs font-bold uppercase ${cls}`}>
      <Icon size={11} className={status === "verifying" ? "animate-spin" : ""} />
      {label}
    </span>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function SMSPage() {
  /* Credentials */
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("idle");
  const [accountName, setAccountName] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);

  /* Compose */
  const [message, setMessage] = useState("");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* Sending */
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const { valid: validNums, invalid: invalidNums } = parseNumbers(recipientsRaw);

  const isConnected = connStatus === "connected";
  const canSend = isConnected && message.trim() && validNums.length > 0 && optIn && !sending;

  /* ── Verify ────────────────────────────────────────────────────────────── */

  const handleVerify = useCallback(async () => {
    if (!accountSid.startsWith("AC") || accountSid.length < 34) {
      toast.error("Account SID must start with 'AC' and be 34 characters.");
      return;
    }
    if (authToken.length < 20) {
      toast.error("Auth Token appears too short.");
      return;
    }
    if (!fromNumber.startsWith("+")) {
      toast.error("Phone number must be in E.164 format (+country code).");
      return;
    }

    setConnStatus("verifying");
    try {
      const { apiRequest } = await import("@/lib/api");
      const res: any = await apiRequest("/sms/verify", {
        method: "POST",
        body: JSON.stringify({ accountSid, authToken, fromNumber }),
      });

      if (!res.success) {
        setConnStatus("error");
        toast.error("Invalid credentials: " + (res.error || "Verification failed"));
        return;
      }

      setConnStatus("connected");
      setAccountName(res.account?.friendlyName || "Twilio Account");
      setSetupOpen(false);
      toast.success(`Connected as: ${res.account?.friendlyName || "Twilio"}`, {
        description: "Your Twilio SMS integration is live.",
      });
    } catch (err: any) {
      setConnStatus("error");
      toast.error("Verification error: " + err.message);
    }
  }, [accountSid, authToken, fromNumber]);

  const handleSend = useCallback(async () => {
    setConfirmOpen(false);
    setSending(true);
    setResults([]);
    setShowResults(false);

    try {
      const { apiRequest } = await import("@/lib/api");
      const res: any = await apiRequest("/sms/send", {
        method: "POST",
        body: JSON.stringify({
          accountSid,
          authToken,
          from: fromNumber,
          to: validNums,
          body: message
        }),
      });

      let finalResults = [];
      if (res.success && res.results) {
        finalResults = res.results;
        setResults(finalResults);
      } else {
        toast.error(res.error || "Failed to send SMS");
        finalResults = validNums.map(num => ({ to: num, ok: false, error: res.error || "Failed" }));
        setResults(finalResults);
      }

      setShowResults(true);
      setSending(false);

      const sent = finalResults.filter((r: any) => r.ok).length;
      const failed = finalResults.filter((r: any) => !r.ok).length;
      if (sent > 0 && failed === 0) toast.success(`All ${sent} SMS messages sent!`);
      else if (sent > 0) toast.warning(`${sent} sent, ${failed} failed.`);
    } catch (err: any) {
      toast.error("Failed to send: " + err.message);
      const finalResults = validNums.map(num => ({ to: num, ok: false, error: err.message }));
      setResults(finalResults);
      setShowResults(true);
      setSending(false);
    }
  }, [accountSid, authToken, fromNumber, message, validNums]);

  /* ─── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="flex w-full flex-1 flex-col p-6 lg:p-8 gap-6 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-neo-pink shadow-[3px_3px_0_0_#000]">
            <MessageSquare size={20} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-black uppercase tracking-tight leading-none">
              SMS Campaigns
            </h1>
            <p className="font-mono text-xs text-black/50 mt-0.5">
              Compose · send bulk SMS · track delivery · powered by your Twilio account
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={connStatus} />
          {!isConnected ? (
            <NeoButton variant="primary" size="sm" onClick={() => setSetupOpen(true)} id="sms-setup-btn">
              <KeyRound size={13} /> Connect Twilio
            </NeoButton>
          ) : (
            <NeoButton variant="ghost" size="sm" onClick={() => setSetupOpen(true)} id="sms-reconfig-btn">
              <RefreshCw size={12} /> Reconfigure
            </NeoButton>
          )}
        </div>
      </div>

      {/* Not connected banner */}
      {!isConnected && (
        <div className="flex items-start gap-3 border-[3px] border-neo-yellow bg-neo-yellow/20 px-4 py-3">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-display font-black text-sm uppercase">Twilio Not Connected</p>
            <p className="font-mono text-xs text-black/70 mt-0.5">
              Connect your Twilio account to start sending SMS campaigns. Click{" "}
              <button
                onClick={() => setSetupOpen(true)}
                className="font-bold underline hover:text-neo-pink"
              >
                Connect Twilio
              </button>{" "}
              to get started.
            </p>
          </div>
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 items-start">
        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Compose Card */}
          <NeoCard title="Compose SMS" accent="pink">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="sms-message" className="font-mono text-xs font-bold uppercase tracking-tight">
                  Message Body
                </label>
                <textarea
                  id="sms-message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Hi {name}, your order #12345 has shipped! Track it at link.com/track — Reply STOP to opt out."
                  className="w-full resize-y bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
                />
                <div className="flex justify-between">
                  <span className="font-mono text-[10px] text-black/50">
                    Include &ldquo;Reply STOP to opt out.&rdquo; for compliance.
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      message.length > 160 ? "text-neo-red" : message.length > 140 ? "text-neo-yellow" : "text-black/50"
                    }`}
                  >
                    {message.length}/160
                    {message.length > 160 && (
                      <span className="ml-1">
                        ({Math.ceil(message.length / 153)} segments)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </NeoCard>

          {/* Audience Card */}
          <NeoCard title="Audience" accent="cyan">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="sms-sender" className="font-mono text-xs font-bold uppercase tracking-tight">
                  Sender Number{" "}
                  <span className="font-normal normal-case text-black/50">
                    (your Twilio number)
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="sms-sender"
                    type="text"
                    value={fromNumber}
                    readOnly
                    placeholder="Connect Twilio first…"
                    className="flex-1 bg-neo-bg border-[3px] border-black rounded-none px-3 py-2 font-mono font-medium text-sm text-black/60 cursor-not-allowed"
                  />
                  {isConnected && (
                    <NeoBadge tone="success">
                      <CheckCircle2 size={10} /> Verified
                    </NeoBadge>
                  )}
                </div>
              </div>

              {/* Recipient list */}
              <div className="flex flex-col gap-1">
                <label htmlFor="sms-recipients" className="font-mono text-xs font-bold uppercase tracking-tight">
                  Recipient Numbers{" "}
                  <span className="font-normal normal-case text-black/50">
                    one per line, with country code
                  </span>
                </label>
                <textarea
                  id="sms-recipients"
                  rows={5}
                  value={recipientsRaw}
                  onChange={(e) => setRecipientsRaw(e.target.value)}
                  placeholder={"+919876543210\n+14155552671\n+447911123456"}
                  className="w-full resize-y bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-mono font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
                />
                <div className="flex gap-2 items-center flex-wrap mt-1">
                  {validNums.length > 0 && (
                    <NeoBadge tone="success">
                      <CheckCircle2 size={11} /> {validNums.length} valid
                    </NeoBadge>
                  )}
                  {invalidNums.length > 0 && (
                    <NeoBadge tone="danger">
                      <XCircle size={11} /> {invalidNums.length} invalid
                    </NeoBadge>
                  )}
                  {validNums.length === 0 && invalidNums.length === 0 && (
                    <span className="font-mono text-[10px] text-black/40">No numbers yet</span>
                  )}
                </div>
              </div>

              {/* Opt-in checkbox */}
              <label htmlFor="sms-optin" className="flex gap-3 items-start cursor-pointer">
                <input
                  id="sms-optin"
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="mt-1 h-4 w-4 border-[2px] border-black accent-black cursor-pointer"
                />
                <span className="font-mono text-xs leading-relaxed">
                  <strong>Required:</strong> All recipients have opted in to receive SMS from
                  my business. Sending without opt-in violates TCPA and carrier guidelines.
                </span>
              </label>

              {/* Send button */}
              <NeoButton
                id="sms-send-btn"
                variant="secondary"
                disabled={!canSend}
                onClick={() => setConfirmOpen(true)}
                className="w-full"
              >
                <Send size={15} />
                {sending
                  ? "Sending…"
                  : `Send SMS to ${validNums.length} Recipient${validNums.length === 1 ? "" : "s"}`}
              </NeoButton>

              {/* Results table */}
              {showResults && results.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3 flex-wrap">
                    <NeoBadge tone="success">
                      <CheckCircle2 size={11} /> {results.filter((r) => r.ok).length} Sent
                    </NeoBadge>
                    {results.some((r) => !r.ok) && (
                      <NeoBadge tone="danger">
                        <XCircle size={11} /> {results.filter((r) => !r.ok).length} Failed
                      </NeoBadge>
                    )}
                  </div>
                  <div className="border-[2px] border-black overflow-hidden">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="bg-neo-ink text-white">
                          <th className="px-3 py-2 text-left font-bold">Number</th>
                          <th className="px-3 py-2 text-left font-bold">Status</th>
                          <th className="px-3 py-2 text-left font-bold">SID / Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => (
                          <tr
                            key={r.to}
                            className={i % 2 === 0 ? "bg-neo-surface" : "bg-neo-bg"}
                          >
                            <td className="px-3 py-2">{r.to}</td>
                            <td className="px-3 py-2">
                              {r.ok ? (
                                <span className="inline-flex items-center gap-1 text-neo-green font-bold">
                                  <CheckCircle2 size={11} /> Sent
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-neo-red font-bold">
                                  <XCircle size={11} /> Failed
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-black/60 truncate max-w-[120px]">
                              {r.ok ? r.sid ?? "—" : r.error ?? "Unknown"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </NeoCard>
        </div>

        {/* ── RIGHT COLUMN — PREVIEW ──────────────────────────────────────── */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <NeoCard title="SMS Preview" accent="pink">
            <div className="flex flex-col gap-4">
              {/* Phone mockup */}
              <div className="relative border-[3px] border-black bg-[#1a1a2e] shadow-[3px_3px_0_0_#000] min-h-[220px] p-4 flex flex-col justify-end">
                {/* Status bar */}
                <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-1.5 bg-[#0f0f1a] border-b-[2px] border-black/50">
                  <Smartphone size={11} className="text-white/50" />
                  <span className="font-mono text-[9px] text-white/50 font-bold">SMS Preview</span>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  {message ? (
                    <div className="flex flex-col items-start gap-1">
                      <div className="bg-[#2d4a22] border-[2px] border-green-800/50 px-3 py-2 max-w-[85%] font-medium text-sm text-green-100 whitespace-pre-wrap break-words leading-relaxed rounded-lg rounded-tl-none">
                        {message}
                      </div>
                      <span className="font-mono text-[9px] text-white/40 ml-1">
                        {fromNumber || "your Twilio number"} · now
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-28 text-white/30 font-mono text-xs text-center">
                      Your SMS message will appear here as a preview bubble.
                    </div>
                  )}
                </div>
              </div>

              {/* Char count visual */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-[10px] text-black/60">Characters used</span>
                  <span className={`font-mono text-[10px] font-bold ${message.length > 160 ? "text-neo-red" : "text-black/50"}`}>
                    {message.length} / 160
                  </span>
                </div>
                <div className="h-2 w-full border-[2px] border-black bg-neo-surface overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      message.length > 160 ? "bg-neo-red" : message.length > 140 ? "bg-neo-yellow" : "bg-neo-green"
                    }`}
                    style={{ width: `${Math.min((message.length / 160) * 100, 100)}%` }}
                  />
                </div>
                {message.length > 160 && (
                  <p className="font-mono text-[10px] text-neo-red mt-1">
                    Over 160 chars — will be split into {Math.ceil(message.length / 153)} segments × billed separately.
                  </p>
                )}
              </div>
            </div>
          </NeoCard>

          {/* SMS Best Practices */}
          <NeoCard title="SMS Best Practices" accent="yellow">
            <ul className="flex flex-col gap-2">
              {[
                "Keep messages under 160 chars to avoid multi-part billing.",
                "Always include an opt-out: 'Reply STOP to unsubscribe'.",
                "Add your brand name so recipients recognise you.",
                "Send between 9 AM – 8 PM in recipient's timezone.",
                "Personalise with {name} tokens for higher engagement.",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="text-neo-green font-bold mt-0.5">›</span>
                  <span className="font-mono text-[11px] text-black/70 leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </NeoCard>

          {/* Account info */}
          {isConnected && (
            <NeoCard title="Account Info" accent="cyan">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-black/60">Account</span>
                  <span className="font-mono text-xs font-bold">{accountName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-black/60">Sender</span>
                  <span className="font-mono text-xs font-bold">{fromNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-black/60">Provider</span>
                  <span className="font-mono text-xs font-bold">Twilio</span>
                </div>
              </div>
            </NeoCard>
          )}
        </div>
      </div>

      {/* ── Twilio Setup Modal ─────────────────────────────────────────────── */}
      <NeoModal isOpen={setupOpen} onClose={() => setSetupOpen(false)} title="Connect Your Twilio Account">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 bg-neo-yellow border-[2px] border-black px-3 py-2">
            <Shield size={16} className="flex-shrink-0 mt-0.5" />
            <p className="font-mono text-xs leading-relaxed">
              Your credentials are verified live against Twilio's API. They are stored
              only in your browser session and never sent to MarketOS servers.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <MonoField
              id="sms-modal-sid"
              label="Account SID"
              hint="Found on your Twilio Console Dashboard. Always starts with AC."
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accountSid}
              onChange={setAccountSid}
            />
            <PasswordField
              id="sms-modal-token"
              label="Auth Token"
              hint="Secret key. Found below Account SID on Twilio Console."
              placeholder="••••••••••••••••••••••••••••••••"
              value={authToken}
              onChange={setAuthToken}
            />
            <MonoField
              id="sms-modal-from"
              label="Twilio Phone Number"
              hint="Your SMS-capable Twilio number in E.164 format (+countrycode...)."
              placeholder="+14155552671"
              value={fromNumber}
              onChange={setFromNumber}
            />
          </div>

          {/* Validation checks */}
          <div className="flex flex-col gap-1.5 border-[2px] border-black px-3 py-2 bg-neo-bg">
            {[
              { ok: accountSid.startsWith("AC") && accountSid.length >= 34, label: "Account SID format (AC + 32 chars)" },
              { ok: authToken.length >= 20, label: "Auth Token length (≥ 20 chars)" },
              { ok: fromNumber.startsWith("+") && fromNumber.length >= 8, label: "Phone in E.164 format (+...)" },
            ].map(({ ok, label }) => (
              <div key={label} className="flex items-center gap-2">
                {ok ? (
                  <CheckCircle2 size={12} className="text-neo-green flex-shrink-0" />
                ) : (
                  <XCircle size={12} className="text-black/30 flex-shrink-0" />
                )}
                <span className={`font-mono text-[11px] ${ok ? "text-neo-green font-bold" : "text-black/40"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {connStatus === "error" && (
            <div className="flex items-center gap-2 border-[2px] border-neo-red px-3 py-2 bg-red-50">
              <AlertTriangle size={14} className="text-neo-red flex-shrink-0" />
              <span className="font-mono text-xs text-neo-red">
                Authentication failed. Check your Account SID and Auth Token.
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <NeoButton
              id="sms-verify-btn"
              variant="primary"
              onClick={handleVerify}
              disabled={
                connStatus === "verifying" ||
                !accountSid.startsWith("AC") ||
                authToken.length < 20 ||
                !fromNumber.startsWith("+")
              }
              className="flex-1"
            >
              {connStatus === "verifying" ? (
                <><Loader2 size={13} className="animate-spin" /> Verifying…</>
              ) : (
                <><Shield size={13} /> Verify &amp; Connect</>
              )}
            </NeoButton>
            <NeoButton
              id="sms-cancel-setup-btn"
              variant="ghost"
              onClick={() => setSetupOpen(false)}
              className="flex-1"
            >
              Cancel
            </NeoButton>
          </div>
        </div>
      </NeoModal>

      {/* ── Confirm Send Modal ─────────────────────────────────────────────── */}
      <NeoModal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm SMS Send">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-neo-yellow border-[2px] border-black px-3 py-2">
            <Users size={18} />
            <p className="font-display font-black text-sm">
              You are about to send to{" "}
              <span className="underline">{validNums.length} recipient{validNums.length === 1 ? "" : "s"}</span>.
            </p>
          </div>
          <div className="border-[2px] border-black bg-[#1a1a2e] text-green-100 px-3 py-2 font-mono text-xs whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
            {message}
          </div>
          <p className="font-mono text-xs text-black/60">
            Real SMS messages will be sent from <strong>{fromNumber}</strong> via your
            Twilio account. Charges may apply per Twilio's pricing.
          </p>
          <div className="flex gap-3">
            <NeoButton id="sms-confirm-send-btn" variant="secondary" onClick={handleSend} className="flex-1">
              <Send size={14} /> Confirm &amp; Send
            </NeoButton>
            <NeoButton id="sms-cancel-confirm-btn" variant="ghost" onClick={() => setConfirmOpen(false)} className="flex-1">
              Cancel
            </NeoButton>
          </div>
        </div>
      </NeoModal>
    </div>
  );
}
