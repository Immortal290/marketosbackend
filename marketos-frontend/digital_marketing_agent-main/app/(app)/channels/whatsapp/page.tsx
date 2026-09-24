"use client";

/**
 * WhatsApp Campaign Page — /channels/whatsapp
 *
 * This static route overrides the generic /channels/[channelId] page for
 * WhatsApp specifically (Next.js static segments win over dynamic ones).
 *
 * The page is fully self-contained: it uses the existing NeoCard / NeoButton /
 * NeoInput / NeoBadge / NeoModal components and the neo-* Tailwind tokens so
 * it looks native to MarketOS.
 *
 * API flow:
 *   POST /api/v1/whatsapp/generate  →  { message: string }
 *   POST /api/v1/whatsapp/send      →  { sent, failed, invalidNumbers, results }
 *
 * Both calls go through the existing Next.js proxy (app/api/v1/[...path]) which
 * forwards them to the Express backend with the Clerk auth header intact.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  MessageCircle,
  Wand2,
  Send,
  Users,
  Phone,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Smartphone,
  AlertTriangle,
} from "lucide-react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoModal } from "@/components/ui/NeoModal";
import { apiRequest } from "@/lib/api";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface SendResultItem {
  to: string;
  ok: boolean;
  messageId?: string;
  error?: string;
}

interface BulkSendResponse {
  sent: number;
  failed: number;
  invalidNumbers: string[];
  results: SendResultItem[];
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
      const d = s.replace(/\D/g, "");
      if (d.length < 8 || d.length > 15) return invalid.push(s);
      if (!seen.has(d)) {
        seen.add(d);
        valid.push(d);
      }
    });
  return { valid, invalid };
}

const TONES = ["Friendly", "Premium", "Playful", "Urgent but honest", "Formal"];
const LANGUAGES = ["English", "Hindi", "Spanish", "French", "Arabic", "Portuguese", "German"];

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function WhatsAppCampaignPage() {
  // Prompt inputs
  const [prompt, setPrompt] = useState("");
  const [brand, setBrand] = useState("");
  const [tone, setTone] = useState("Friendly");
  const [language, setLanguage] = useState("English");

  // Generated / editable message
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);

  // Audience
  const [bizNumber, setBizNumber] = useState("");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [optIn, setOptIn] = useState(false);

  // Sending method
  const [showMethod, setShowMethod] = useState(false);
  const [mode, setMode] = useState<"text" | "template">("text");
  const [templateName, setTemplateName] = useState("");
  const [langCode, setLangCode] = useState("en");

  // Send state
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<BulkSendResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Live number parse
  const { valid: validNums, invalid: invalidNums } = parseNumbers(recipientsRaw);

  const canSend =
    message.trim() &&
    bizNumber.trim() &&
    validNums.length > 0 &&
    optIn &&
    !sending;

  /* ── Generate ─────────────────────────────────────────────────────────── */

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a campaign prompt first.");
      return;
    }
    setGenerating(true);
    try {
      const data = await apiRequest<{ message: string }>("/whatsapp/generate", {
        method: "POST",
        body: JSON.stringify({ prompt, brand, tone, language }),
      });
      setMessage(data.message);
      setSendResult(null);
      toast.success("Message generated!");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate message.");
    } finally {
      setGenerating(false);
    }
  }, [prompt, brand, tone, language]);

  /* ── Send ─────────────────────────────────────────────────────────────── */

  const handleSend = useCallback(async () => {
    setConfirmOpen(false);
    setSending(true);
    setSendResult(null);
    try {
      const result = await apiRequest<BulkSendResponse>("/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({
          businessNumber: bizNumber,
          recipients: recipientsRaw,
          message,
          mode,
          templateName: templateName || undefined,
          languageCode: langCode,
          optInConfirmed: optIn,
        }),
      });
      setSendResult(result);
      if (result.failed === 0) {
        toast.success(`All ${result.sent} messages sent!`);
      } else {
        toast.warning(`${result.sent} sent, ${result.failed} failed.`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Send failed.");
    } finally {
      setSending(false);
    }
  }, [bizNumber, recipientsRaw, message, mode, templateName, langCode, optIn]);

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="flex w-full flex-1 flex-col p-6 lg:p-8 gap-6 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-neo-lime shadow-[3px_3px_0_0_#000]">
          <MessageCircle size={20} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-tight leading-none">
            WhatsApp Campaigns
          </h1>
          <p className="font-mono text-xs text-black/50 mt-0.5">
            Generate AI-powered messages · preview · send via Zernio
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 items-start">
        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Campaign Prompt Card */}
          <NeoCard title="Campaign Prompt" accent="lime">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="wa-prompt"
                  className="font-mono text-xs font-bold uppercase tracking-tight"
                >
                  What should the message promote?
                </label>
                <textarea
                  id="wa-prompt"
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Diwali sale on handmade candles, 20% off till Sunday, link to shop.example.com"
                  className="w-full resize-y bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="wa-brand"
                    className="font-mono text-xs font-bold uppercase tracking-tight"
                  >
                    Brand Name
                  </label>
                  <input
                    id="wa-brand"
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Glow & Co"
                    className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="wa-tone"
                    className="font-mono text-xs font-bold uppercase tracking-tight"
                  >
                    Tone
                  </label>
                  <select
                    id="wa-tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
                  >
                    {TONES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="wa-language"
                  className="font-mono text-xs font-bold uppercase tracking-tight"
                >
                  Language
                </label>
                <select
                  id="wa-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>

              <NeoButton
                id="wa-generate-btn"
                variant="primary"
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="w-full"
              >
                <Wand2 size={15} />
                {generating ? "Writing message…" : "Generate Message"}
              </NeoButton>
            </div>
          </NeoCard>

          {/* Audience Card */}
          <NeoCard title="Audience" accent="cyan">
            <div className="flex flex-col gap-4">
              {/* Business number */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="wa-biz"
                  className="font-mono text-xs font-bold uppercase tracking-tight"
                >
                  Your Business WhatsApp Number{" "}
                  <span className="font-normal normal-case text-black/50">
                    (with country code)
                  </span>
                </label>
                <input
                  id="wa-biz"
                  type="tel"
                  inputMode="tel"
                  value={bizNumber}
                  onChange={(e) => setBizNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
                />
                <span className="font-mono text-[10px] text-black/50">
                  Must match the number connected to your Zernio account.
                </span>
              </div>

              {/* Customer numbers */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="wa-recipients"
                  className="font-mono text-xs font-bold uppercase tracking-tight"
                >
                  Customer Numbers{" "}
                  <span className="font-normal normal-case text-black/50">
                    one per line or comma-separated
                  </span>
                </label>
                <textarea
                  id="wa-recipients"
                  rows={4}
                  value={recipientsRaw}
                  onChange={(e) => setRecipientsRaw(e.target.value)}
                  placeholder={"+91 91234 56789\n+91 99887 76655\n+14155550123"}
                  className="w-full resize-y bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm font-mono"
                />

                {/* Live count */}
                {(validNums.length > 0 || invalidNums.length > 0) && (
                  <div className="flex gap-2 items-center flex-wrap mt-1">
                    {validNums.length > 0 && (
                      <NeoBadge tone="success">
                        <CheckCircle2 size={11} />
                        {validNums.length} valid
                      </NeoBadge>
                    )}
                    {invalidNums.length > 0 && (
                      <NeoBadge tone="danger">
                        <XCircle size={11} />
                        {invalidNums.length} look wrong
                      </NeoBadge>
                    )}
                  </div>
                )}
                {validNums.length === 0 && invalidNums.length === 0 && (
                  <span className="font-mono text-[10px] text-black/40">
                    No numbers yet
                  </span>
                )}
              </div>

              {/* Sending method collapsible */}
              <div className="border-[2px] border-black">
                <button
                  type="button"
                  onClick={() => setShowMethod((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2 font-mono text-xs font-bold uppercase bg-neo-surface hover:bg-neo-yellow transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Phone size={12} />
                    Sending Method
                  </span>
                  {showMethod ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showMethod && (
                  <div className="px-3 py-3 flex flex-col gap-3 border-t-[2px] border-black bg-neo-bg">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="wa-mode"
                        className="font-mono text-xs font-bold uppercase tracking-tight"
                      >
                        Message Type
                      </label>
                      <select
                        id="wa-mode"
                        value={mode}
                        onChange={(e) => setMode(e.target.value as "text" | "template")}
                        className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
                      >
                        <option value="text">
                          Regular message (customers who wrote to you in the last 24h)
                        </option>
                        <option value="template">
                          Approved template (starting a new conversation)
                        </option>
                      </select>
                    </div>

                    {mode === "template" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor="wa-tpl-name"
                            className="font-mono text-xs font-bold uppercase tracking-tight"
                          >
                            Template Name
                          </label>
                          <input
                            id="wa-tpl-name"
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="promo_offer"
                            className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor="wa-lang-code"
                            className="font-mono text-xs font-bold uppercase tracking-tight"
                          >
                            Lang Code
                          </label>
                          <input
                            id="wa-lang-code"
                            type="text"
                            value={langCode}
                            onChange={(e) => setLangCode(e.target.value)}
                            placeholder="en"
                            className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Opt-in checkbox */}
              <label
                htmlFor="wa-optin"
                className="flex gap-3 items-start cursor-pointer group"
              >
                <input
                  id="wa-optin"
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="mt-1 h-4 w-4 border-[2px] border-black accent-black cursor-pointer"
                />
                <span className="font-mono text-xs leading-relaxed">
                  <strong>Required:</strong> Every number above has agreed to
                  receive WhatsApp messages from my business. I understand that
                  sending to numbers without opt-in violates WhatsApp&apos;s
                  policies.
                </span>
              </label>

              {/* Send button */}
              <NeoButton
                id="wa-send-btn"
                variant="secondary"
                disabled={!canSend}
                onClick={() => setConfirmOpen(true)}
                className="w-full"
              >
                <Send size={15} />
                {sending
                  ? "Sending…"
                  : `Send to ${validNums.length} Customer${validNums.length === 1 ? "" : "s"}`}
              </NeoButton>

              {/* Send results */}
              {sendResult && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3 flex-wrap">
                    <NeoBadge tone="success">
                      <CheckCircle2 size={11} /> {sendResult.sent} Sent
                    </NeoBadge>
                    {sendResult.failed > 0 && (
                      <NeoBadge tone="danger">
                        <XCircle size={11} /> {sendResult.failed} Failed
                      </NeoBadge>
                    )}
                    {sendResult.invalidNumbers.length > 0 && (
                      <NeoBadge tone="warning">
                        <AlertTriangle size={11} />{" "}
                        {sendResult.invalidNumbers.length} Invalid
                      </NeoBadge>
                    )}
                  </div>

                  <div className="border-[2px] border-black overflow-hidden">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="bg-neo-ink text-white">
                          <th className="px-3 py-2 text-left font-bold">Number</th>
                          <th className="px-3 py-2 text-left font-bold">Status</th>
                          <th className="px-3 py-2 text-left font-bold">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sendResult.results.map((r, i) => (
                          <tr
                            key={r.to}
                            className={i % 2 === 0 ? "bg-neo-surface" : "bg-neo-bg"}
                          >
                            <td className="px-3 py-2">+{r.to}</td>
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
                            <td className="px-3 py-2 text-black/60">
                              {r.ok
                                ? r.messageId ?? "—"
                                : r.error ?? "Unknown error"}
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

        {/* ── RIGHT COLUMN — PREVIEW ────────────────────────────────────── */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <NeoCard title="Message Preview" accent="yellow">
            <div className="flex flex-col gap-4">
              {/* Phone mockup */}
              <div className="relative rounded-none border-[3px] border-black bg-[#d8e0d6] shadow-[3px_3px_0_0_#000] min-h-[200px] p-4 flex flex-col justify-end">
                {/* Decorative status bar */}
                <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-1.5 bg-[#b0bdb8] border-b-[2px] border-black">
                  <Smartphone size={11} className="text-black/60" />
                  <span className="font-mono text-[9px] text-black/60 font-bold">
                    WhatsApp Preview
                  </span>
                  <div className="flex gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-black/40" />
                    <div className="h-1.5 w-1.5 rounded-full bg-black/40" />
                    <div className="h-1.5 w-1.5 rounded-full bg-black/40" />
                  </div>
                </div>

                <div className="mt-6">
                  {message ? (
                    <div className="flex flex-col items-end gap-1">
                      <div className="bg-[#e3f7cf] border-[2px] border-black shadow-[2px_2px_0_0_#000] px-3 py-2 max-w-[88%] rounded-[0_0_0_12px] rounded-br-none font-medium text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {message}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[9px] text-black/50">
                          {message.length} chars
                        </span>
                        {message.length > 600 && (
                          <NeoBadge tone="warning" className="text-[9px] py-0 px-1">
                            Over 600
                          </NeoBadge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-24 text-black/40 font-mono text-xs text-center">
                      The generated message will appear here as a WhatsApp bubble.
                    </div>
                  )}
                </div>
              </div>

              {/* Editable textarea */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="wa-message"
                  className="font-mono text-xs font-bold uppercase tracking-tight"
                >
                  Edit Before Sending
                </label>
                <textarea
                  id="wa-message"
                  rows={8}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Generate a message above, or write your own here."
                  className="w-full resize-y bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 text-sm"
                />
                <div className="flex gap-2 justify-between">
                  <span className="font-mono text-[10px] text-black/50">
                    Must end with &ldquo;Reply STOP to opt out.&rdquo;
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      message.length > 600 ? "text-neo-red" : "text-black/50"
                    }`}
                  >
                    {message.length} / 600
                  </span>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-neo-yellow border-[2px] border-black px-3 py-2">
                <p className="font-mono text-[10px] font-bold uppercase mb-1 text-black/70">
                  WhatsApp Platform Rules
                </p>
                <ul className="font-mono text-[10px] text-black/60 space-y-1 list-disc list-inside">
                  <li>
                    Use <strong>Regular</strong> mode only for customers who wrote to you in the last 24 h.
                  </li>
                  <li>
                    Use <strong>Template</strong> mode for all others — you must have an approved Meta template.
                  </li>
                  <li>All numbers need a country code (e.g. +91 for India).</li>
                  <li>Recipients must have opted in before you send.</li>
                </ul>
              </div>
            </div>
          </NeoCard>

          {/* MCP info card */}
          <NeoCard title="Automate with MCP" accent="pink">
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs text-black/60 leading-relaxed">
                A WhatsApp MCP server is bundled with this project. Any MCP
                client (Claude Desktop, your own agent) can call{" "}
                <code className="bg-neo-yellow px-1 font-bold">
                  generate_whatsapp_message
                </code>{" "}
                and{" "}
                <code className="bg-neo-yellow px-1 font-bold">
                  send_whatsapp_messages
                </code>{" "}
                directly.
              </p>
              <div className="bg-neo-ink text-white px-3 py-2 font-mono text-[10px]">
                <span className="text-neo-lime">$</span> npm run mcp
              </div>
              <p className="font-mono text-[10px] text-black/40">
                Run from <code>marketos-backend/</code>. Uses the same env vars as the dashboard.
              </p>
            </div>
          </NeoCard>
        </div>
      </div>

      {/* ── Confirm Send Modal ──────────────────────────────────────────── */}
      <NeoModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Send"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-neo-yellow border-[2px] border-black px-3 py-2">
            <Users size={18} />
            <p className="font-display font-black text-sm">
              You are about to send this message to{" "}
              <span className="underline">{validNums.length} customer{validNums.length === 1 ? "" : "s"}</span>.
            </p>
          </div>

          <div className="bg-[#e3f7cf] border-[2px] border-black px-3 py-2 font-mono text-xs whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {message}
          </div>

          <p className="font-mono text-xs text-black/60">
            This will send a real WhatsApp message from your business number.
            Double-check the list before confirming.
          </p>

          <div className="flex gap-3">
            <NeoButton
              id="wa-confirm-send-btn"
              variant="secondary"
              onClick={handleSend}
              className="flex-1"
            >
              <Send size={14} /> Confirm &amp; Send
            </NeoButton>
            <NeoButton
              id="wa-cancel-send-btn"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              className="flex-1"
            >
              Cancel
            </NeoButton>
          </div>
        </div>
      </NeoModal>
    </div>
  );
}
