"use client";

/**
 * Telegram Channel Campaign Page — /channels/telegram
 *
 * Features:
 *  - AI-powered short ad message generation (≤1024 chars) with image prompt
 *  - Live character count with colour feedback
 *  - Telegram channel message preview (phone-style bubble)
 *  - Send to channel via Composio (primary) → Telegram Bot API (fallback)
 *  - Composio connection status indicator
 *
 * API flow:
 *   POST /api/v1/telegram/generate  →  { message, imagePrompt, hashtags, charCount }
 *   POST /api/v1/telegram/send      →  { sent, provider, messageId, error }
 *
 * Both calls go through the Next.js proxy → Express backend → core.ts
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Send,
  Wand2,
  Image as ImageIcon,
  Hash,
  CheckCircle2,
  XCircle,
  Copy,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Zap,
  MessageSquare,
} from "lucide-react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoModal } from "@/components/ui/NeoModal";
import { apiRequest } from "@/lib/api";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface GenerateResponse {
  message: string;
  imagePrompt: string;
  hashtags: string[];
  charCount: number;
}

interface SendResponse {
  sentCount: number;
  total: number;
  results: Array<{
    phone: string;
    sent: boolean;
    provider: string;
    messageId?: number;
    error?: string;
  }>;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const TONES = ["Friendly", "Premium", "Playful", "Urgent but honest", "Formal", "Bold"];
const LANGUAGES = ["English", "Hindi", "Spanish", "French", "Arabic", "Portuguese", "German"];
const MAX_CHARS = 1024;
const CAPTION_LIMIT = 280; // for image posts

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function charColor(count: number): string {
  if (count <= CAPTION_LIMIT) return "text-emerald-600";
  if (count <= MAX_CHARS)      return "text-amber-600";
  return "text-red-600";
}

function charBarWidth(count: number): number {
  return Math.min(100, Math.round((count / MAX_CHARS) * 100));
}

function charBarColor(count: number): string {
  if (count <= CAPTION_LIMIT) return "bg-emerald-500";
  if (count <= MAX_CHARS)      return "bg-amber-500";
  return "bg-red-500";
}

/* ─── Telegram Message Preview ───────────────────────────────────────────── */

