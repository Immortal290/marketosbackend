"use client";

import React, { useState, useEffect } from "react";
import {
  Users, Mail, Phone, Send, X, ShieldCheck,
  Sliders, Globe, Sparkles, Tag, Eye, KeyRound, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

interface TargetAudienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch?: (audienceData: AudienceData) => void;
  initialPrompt?: string;
}

export interface AudienceData {
  query: string;
  targetAudience: string;
  recipientEmail: string;
  recipientPhone: string;
  senderName: string;
  companyName: string;
  channels: string[];
  llmModel?: string;
  llmApiKey?: string;
  imageModel?: string;
  imageApiKey?: string;
}

// ── Highlighted prompt — marks emails & phones visually ─────────────────────
// Precise patterns: email must have valid TLD (2-6 chars), phone must have 10+ consecutive digits
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}/;
const PHONE_PATTERN = /(?:\+?\d[\d\s\-().]{8,}\d)/;

function HighlightedPrompt({ text }: { text: string }) {
  if (!text) return null;

  type Token = { kind: "email" | "phone" | "text"; value: string };
  const tokens: Token[] = [];

  const allMatches: { index: number; value: string; kind: "email" | "phone" }[] = [];
  const eRe = new RegExp(EMAIL_PATTERN.source, "g");
  const pRe = new RegExp(PHONE_PATTERN.source, "g");
  let m: RegExpExecArray | null;

  while ((m = eRe.exec(text)) !== null) {
    allMatches.push({ index: m.index, value: m[0], kind: "email" });
  }
  while ((m = pRe.exec(text)) !== null) {
    allMatches.push({ index: m.index, value: m[0], kind: "phone" });
  }
  allMatches.sort((a, b) => a.index - b.index);

  let cursor = 0;
  for (const match of allMatches) {
    if (match.index > cursor) {
      tokens.push({ kind: "text", value: text.slice(cursor, match.index) });
    }
    tokens.push({ kind: match.kind, value: match.value });
    cursor = match.index + match.value.length;
  }
  if (cursor < text.length) {
    tokens.push({ kind: "text", value: text.slice(cursor) });
  }

  return (
    <span>
      {tokens.map((tok, i) => {
        if (tok.kind === "email") {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 bg-cyan-200 border border-cyan-500 text-cyan-900 px-1 rounded font-bold font-mono text-[11px]"
            >
              <Mail className="w-2.5 h-2.5" />
              {tok.value}
            </span>
          );
        }
        if (tok.kind === "phone") {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 bg-emerald-200 border border-emerald-500 text-emerald-900 px-1 rounded font-bold font-mono text-[11px]"
            >
              <Phone className="w-2.5 h-2.5" />
              {tok.value}
            </span>
          );
        }
        return <span key={i}>{tok.value}</span>;
      })}
    </span>
  );
}

// ── Channel options ──────────────────────────────────────────────────────────
const CHANNEL_OPTIONS = [
  { id: "email",    label: "Email",    icon: "✉️" },
  { id: "sms",      label: "SMS",      icon: "💬" },
  { id: "social",   label: "Social",   icon: "📲" },
  { id: "whatsapp", label: "WhatsApp", icon: "📱" },
  { id: "voice",    label: "Voice",    icon: "📞" },
];