function TelegramPreview({
  message,
  hashtags,
  imagePrompt,
  channelName,
}: {
  message: string;
  hashtags: string[];
  imagePrompt: string;
  channelName: string;
}) {
  if (!message) return null;

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-3">
      {/* Phone shell */}
      <div className="relative mx-auto w-full max-w-[340px] rounded-[32px] border-[4px] border-black bg-[#212121] shadow-[8px_8px_0_0_#000] overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between bg-[#0088cc] px-5 py-2">
          <span className="text-white text-xs font-bold">{channelName || "My Channel"}</span>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-white/80" />
            <div className="h-1.5 w-3 rounded-full bg-white/80" />
            <div className="h-1.5 w-5 rounded-full bg-white/80" />
          </div>
        </div>

        {/* Chat area */}
        <div className="min-h-[200px] bg-[#1c1c1e] p-3 flex flex-col gap-2">
          {/* Image placeholder if imagePrompt exists */}
          {imagePrompt && (
            <div className="w-full h-36 bg-[#2a2a2d] border border-white/10 rounded-xl flex flex-col items-center justify-center gap-2">
              <ImageIcon size={28} className="text-white/30" />
              <span className="text-[10px] text-white/30 text-center px-4 leading-relaxed line-clamp-2">
                {imagePrompt}
              </span>
            </div>
          )}

          {/* Message bubble */}
          <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-[#2a2a2d] px-3 py-2 shadow">
            <p className="text-white text-[12px] leading-relaxed whitespace-pre-wrap break-words">
              {message}
            </p>
            {hashtags.length > 0 && (
              <p className="mt-1 text-[#64b5f6] text-[11px] leading-relaxed">
                {hashtags.join(" ")}
              </p>
            )}
            <span className="block text-right text-[9px] text-white/30 mt-1">
              {timeStr} ✓✓
            </span>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center gap-2 bg-[#1c1c1e] border-t border-white/10 px-3 py-2">
          <div className="flex-1 h-8 rounded-full bg-[#2a2a2d] border border-white/10" />
          <div className="h-8 w-8 rounded-full bg-[#0088cc] flex items-center justify-center">
            <Send size={14} className="text-white" />
          </div>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <NeoBadge tone={message.length <= CAPTION_LIMIT ? "success" : message.length <= MAX_CHARS ? "warning" : "danger"}>
          {message.length} chars
        </NeoBadge>
        {message.length <= CAPTION_LIMIT && (
          <NeoBadge tone="success">
            <ImageIcon size={10} />
            Good for image + caption
          </NeoBadge>
        )}
        {hashtags.length > 0 && (
          <NeoBadge tone="info">
            <Hash size={10} />
            {hashtags.length} hashtags
          </NeoBadge>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function TelegramCampaignPage() {
  // Prompt inputs
  const [prompt, setPrompt]       = useState("");
  const [brand, setBrand]         = useState("");
  const [tone, setTone]           = useState("Friendly");
  const [language, setLanguage]   = useState("English");
  const [ctaUrl, setCtaUrl]       = useState("");

  // Generated content
  const [message, setMessage]         = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [hashtags, setHashtags]       = useState<string[]>([]);
  const [generating, setGenerating]   = useState(false);

  // Channel config → replaced with customer phone numbers
  const [phones, setPhones]           = useState("");
  const [botToken, setBotToken]       = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Send state
  const [sending, setSending]         = useState(false);
  const [sendResult, setSendResult]   = useState<SendResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const charCount  = message.length;
  const phoneList  = phones.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean);
  const canSend    = message.trim() && phoneList.length > 0 && !sending;

  /* ── Generate ────────────────────────────────────────────────────────── */

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a campaign prompt first.");
      return;
    }
    setGenerating(true);
    setSendResult(null);
    try {
      const data = await apiRequest<GenerateResponse>("/telegram/generate", {
        method: "POST",
        body: JSON.stringify({ prompt, brand, tone, language, ctaUrl: ctaUrl || "[LINK]" }),
      });
      setMessage(data.message ?? "");
      setImagePrompt(data.imagePrompt ?? "");
      setHashtags(data.hashtags ?? []);
      toast.success("Telegram ad generated!");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate message.");
    } finally {
      setGenerating(false);
    }
  }, [prompt, brand, tone, language, ctaUrl]);

  /* ── Send ────────────────────────────────────────────────────────────── */

  const handleSend = useCallback(async () => {
    setConfirmOpen(false);
    const parsed = phones.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean);
    if (parsed.length === 0) {
      toast.error("Please enter at least one customer phone number.");
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const result = await apiRequest<SendResponse>("/telegram/send", {
        method: "POST",
        body: JSON.stringify({
          phones: parsed,
          message,
          botToken: botToken || undefined,
        }),
      });
      setSendResult(result);
      if (result.sentCount > 0) {
        toast.success(`✅ Sent to ${result.sentCount}/${result.total} recipients!`);
      } else {
        toast.error("Failed to deliver to any recipient.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Send failed.");
    } finally {
      setSending(false);
    }
  }, [phones, message, botToken]);

  /* ── Copy to clipboard ───────────────────────────────────────────────── */

  const handleCopy = useCallback(() => {
    if (!message) return;
    navigator.clipboard.writeText(
      message + (hashtags.length ? "\n\n" + hashtags.join(" ") : "")
    );
    toast.success("Message copied to clipboard!");
  }, [message, hashtags]);

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="flex w-full flex-1 flex-col p-6 lg:p-8 gap-6 max-w-[1280px] mx-auto">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center border-[3px] border-black bg-[#0088cc] shadow-[4px_4px_0_0_#000]">
          {/* Telegram plane icon */}
          <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-2.026 9.546c-.145.658-.537.818-1.084.508l-3-2.21-1.448 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.895 14.7l-2.955-.924c-.642-.204-.654-.642.136-.953l11.527-4.445c.535-.194 1.003.131.96.87z"/>
          </svg>
        </div>
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-tight leading-none">
            Telegram Channel
          </h1>
          <p className="font-mono text-xs text-black/50 mt-0.5">
            AI ad generation · preview · post via Composio + Telegram Bot API
          </p>
        </div>

        {/* Composio badge */}
        <div className="ml-auto flex items-center gap-2 border-[2px] border-black bg-neo-yellow px-3 py-1.5 shadow-[2px_2px_0_0_#000]">
          <Zap size={13} className="fill-black" />
          <span className="font-mono text-[10px] font-bold uppercase">Composio Connected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-6 items-start">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Campaign Brief Card */}
          <NeoCard title="Campaign Brief" accent="lime">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="tg-prompt" className="font-mono text-xs font-bold uppercase tracking-tight">
                  What should the ad promote?
                </label>
                <textarea
                  id="tg-prompt"
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Diwali sale on handmade candles — 25% off this weekend only. Link: shop.example.com"
                  className="w-full resize-y bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#0088cc] focus-visible:outline-offset-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="tg-brand" className="font-mono text-xs font-bold uppercase tracking-tight">
                    Brand Name
                  </label>
                  <input
                    id="tg-brand"
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Glow & Co"
                    className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#0088cc] focus-visible:outline-offset-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="tg-tone" className="font-mono text-xs font-bold uppercase tracking-tight">
                    Tone
                  </label>
                  <select
                    id="tg-tone"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#0088cc] focus-visible:outline-offset-2 text-sm"
                  >
                    {TONES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="tg-language" className="font-mono text-xs font-bold uppercase tracking-tight">
                    Language
                  </label>
                  <select
                    id="tg-language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#0088cc] focus-visible:outline-offset-2 text-sm"
                  >
                    {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="tg-cta" className="font-mono text-xs font-bold uppercase tracking-tight">
                    CTA URL <span className="font-normal normal-case text-black/40">(optional)</span>
                  </label>
                  <input
                    id="tg-cta"
                    type="url"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://shop.example.com"
                    className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#0088cc] focus-visible:outline-offset-2 text-sm"
                  />
                </div>
              </div>

              <NeoButton
                id="tg-generate-btn"
                variant="primary"
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="w-full"
              >
                <Wand2 size={15} />
                {generating ? "Generating ad…" : "Generate Telegram Ad"}
              </NeoButton>
            </div>
          </NeoCard>

          {/* Generated Message Editor */}
          {message && (
            <NeoCard title="Generated Ad Message" accent="cyan">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="tg-message" className="font-mono text-xs font-bold uppercase tracking-tight">
                      Edit before sending
                    </label>
                    <span className={`font-mono text-xs font-bold ${charColor(charCount)}`}>
                      {charCount} / {MAX_CHARS}
                    </span>
                  </div>

                  {/* Char progress bar */}
                  <div className="h-1.5 w-full bg-black/10 border border-black/20">
                    <div
                      className={`h-full transition-all duration-300 ${charBarColor(charCount)}`}
                      style={{ width: `${charBarWidth(charCount)}%` }}
                    />
                  </div>

                  <textarea
                    id="tg-message"
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full resize-y bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#0088cc] focus-visible:outline-offset-2 text-sm"
                  />

                  {charCount > CAPTION_LIMIT && charCount <= MAX_CHARS && (
                    <p className="font-mono text-[10px] text-amber-600 flex items-center gap-1">
                      <AlertTriangle size={10} />
                      Over {CAPTION_LIMIT} chars — text-only post (no image caption). Shorten for image post.
                    </p>
                  )}
                  {charCount > MAX_CHARS && (
                    <p className="font-mono text-[10px] text-red-600 flex items-center gap-1">
                      <AlertTriangle size={10} />
                      Exceeds {MAX_CHARS} char Telegram limit. Please shorten.
                    </p>
                  )}
                </div>

                {/* Hashtags */}
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {hashtags.map((h) => (
                      <span
                        key={h}
                        className="inline-flex items-center gap-1 border-[2px] border-[#0088cc] bg-[#0088cc]/10 px-2 py-0.5 text-[11px] font-mono font-bold text-[#0088cc]"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                {/* Image Prompt */}
                {imagePrompt && (
                  <div className="border-l-[3px] border-[#0088cc] pl-3 bg-[#0088cc]/5 py-2 pr-2">
                    <p className="font-mono text-[10px] font-bold uppercase text-[#0088cc] mb-1">
                      Image Prompt (for FLUX / DALL-E)
                    </p>
                    <p className="font-mono text-[11px] text-black/70 leading-relaxed">{imagePrompt}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <NeoButton
                    id="tg-copy-btn"
                    variant="secondary"
                    onClick={handleCopy}
                    className="flex-1"
                  >
                    <Copy size={13} />
                    Copy
                  </NeoButton>
                  <NeoButton
                    id="tg-regenerate-btn"
                    variant="secondary"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex-1"
                  >
                    <RefreshCw size={13} />
                    Regenerate
                  </NeoButton>
                </div>
              </div>
            </NeoCard>
          )}

          {/* Recipient Phone Numbers */}
          <NeoCard title="Recipient Phone Numbers" accent="pink">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="tg-phones" className="font-mono text-xs font-bold uppercase tracking-tight">
                  Customer Phone Numbers
                </label>
                <textarea
                  id="tg-phones"
                  rows={5}
                  value={phones}
                  onChange={(e) => setPhones(e.target.value)}
                  placeholder={`+919876543210\n+14155552671\n+447911123456`}
                  className="w-full resize-y bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#0088cc] focus-visible:outline-offset-2 text-sm font-mono"
                />
                <span className="font-mono text-[10px] text-black/50">
                  Enter one number per line or comma-separated. Use international format (e.g. +919876543210).
                  Each customer must have previously started your bot to receive messages.
                </span>
                {phoneList.length > 0 && (
                  <span className="font-mono text-[10px] text-[#0088cc] font-bold">
                    {phoneList.length} recipient{phoneList.length !== 1 ? "s" : ""} entered
                  </span>
                )}
              </div>

              {/* Advanced: Bot token override */}
              <div className="border-[2px] border-black">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2 font-mono text-xs font-bold uppercase bg-neo-surface hover:bg-neo-yellow transition-colors"
                >
                  <span>Advanced — Bot Token Override</span>
                  <span className="text-black/40">{showAdvanced ? "▲" : "▼"}</span>
                </button>
                {showAdvanced && (
                  <div className="px-3 py-3 border-t-[2px] border-black bg-neo-bg">
                    <label htmlFor="tg-bot-token" className="font-mono text-xs font-bold uppercase tracking-tight block mb-1">
                      Bot Token <span className="font-normal normal-case text-black/40">(leave blank to use server .env)</span>
                    </label>
                    <input
                      id="tg-bot-token"
                      type="password"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="123456789:AAF..."
                      className="w-full bg-neo-surface border-[3px] border-black rounded-none px-3 py-2 font-medium shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#0088cc] focus-visible:outline-offset-2 text-sm font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Send button */}
              <NeoButton
                id="tg-send-btn"
                variant="primary"
                onClick={() => {
                  if (!message.trim()) {
                    toast.error("Generate a message first.");
                    return;
                  }
                  if (phoneList.length === 0) {
                    toast.error("Enter at least one customer phone number.");
                    return;
                  }
                  setConfirmOpen(true);
                }}
                disabled={!canSend}
                className="w-full"
              >
                <Send size={15} />
                {sending ? `Sending to ${phoneList.length} recipients…` : `Send to ${phoneList.length || "?"} Customer${phoneList.length !== 1 ? "s" : ""}`}
              </NeoButton>

              {/* Send result */}
              {sendResult && (
                <div className="flex flex-col gap-2">
                  {/* Summary bar */}
                  <div className={`flex items-center gap-3 border-[3px] px-3 py-2 ${
                    sendResult.sentCount === sendResult.total
                      ? "border-emerald-600 bg-emerald-50"
                      : sendResult.sentCount > 0
                      ? "border-amber-500 bg-amber-50"
                      : "border-red-500 bg-red-50"
                  }`}>
                    {sendResult.sentCount === sendResult.total ? (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    ) : sendResult.sentCount > 0 ? (
                      <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-red-500 shrink-0" />
                    )}
                    <p className="font-mono text-sm font-bold">
                      {sendResult.sentCount}/{sendResult.total} delivered
                    </p>
                  </div>

                  {/* Per-recipient results */}
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto border-[2px] border-black">
                    {sendResult.results.map((r, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-3 py-1.5 border-b border-black/10 last:border-0 ${
                          r.sent ? "bg-emerald-50" : "bg-red-50"
                        }`}
                      >
                        <span className="font-mono text-[11px] font-bold">{r.phone}</span>
                        <div className="flex items-center gap-2">
                          {r.sent ? (
                            <>
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              <span className="font-mono text-[10px] text-emerald-700">
                                {r.provider}{r.messageId ? ` #${r.messageId}` : ""}
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle size={13} className="text-red-500" />
                              <span className="font-mono text-[10px] text-red-600 max-w-[160px] truncate">
                                {r.error ?? "failed"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </NeoCard>
        </div>

        {/* ── RIGHT COLUMN — Preview ──────────────────────────────────── */}
        <div className="flex flex-col gap-5 sticky top-6">
          <NeoCard title="Channel Preview" accent="yellow">
            {message ? (
              <TelegramPreview
                message={message}
                hashtags={hashtags}
                imagePrompt={imagePrompt}
                channelName={phoneList.length > 0 ? `${phoneList.length} recipient${phoneList.length !== 1 ? "s" : ""}` : "Preview"}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center border-[3px] border-black/20 bg-[#0088cc]/10">
                  <MessageSquare size={22} className="text-black/30" />
                </div>
                <p className="font-mono text-xs text-black/40 max-w-[180px] leading-relaxed">
                  Generate an ad message to see the Telegram channel preview
                </p>
              </div>
            )}
          </NeoCard>

          {/* Setup Guide */}
          <NeoCard title="Setup Guide" accent="lime">
            <ol className="flex flex-col gap-3">
              {[
                {
                  step: "1",
                  title: "Create a Bot",
                  desc: "Message @BotFather on Telegram → /newbot → copy the token into .env as TELEGRAM_BOT_TOKEN",
                },
                {
                  step: "2",
                  title: "User Opt-in",
                  desc: "Customers must first start a chat with your bot (or be in a group with it) to receive messages.",
                },
                {
                  step: "3",
                  title: "Enter Phone Numbers",
                  desc: "Enter customer phone numbers (e.g. +919876543210) or numeric chat IDs in the text area.",
                },
                {
                  step: "4",
                  title: "Bulk Send",
                  desc: "Click Send to dispatch the ad message directly to each customer via the Telegram Bot API.",
                },
              ].map(({ step, title, desc }) => (
                <li key={step} className="flex gap-3 items-start">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center border-[2px] border-black bg-[#0088cc] font-mono text-xs font-bold text-white shadow-[2px_2px_0_0_#000]">
                    {step}
                  </span>
                  <div>
                    <p className="font-mono text-xs font-bold">{title}</p>
                    <p className="font-mono text-[10px] text-black/50 leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </NeoCard>
        </div>
      </div>

      {/* ── Confirm Modal ────────────────────────────────────────────────── */}
      <NeoModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Send to Customers?"
      >
        <div className="flex flex-col gap-4">
          <p className="font-mono text-sm">
            This will send the ad message to{" "}
            <strong className="font-bold">{phoneList.length} customer{phoneList.length !== 1 ? "s" : ""}</strong>{" "}
            via Telegram Bot API.
          </p>

          {/* Recipient list preview */}
          <div className="border-[2px] border-black bg-neo-bg px-3 py-2 max-h-32 overflow-y-auto">
            {phoneList.map((p, i) => (
              <p key={i} className="font-mono text-xs text-black/70">{p}</p>
            ))}
          </div>

          {/* Message preview in modal */}
          <div className="border-[2px] border-black bg-neo-bg px-3 py-2 max-h-32 overflow-y-auto">
            <p className="font-mono text-xs whitespace-pre-wrap">{message}</p>
            {hashtags.length > 0 && (
              <p className="font-mono text-xs text-[#0088cc] mt-1">{hashtags.join(" ")}</p>
            )}
          </div>

          <div className="flex gap-3">
            <NeoButton
              id="tg-confirm-send-btn"
              variant="primary"
              onClick={handleSend}
              disabled={sending}
              className="flex-1"
            >
              <Send size={14} />
              {sending ? "Sending…" : "Yes, Send Now"}
            </NeoButton>
            <NeoButton
              id="tg-cancel-btn"
              variant="secondary"
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