// ── Modal ────────────────────────────────────────────────────────────────────
export function TargetAudienceModal({
  isOpen,
  onClose,
  onLaunch,
  initialPrompt,
}: TargetAudienceModalProps) {
  const [targetAudience, setTargetAudience] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [senderName, setSenderName]         = useState("");
  const [companyName, setCompanyName]       = useState("");
  const [channels, setChannels]             = useState<string[]>(["email", "sms", "social"]);
  const [llmModel, setLlmModel]             = useState("gemini-2.0-flash");
  const [customModel, setCustomModel]       = useState("");
  const [llmApiKey, setLlmApiKey]           = useState("");
  const [savedKeyLoaded, setSavedKeyLoaded] = useState(false);
  const [imageModel, setImageModel]         = useState("black-forest-labs/FLUX.1-schnell");
  const [customImageModel, setCustomImageModel] = useState("");
  const [imageApiKey, setImageApiKey]       = useState("");
  const [isSubmitting, setIsSubmitting]     = useState(false);

  const [savedApiKeys, setSavedApiKeys] = useState<Record<string, string>>({});

  // Auto-load saved API keys from Settings > AI Models
  useEffect(() => {
    if (!isOpen) return;
    const loadSavedKey = async () => {
      try {
        const response = await apiRequest<any>("/settings/api-keys");
        if (response?.data) {
          setSavedApiKeys(response.data);
          if (llmModel.includes("gemini") && response.data.gemini) {
            setLlmApiKey(response.data.gemini);
            setSavedKeyLoaded(true);
          } else if ((llmModel.includes("gpt") || llmModel.includes("o3")) && response.data.openai) {
            setLlmApiKey(response.data.openai);
            setSavedKeyLoaded(true);
          } else if (llmModel.includes("claude") && response.data.anthropic) {
            setLlmApiKey(response.data.anthropic);
            setSavedKeyLoaded(true);
          } else if (llmModel.includes("groq") && response.data.groq) {
            setLlmApiKey(response.data.groq);
            setSavedKeyLoaded(true);
          } else if (llmModel.includes("deepseek") && response.data.openrouter) {
            setLlmApiKey(response.data.openrouter);
            setSavedKeyLoaded(true);
          } else if (llmModel.includes("llama-3.1-405b") && response.data.openrouter) {
            setLlmApiKey(response.data.openrouter);
            setSavedKeyLoaded(true);
          }
        }
      } catch (_) {
        // silently ignore — user can still type manually
      }
    };
    void loadSavedKey();
  }, [isOpen]);

  // Update API key when model changes
  useEffect(() => {
    if (llmModel.includes("gemini") && savedApiKeys.gemini) {
      setLlmApiKey(savedApiKeys.gemini);
      setSavedKeyLoaded(true);
    } else if ((llmModel.includes("gpt") || llmModel.includes("o3")) && savedApiKeys.openai) {
      setLlmApiKey(savedApiKeys.openai);
      setSavedKeyLoaded(true);
    } else if (llmModel.includes("claude") && savedApiKeys.anthropic) {
      setLlmApiKey(savedApiKeys.anthropic);
      setSavedKeyLoaded(true);
    } else if (llmModel.includes("groq") && savedApiKeys.groq) {
      setLlmApiKey(savedApiKeys.groq);
      setSavedKeyLoaded(true);
    } else if (llmModel.includes("deepseek") && savedApiKeys.openrouter) {
      setLlmApiKey(savedApiKeys.openrouter);
      setSavedKeyLoaded(true);
    } else if (llmModel.includes("llama-3.1-405b") && savedApiKeys.openrouter) {
      setLlmApiKey(savedApiKeys.openrouter);
      setSavedKeyLoaded(true);
    } else {
      setLlmApiKey("");
      setSavedKeyLoaded(false);
    }
  }, [llmModel, savedApiKeys]);

  // Auto-extract email / phone whenever the prompt changes
  // Only overwrite if a valid email/phone is found in the prompt
  useEffect(() => {
    if (!initialPrompt) return;
    const eRe = new RegExp(EMAIL_PATTERN.source, "g");
    const pRe = new RegExp(PHONE_PATTERN.source, "g");
    const emailMatch = eRe.exec(initialPrompt);
    const phoneMatch = pRe.exec(initialPrompt);
    // Strip digits-only that aren't phone-length (avoid matching zip codes)
    const rawPhone = phoneMatch ? phoneMatch[0].replace(/[\s()\-]/g, "") : "";
    const isValidPhone = rawPhone.replace(/\D/g, "").length >= 10;
    // Only override defaults if explicit email/phone found in prompt
    if (emailMatch) setRecipientEmail(emailMatch[0]);
    if (isValidPhone) setRecipientPhone(rawPhone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  if (!isOpen) return null;

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = initialPrompt || "";
    if (!query.trim()) {
      toast.error("Enter a prompt in the command bar first.");
      return;
    }
    
    setIsSubmitting(true);

    try {
      // 1. Verify LLM Key
      let llmProvider = "custom";
      if (llmModel.includes("gemini")) llmProvider = "gemini";
      else if (llmModel.includes("gpt") || llmModel.includes("o3")) llmProvider = "openai";
      else if (llmModel.includes("claude")) llmProvider = "anthropic";
      else if (llmModel.includes("groq")) llmProvider = "groq";
      else if (llmModel.includes("deepseek") || llmModel.includes("llama-3.1-405b")) llmProvider = "openrouter";

      if (llmProvider !== "custom" && llmApiKey) {
        toast.info("Verifying LLM API Key...");
        const llmVerifyRes = await fetch("/api/v1/verify-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: llmProvider, apiKey: llmApiKey })
        });
        const llmVerify = await llmVerifyRes.json();
        if (!llmVerify.valid) {
          throw new Error("Invalid LLM API Key: " + (llmVerify.error || "Verification failed"));
        }
      } else if (llmProvider !== "custom" && !llmApiKey) {
          throw new Error("LLM API Key is required for the selected model");
      }

      // 2. Verify Image Key
      let imgProvider = "custom";
      if (imageModel.includes("dall-e")) imgProvider = "dall-e";
      else if (imageModel.includes("FLUX") || imageModel.includes("black-forest")) imgProvider = "black-forest-labs";

      if (imgProvider !== "custom" && imageApiKey) {
        toast.info("Verifying Image API Key...");
        const imgVerifyRes = await fetch("/api/v1/verify-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: imgProvider, apiKey: imageApiKey })
        });
        const imgVerify = await imgVerifyRes.json();
        if (!imgVerify.valid) {
          throw new Error("Invalid Image API Key: " + (imgVerify.error || "Verification failed"));
        }
      } else if (imgProvider !== "custom" && !imageApiKey) {
          throw new Error("Image API Key is required for the selected image model");
      }

      const payload: AudienceData = {
        query,
        targetAudience,
        recipientEmail: recipientEmail.trim(),
        recipientPhone: recipientPhone.trim(),
        senderName,
        companyName,
        channels,
        llmModel: llmModel === "custom" ? (customModel.trim() || "custom-agent-llm") : llmModel,
        llmApiKey,
        imageModel: imageModel === "custom" ? (customImageModel.trim() || "custom-image-model") : imageModel,
        imageApiKey,
      };

      if (onLaunch) onLaunch(payload);
      toast.success("Campaign parameters set!", {
        description: `${channels.join(", ")} channels${recipientEmail ? ` → ${recipientEmail}` : ""}${recipientPhone ? ` / ${recipientPhone}` : ""}`,
      });
      onClose();
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasEmail = initialPrompt ? EMAIL_PATTERN.test(initialPrompt) : false;
  const hasPhone = initialPrompt ? PHONE_PATTERN.test(initialPrompt) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans">
      <div className="w-full max-w-xl border-[4px] border-black bg-neo-surface shadow-[10px_10px_0_0_#000] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b-[4px] border-black bg-neo-yellow px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-black">
              <Users className="h-5 w-5 text-neo-yellow" />
            </div>
            <div>
              <h3 className="font-display text-base font-black uppercase tracking-tight text-black">
                Audience &amp; Delivery Parameters
              </h3>
              <p className="font-mono text-[10px] font-bold text-black/60">
                Who receives this campaign and on which channels.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center border-2 border-black bg-white hover:bg-red-100 transition-colors shadow-[2px_2px_0_0_#000] active:shadow-none"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 max-h-[78vh] overflow-y-auto">

          {/* Prompt preview — read-only with highlights */}
          {initialPrompt && (
            <div className="border-2 border-black bg-gray-50 p-3 shadow-[3px_3px_0_0_#000]">
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <Eye className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />
                <span className="font-mono text-[10px] font-black uppercase text-black/60">
                  Your Prompt (from command bar)
                </span>
                {hasEmail && (
                  <span className="ml-auto flex items-center gap-0.5 bg-cyan-100 text-cyan-800 border border-cyan-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                    <Tag className="w-2.5 h-2.5" /> EMAIL DETECTED
                  </span>
                )}
                {hasPhone && (
                  <span className="ml-1 flex items-center gap-0.5 bg-emerald-100 text-emerald-800 border border-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                    <Tag className="w-2.5 h-2.5" /> PHONE DETECTED
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] text-black leading-relaxed">
                <HighlightedPrompt text={initialPrompt} />
              </p>
            </div>
          )}

          {/* Target Audience */}
          <div>
            <label className="font-display font-black text-[11px] uppercase tracking-wider text-black mb-1.5 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-blue-600" />
              Target Audience:
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full border-2 border-black p-2.5 font-mono text-xs text-black bg-white shadow-[3px_3px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-neo-yellow"
              placeholder="e.g. Young professionals 22–35, metro cities, interested in tech"
            />
          </div>

          {/* Recipient credentials */}
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1.5 border-b-2 border-black/10">
              <span className="font-display font-black text-[11px] uppercase text-black flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-emerald-600" /> Live Delivery Recipients
              </span>
              <span className="font-mono text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                LIVE API
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[10px] font-black text-black mb-1 flex items-center gap-1">
                  <Mail className="h-3 w-3 text-cyan-600" />
                  <span className="bg-cyan-100 text-cyan-800 px-1 rounded border border-cyan-300">Recipient Email</span>
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="samriddharoy0804@gmail.com"
                  className="w-full border-2 border-cyan-400 p-2 font-mono text-xs bg-cyan-50 text-black shadow-[2px_2px_0_0_#0891b2] focus:outline-none focus:border-cyan-600"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] font-black text-black mb-1 flex items-center gap-1">
                  <Phone className="h-3 w-3 text-emerald-600" />
                  <span className="bg-emerald-100 text-emerald-800 px-1 rounded border border-emerald-300">Recipient Phone</span>
                </label>
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="+917596087652"
                  className="w-full border-2 border-emerald-400 p-2 font-mono text-xs bg-emerald-50 text-black shadow-[2px_2px_0_0_#059669] focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[10px] font-bold text-black mb-1 block">Brand / Company:</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full border-2 border-black p-2 font-mono text-xs bg-white text-black shadow-[2px_2px_0_0_#000]"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] font-bold text-black mb-1 block">Sender Name:</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Growth Team"
                  className="w-full border-2 border-black p-2 font-mono text-xs bg-white text-black shadow-[2px_2px_0_0_#000]"
                />
              </div>
            </div>
          </div>

          {/* Active Channels */}
          <div>
            <label className="font-display font-black text-[11px] uppercase tracking-wider text-black mb-2 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-pink-600" /> Active Channels:
            </label>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map(({ id, label, icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggleChannel(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-black font-mono text-xs font-bold uppercase transition-all shadow-[2px_2px_0_0_#000] hover:-translate-x-px hover:-translate-y-px active:shadow-none ${
                    channels.includes(id)
                      ? "bg-neo-pink text-black shadow-[3px_3px_0_0_#000]"
                      : "bg-white text-gray-400 hover:text-black"
                  }`}
                >
                  <span>{icon}</span>
                  {channels.includes(id) ? "✓ " : ""}{label}
                </button>
              ))}
            </div>
            <p className="font-mono text-[9px] text-black/50 mt-1.5">
              Only agents for selected channels will activate in the pipeline.
            </p>
          </div>

          {/* LLM Model & API Key Configuration */}
          <div className="bg-white border-2 border-black shadow-[2px_2px_0_0_#000] p-4 flex flex-col gap-3">
            <h4 className="font-display font-black text-[11px] uppercase tracking-wider text-black flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-purple-600" />
              LLM Provider Configuration
            </h4>
            
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex-1 space-y-1">
                <label className="font-mono text-[9px] font-bold uppercase text-black/60">
                  Model Provider / Agent LLM
                </label>
                <select
                  value={llmModel}
                  onChange={(e) => {
                    setLlmModel(e.target.value);
                    if (e.target.value !== "custom") setCustomModel("");
                  }}
                  className="w-full bg-white border-[3px] border-black rounded-none px-3 py-2 font-medium font-mono text-xs shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2"
                >
                  <optgroup label="Google Gemini">
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended / Default)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </optgroup>
                  <optgroup label="Groq AI (Ultra-fast)">
                    <option value="groq-llama-3.3-70b">Groq — Llama 3.3 70B Versatile</option>
                    <option value="groq-llama3-8b">Groq — Llama 3 8B Instant</option>
                    <option value="groq-mixtral-8x7b">Groq — Mixtral 8x7B</option>
                  </optgroup>
                  <optgroup label="OpenAI">
                    <option value="gpt-4o">OpenAI GPT-4o (Omni)</option>
                    <option value="gpt-4o-mini">OpenAI GPT-4o Mini</option>
                    <option value="o3-mini">OpenAI o3-Mini Reasoning</option>
                  </optgroup>
                  <optgroup label="Anthropic Claude">
                    <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                    <option value="claude-3-haiku">Anthropic Claude 3 Haiku</option>
                  </optgroup>
                  <optgroup label="OpenRouter / Open Source">
                    <option value="deepseek/deepseek-chat">DeepSeek V3 (via OpenRouter)</option>
                    <option value="deepseek/deepseek-r1">DeepSeek R1 (via OpenRouter)</option>
                    <option value="meta-llama/llama-3.1-405b-instruct">Llama 3.1 405B (via OpenRouter)</option>
                  </optgroup>
                  <optgroup label="Custom / Specialized Agent">
                    <option value="custom">✨ Enter Custom Model ID...</option>
                  </optgroup>
                </select>

                {llmModel === "custom" && (
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="e.g. your-org/fine-tuned-llama3:v1"
                    className="w-full mt-1.5 bg-yellow-50 border-[3px] border-black rounded-none px-3 py-2 font-medium font-mono text-xs text-black shadow-[2px_2px_0_0_#000] placeholder:text-gray-400 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2"
                  />
                )}
              </div>

              <div className="flex-1 space-y-1 mt-3 sm:mt-0">
                <label className="font-mono text-[9px] font-bold uppercase text-black/60 flex items-center gap-1">
                  LLM API Key
                  {savedKeyLoaded && (
                    <span className="flex items-center gap-0.5 bg-green-100 text-green-700 border border-green-400 px-1 py-0.5 rounded text-[8px] font-bold">
                      <CheckCircle2 className="w-2.5 h-2.5" /> LOADED FROM SETTINGS
                    </span>
                  )}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-black/40" />
                  <input
                    type="password"
                    value={llmApiKey}
                    onChange={(e) => { setLlmApiKey(e.target.value); setSavedKeyLoaded(false); }}
                    placeholder={
                      savedKeyLoaded ? "••••••••••••••••••• (saved)" :
                      llmModel.includes("gemini") ? "Paste Gemini API Key (AIza...)" :
                      (llmModel.includes("gpt") || llmModel.includes("o3")) ? "Paste OpenAI API Key (sk-...)" :
                      llmModel.includes("claude") ? "Paste Anthropic API Key (sk-ant-...)" :
                      llmModel.includes("groq") ? "Paste Groq API Key (gsk_...)" :
                      (llmModel.includes("deepseek") || llmModel.includes("llama-3.1-405b")) ? "Paste OpenRouter API Key (sk-or-v1-...)" :
                      "Paste your API key here..."
                    }
                    className="w-full bg-white border-[3px] border-black rounded-none pl-7 pr-3 py-2 font-medium font-mono text-xs text-black shadow-[2px_2px_0_0_#000] placeholder:text-gray-400 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2"
                  />
                </div>
                <p className="font-mono text-[8px] text-black/40">
                  Save your key in <a href="/settings/ai-models" target="_blank" className="underline text-blue-600">Settings › AI Models</a> to auto-fill here.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start mt-2 border-t-2 border-black/10 pt-3">
              <div className="flex-1 space-y-1">
                <label className="font-mono text-[9px] font-bold uppercase text-black/60">
                  Image Generator Model
                </label>
                <select
                  value={imageModel}
                  onChange={(e) => {
                    setImageModel(e.target.value);
                    if (e.target.value !== "custom") setCustomImageModel("");
                  }}
                  className="w-full bg-white border-[3px] border-black rounded-none px-3 py-2 font-medium font-mono text-xs shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2"
                >
                  <optgroup label="HuggingFace / BFL">
                    <option value="black-forest-labs/FLUX.1-schnell">FLUX.1-schnell (Fast)</option>
                    <option value="black-forest-labs/FLUX.1-dev">FLUX.1-dev (High Quality)</option>
                  </optgroup>
                  <optgroup label="OpenAI">
                    <option value="dall-e-3">DALL-E 3 (High Quality)</option>
                    <option value="dall-e-2">DALL-E 2 (Fast)</option>
                  </optgroup>
                  <optgroup label="Custom / Other">
                    <option value="custom">✨ Enter Custom Image Model ID...</option>
                  </optgroup>
                </select>
                {imageModel === "custom" && (
                  <input
                    type="text"
                    value={customImageModel}
                    onChange={(e) => setCustomImageModel(e.target.value)}
                    placeholder="e.g. stabilityai/stable-diffusion-xl-base-1.0"
                    className="w-full mt-1.5 bg-yellow-50 border-[3px] border-black rounded-none px-3 py-2 font-medium font-mono text-xs text-black shadow-[2px_2px_0_0_#000] placeholder:text-gray-400 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2"
                  />
                )}
              </div>

              <div className="flex-1 space-y-1 mt-3 sm:mt-0">
                <label className="font-mono text-[9px] font-bold uppercase text-black/60">
                  Image API Key (HF/BFL)
                </label>
                <input
                  type="password"
                  value={imageApiKey}
                  onChange={(e) => setImageApiKey(e.target.value)}
                  placeholder={
                    imageModel.includes("dall-e") ? "Paste OpenAI API Key (sk-...)" :
                    imageModel.includes("FLUX") ? "Paste HF/BFL Token (hf_...)" :
                    "Enter API Key for image generation..."
                  }
                  className="w-full bg-white border-[3px] border-black rounded-none px-3 py-2 font-medium font-mono text-xs text-black shadow-[2px_2px_0_0_#000] placeholder:text-gray-400 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="border-2 border-black bg-white px-4 py-2.5 font-display text-xs font-black uppercase text-black shadow-[3px_3px_0_0_#000] hover:bg-gray-100 active:shadow-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 border-2 border-black bg-neo-yellow px-6 py-2.5 font-display text-xs font-black uppercase text-black shadow-[4px_4px_0_0_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000] active:shadow-none transition-all disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isSubmitting ? "Launching..." : "Launch Campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
