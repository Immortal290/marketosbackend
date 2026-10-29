"use client";

import React, { useState, useEffect } from "react";
import {
  Users, Mail, Phone, Send, X, ShieldCheck,
  Sliders, Globe, Sparkles, Tag, Eye, KeyRound, CheckCircle2,
  DollarSign, TrendingUp, Layers, Maximize2, PieChart, Info, ChevronDown, ChevronUp, BarChart2,
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
  budget?: number;
  industry?: string;
  marketingGoal?: string;
  budgetPlan?: any;
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
  const [llmModel, setLlmModel]             = useState("gpt-4o-mini");
  const [customModel, setCustomModel]       = useState("");
  const [llmApiKey, setLlmApiKey]           = useState("");
  const [imageModel, setImageModel]         = useState("google/gemini-2.5-flash-image");
  const [customImageModel, setCustomImageModel] = useState("");
  const [imageApiKey, setImageApiKey]       = useState("");
  const [sameKeyForImage, setSameKeyForImage] = useState(true); // auto-sync image key from LLM key
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [budget, setBudget]                 = useState<number>(1000);
  const [industry, setIndustry]             = useState<string>("ecommerce");
  const [marketingGoal, setMarketingGoal]   = useState<string>("reach");
  const [budgetPlan, setBudgetPlan]         = useState<any>(null);
  const [isLoadingPlan, setIsLoadingPlan]   = useState<boolean>(false);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);

  // Track whether the user manually edited the LLM key — if so, never auto-overwrite it
  const userEditedLlmKey   = React.useRef(false);
  const userEditedImageKey = React.useRef(false);

  const [savedApiKeys, setSavedApiKeys] = useState<Record<string, string>>({});

  // Load saved API keys when modal opens — just populate savedApiKeys,
  // the model-change effect below will set the key field accordingly
  useEffect(() => {
    if (!isOpen) return;
    // Reset user-edit flags and same-key toggle whenever the modal reopens
    userEditedLlmKey.current   = false;
    userEditedImageKey.current = false;
    setSameKeyForImage(true);
    const loadSavedKey = async () => {
      try {
        const response = await apiRequest<any>("/settings/api-keys");
        if (response?.data) {
          setSavedApiKeys(response.data);
        }
      } catch (_) {
        // silently ignore — user can still type manually
      }
    };
    void loadSavedKey();
  }, [isOpen]);

  // Auto-fill LLM key from saved keys when model changes
  // NEVER overwrite if the user has manually edited the key field
  useEffect(() => {
    if (userEditedLlmKey.current) return; // user typed something — leave it alone

    let autoKey = "";
    if (llmModel.includes("gemini"))                                               autoKey = savedApiKeys.gemini      ?? "";
    else if (llmModel.includes("gpt") || llmModel.includes("o3"))                 autoKey = savedApiKeys.openai      ?? "";
    else if (llmModel.includes("claude"))                                          autoKey = savedApiKeys.anthropic   ?? "";
    else if (llmModel.includes("groq"))                                            autoKey = savedApiKeys.groq        ?? "";
    else if (llmModel.includes("deepseek") || llmModel.includes("llama-3.1-405b")) autoKey = savedApiKeys.openrouter ?? "";

    setLlmApiKey(autoKey);
  }, [llmModel, savedApiKeys]);

  // Auto-fill image key: if sameKeyForImage is on, mirror LLM key; else use saved keys
  useEffect(() => {
    if (sameKeyForImage) {
      setImageApiKey(llmApiKey);
      return;
    }
    if (userEditedImageKey.current) return;

    let autoKey = "";
    // OpenRouter models (meta/, google/, muse, slash-separated)
    if (imageModel.includes("meta/") || imageModel.includes("google/") || imageModel.includes("muse") || (imageModel.includes("/") && !imageModel.includes("black-forest")))
      autoKey = savedApiKeys.openrouter ?? "";
    else if (imageModel.includes("dall-e"))
      autoKey = savedApiKeys.openai ?? "";
    // FLUX/HF and Together don't have a saved key slot by default

    setImageApiKey(autoKey);
  }, [imageModel, savedApiKeys, llmApiKey, sameKeyForImage]);

  // AI Budget & Market Trends Plan fetcher
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchPlan = async () => {
      setIsLoadingPlan(true);
      try {
        const response = await apiRequest<any>("/finance/ai-budget-plan", {
          method: "POST",
          body: JSON.stringify({
            totalBudget: budget,
            industry,
            goal: marketingGoal,
            channels,
          }),
        });
        if (response?.data && isMounted) {
          setBudgetPlan(response.data);
        }
      } catch (err) {
        if (!isMounted) return;
        const b = Math.max(100, Number(budget) || 1000);
        setBudgetPlan({
          totalBudget: b,
          industry,
          goal: marketingGoal,
          normalMarketSpend: {
            min: industry === "saas" ? 2500 : industry === "ecommerce" ? 1500 : 1000,
            max: industry === "saas" ? 7500 : industry === "ecommerce" ? 4500 : 3500,
            average: industry === "saas" ? 4500 : industry === "ecommerce" ? 2500 : 2000,
            currency: "USD",
            benchmarkSummary: "Estimated market trend standard benchmark for digital marketing channels.",
          },
          totalEstimatedImpressions: Math.round((b / 8.5) * 1000),
          totalEstimatedClicks: Math.round(b / 0.85),
          projectedOverallRoas: 3.9,
          exactAdCosts: {
            mediaSpend: b,
            estimatedCpcAvg: 0.85,
            estimatedCpmAvg: 8.5,
            projectedRevenue: Math.round(b * 3.9),
          },
          platforms: [
            {
              platformId: "meta",
              platformName: "Meta (Instagram & Facebook)",
              sharePct: 40,
              allocatedAmount: Math.round(b * 0.4),
              avgCpm: 8.4,
              avgCpc: 0.78,
              estimatedImpressions: Math.round(((b * 0.4) / 8.4) * 1000),
              estimatedClicks: Math.round((b * 0.4) / 0.78),
              projectedRoas: 3.9,
              recommendedSizes: [
                { format: "Feed Square", dimensions: "1080 x 1080 px", aspectRatio: "1:1", description: "Universal high-engagement ad square" },
                { format: "Reels / Stories", dimensions: "1080 x 1920 px", aspectRatio: "9:16", description: "Full-screen mobile video & dynamic reach" },
                { format: "Landscape Header", dimensions: "1200 x 628 px", aspectRatio: "1.91:1", description: "Desktop feed and banner" },
              ],
            },
            {
              platformId: "google",
              platformName: "Google Ads (Search & Display)",
              sharePct: 30,
              allocatedAmount: Math.round(b * 0.3),
              avgCpm: 14.2,
              avgCpc: 1.65,
              estimatedImpressions: Math.round(((b * 0.3) / 14.2) * 1000),
              estimatedClicks: Math.round((b * 0.3) / 1.65),
              projectedRoas: 4.1,
              recommendedSizes: [
                { format: "Responsive Display", dimensions: "1200 x 628 px", aspectRatio: "1.91:1", description: "Google Display Network hero banner" },
                { format: "YouTube Video Ad", dimensions: "1920 x 1080 px", aspectRatio: "16:9", description: "HD In-Stream Video" },
                { format: "Search Ad", dimensions: "15 Headlines x 4 Descriptions", aspectRatio: "Responsive", description: "High-intent search keyword matching" },
              ],
            },
            {
              platformId: "whatsapp",
              platformName: "WhatsApp Business API",
              sharePct: 15,
              allocatedAmount: Math.round(b * 0.15),
              avgCpm: 45.0,
              avgCpc: 0.35,
              estimatedImpressions: Math.round(((b * 0.15) / 45) * 1000),
              estimatedClicks: Math.round((b * 0.15) / 0.35),
              projectedRoas: 5.4,
              recommendedSizes: [
                { format: "Rich Media Interactive Card", dimensions: "1080 x 1080 px", aspectRatio: "1:1", description: "Header card + Quick Reply CTAs" },
              ],
            },
            {
              platformId: "email",
              platformName: "Email Marketing",
              sharePct: 15,
              allocatedAmount: Math.round(b * 0.15),
              avgCpm: 2.0,
              avgCpc: 0.25,
              estimatedImpressions: Math.round(((b * 0.15) / 2) * 1000),
              estimatedClicks: Math.round((b * 0.15) / 0.25),
              projectedRoas: 6.2,
              recommendedSizes: [
                { format: "Newsletter Hero", dimensions: "600 x 300 px", aspectRatio: "2:1", description: "Responsive email hero banner" },
              ],
            },
          ],
          aiRecommendation: `Budget of $${b.toLocaleString()} automatically segregated across active channels for maximum market reach.`,
        });
      } finally {
        if (isMounted) setIsLoadingPlan(false);
      }
    };

    fetchPlan();
    return () => {
      isMounted = false;
    };
  }, [isOpen, budget, industry, marketingGoal, channels]);


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
    // Extract api key if provided in the prompt
    // Note: sk-or- (OpenRouter) must be checked BEFORE sk- (OpenAI) to avoid misclassification
    const apiKeyMatch =
      initialPrompt.match(/(?:api_key|apikey|key)\s*[:=]\s*([A-Za-z0-9_-]{20,})/i) ||
      initialPrompt.match(/(AIza[0-9A-Za-z-_]{35}|sk-or-[a-zA-Z0-9_-]{20,}|sk-[a-zA-Z0-9]{32,}|gsk_[a-zA-Z0-9]{20,})/);
    // Only override defaults if explicit email/phone/key found in prompt
    if (emailMatch) setRecipientEmail(emailMatch[0]);
    if (isValidPhone) setRecipientPhone(rawPhone);
    if (apiKeyMatch) {
      const extractedKey = apiKeyMatch[1] || apiKeyMatch[0];
      setLlmApiKey(extractedKey);
      if (extractedKey.startsWith("sk-or-")) {
        // OpenRouter key — default to DeepSeek (works well with OpenRouter)
        setLlmModel("deepseek/deepseek-chat");
      } else if (extractedKey.startsWith("gsk_")) {
        setLlmModel("groq-llama-3.3-70b");
      } else if (extractedKey.startsWith("sk-ant-")) {
        setLlmModel("claude-3-5-sonnet-20241022");
      } else if (extractedKey.startsWith("sk-")) {
        setLlmModel("gpt-4o-mini");
      } else if (extractedKey.startsWith("AIza")) {
        setLlmModel("gemini-2.5-flash");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  if (!isOpen) return null;

  // Detect which provider a key belongs to based on its prefix
  const detectKeyProvider = (key: string): string | null => {
    if (!key) return null;
    if (key.startsWith("sk-or-")) return "openrouter";
    if (key.startsWith("gsk_"))   return "groq";
    if (key.startsWith("AIza"))   return "gemini";
    if (key.startsWith("sk-ant-")) return "anthropic";
    if (key.startsWith("sk-"))    return "openai";
    return null;
  };

  // Detect which provider a model requires
  const getModelProvider = (model: string): string => {
    if (model.includes("gemini"))  return "gemini";
    if (model.includes("gpt") || model.includes("o3")) return "openai";
    if (model.includes("claude")) return "anthropic";
    if (model.includes("groq") || model.includes("llama") || model.includes("mixtral")) return "groq";
    if (model.includes("deepseek") || model.includes("/")) return "openrouter";
    return "custom";
  };

  const keyProvider    = detectKeyProvider(llmApiKey);
  const modelProvider  = getModelProvider(llmModel);
  const hasMismatch    = !!keyProvider && !!modelProvider && keyProvider !== modelProvider && modelProvider !== "custom";

  const providerLabel: Record<string, string> = {
    openrouter: "OpenRouter (sk-or-v1-...)",
    openai:     "OpenAI (sk-...)",
    groq:       "Groq (gsk_...)",
    gemini:     "Gemini (AIza...)",
    anthropic:  "Anthropic (sk-ant-...)",
  };

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
      // Helper: detect provider from key format (overrides model-based detection)
      const detectProviderFromKey = (key: string): string | null => {
        const k = key.trim();
        if (k.startsWith("sk-or-"))  return "openrouter";
        if (k.startsWith("gsk_"))    return "groq";
        if (k.startsWith("AIza"))    return "gemini";
        if (k.startsWith("sk-ant-")) return "anthropic";
        if (k.startsWith("sk-"))     return "openai";
        return null;
      };

      // 1. Verify LLM Key
      let llmProvider = "custom";
      if (llmModel.includes("gemini")) llmProvider = "gemini";
      else if (llmModel.includes("gpt") || llmModel.includes("o3")) llmProvider = "openai";
      else if (llmModel.includes("claude")) llmProvider = "anthropic";
      else if (llmModel.includes("groq")) llmProvider = "groq";
      else if (llmModel.includes("deepseek") || llmModel.includes("llama-3.1-405b")) llmProvider = "openrouter";

      // Override provider if key format tells us something different
      const detectedLlmProvider = llmApiKey ? detectProviderFromKey(llmApiKey) : null;
      if (detectedLlmProvider) llmProvider = detectedLlmProvider;

      if (hasMismatch) {
        throw new Error(
          `Key/model mismatch! Your key is for ${providerLabel[keyProvider!] ?? keyProvider} but model requires ${providerLabel[modelProvider] ?? modelProvider}. Please enter the correct API key.`
        );
      }

      if (llmApiKey) {
        toast.info("Verifying LLM API Key...");
        const llmVerifyRes = await fetch("/api/v1/verify-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: llmProvider, apiKey: llmApiKey.trim() })
        });
        const llmVerify = await llmVerifyRes.json();
        if (!llmVerify.valid) {
          throw new Error("Invalid LLM API Key: " + (llmVerify.error || "Verification failed"));
        }
        toast.success("LLM key verified ✓");
      } else if (llmProvider !== "custom") {
        throw new Error("LLM API Key is required. Please enter your API key.");
      }

      // 2. Resolve effective image key (may be same as LLM key)
      const effectiveImageKey = sameKeyForImage ? llmApiKey : imageApiKey;

      // 3. Verify Image Key only if different from already-verified LLM key
      // Image provider detection
      let imgProvider = "openrouter"; // MetaMuse and all OpenRouter models use openrouter
      if (imageModel.includes("dall-e"))                                           imgProvider = "openai";
      else if (imageModel.includes("FLUX") || imageModel.includes("black-forest")) imgProvider = "black-forest-labs";
      else if (imageModel.includes("together"))                                    imgProvider = "together";
      // meta/, google/, muse, and any slash-model → openrouter (already set as default)

      if (!sameKeyForImage && effectiveImageKey) {
        toast.info("Verifying Image API Key...");
        const imgVerifyRes = await fetch("/api/v1/verify-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: imgProvider, apiKey: effectiveImageKey.trim() })
        });
        const imgVerify = await imgVerifyRes.json();
        if (!imgVerify.valid) {
          throw new Error("Invalid Image API Key: " + (imgVerify.error || "Verification failed"));
        }
        toast.success("Image key verified ✓");
      } else if (!sameKeyForImage && !effectiveImageKey && imgProvider !== "custom") {
        throw new Error("Image API Key is required for the selected image model.");
      }

      const payload: AudienceData = {
        query,
        targetAudience,
        recipientEmail: recipientEmail.trim(),
        recipientPhone: recipientPhone.trim(),
        senderName,
        companyName,
        channels,
        budget,
        industry,
        marketingGoal,
        budgetPlan,
        llmModel: llmModel === "custom" ? (customModel.trim() || "custom-agent-llm") : llmModel,
        llmApiKey: llmApiKey.trim(),
        imageModel: imageModel === "custom" ? (customImageModel.trim() || "custom-image-model") : imageModel,
        imageApiKey: effectiveImageKey.trim(),
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

          {/* Marketing Budget & AI Platform Segregation (Market Trend Calculator) */}
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b-2 border-black/10 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center border-2 border-black bg-neo-yellow">
                  <DollarSign className="h-4 w-4 text-black" />
                </div>
                <div>
                  <h4 className="font-display font-black text-xs uppercase tracking-wider text-black">
                    Marketing Budget &amp; AI Platform Segregation
                  </h4>
                  <p className="font-mono text-[9px] text-black/60">
                    AI calculates ad sizes and allocates funds across platforms for maximum reach.
                  </p>
                </div>
              </div>
              <span className="font-mono text-[9px] font-black uppercase bg-lime-200 border border-black px-2 py-0.5 rounded shadow-[1px_1px_0_0_#000]">
                {isLoadingPlan ? "Optimizing..." : "Market Trend AI ✓"}
              </span>
            </div>

            {/* Budget Input & Quick Chips */}
            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] font-black uppercase text-black flex items-center justify-between">
                <span>Total Marketing Spend ($ USD):</span>
                <span className="text-black/50 font-normal">Normal Market Benchmark: {budgetPlan?.normalMarketSpend ? `$${budgetPlan.normalMarketSpend.min.toLocaleString()} - $${budgetPlan.normalMarketSpend.max.toLocaleString()}` : "$1,000 - $3,500"}</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-display font-black text-sm text-black/60">$</span>
                  <input
                    type="number"
                    min="100"
                    step="50"
                    value={budget}
                    onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
                    className="w-full border-2 border-black pl-7 pr-3 py-2 font-mono text-sm font-bold bg-white text-black shadow-[2px_2px_0_0_#000] focus:outline-none focus:ring-2 focus:ring-neo-yellow"
                    placeholder="1000"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[500, 1000, 2500, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBudget(preset)}
                      className={`px-2.5 py-1.5 border-2 border-black font-mono text-xs font-bold transition-all shadow-[2px_2px_0_0_#000] active:shadow-none ${
                        budget === preset
                          ? "bg-neo-yellow text-black"
                          : "bg-gray-100 text-black hover:bg-yellow-100"
                      }`}
                    >
                      ${preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Industry & Goal Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[10px] font-black uppercase text-black mb-1 block">
                  Industry / Product Vertical:
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full border-2 border-black p-2 font-mono text-xs bg-white text-black shadow-[2px_2px_0_0_#000] focus:outline-none"
                >
                  <option value="ecommerce">E-Commerce &amp; D2C Retail</option>
                  <option value="saas">B2B SaaS &amp; High-Tech</option>
                  <option value="local_service">Local Business &amp; Services</option>
                  <option value="healthcare">Healthcare &amp; Clinic</option>
                  <option value="real_estate">Real Estate &amp; High-Ticket</option>
                  <option value="general">General Digital Marketing</option>
                </select>
              </div>

              <div>
                <label className="font-mono text-[10px] font-black uppercase text-black mb-1 block">
                  Optimization Goal:
                </label>
                <select
                  value={marketingGoal}
                  onChange={(e) => setMarketingGoal(e.target.value)}
                  className="w-full border-2 border-black p-2 font-mono text-xs bg-white text-black shadow-[2px_2px_0_0_#000] focus:outline-none"
                >
                  <option value="reach">Maximum Reach &amp; Visibility</option>
                  <option value="leads">High-Intent Lead Generation</option>
                  <option value="sales">Direct Sales &amp; ROAS</option>
                </select>
              </div>
            </div>

            {/* AI Advisor Guidance Box */}
            {budgetPlan?.aiRecommendation && (
              <div className="border-2 border-black bg-cyan-50 p-2.5 shadow-[2px_2px_0_0_#0891b2] flex items-start gap-2">
                <Info className="h-4 w-4 text-cyan-700 flex-shrink-0 mt-0.5" />
                <p className="font-mono text-[10px] text-cyan-950 leading-relaxed">
                  <span className="font-bold">Market Advisor: </span>
                  {budgetPlan.aiRecommendation}
                </p>
              </div>
            )}

            {/* High-level Reach & Cost Projections */}
            {budgetPlan && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="border border-black bg-gray-50 p-2 shadow-[2px_2px_0_0_#000]">
                  <span className="font-mono text-[8px] uppercase font-bold text-black/60 block">Total Ad Cost</span>
                  <span className="font-display font-black text-sm text-black">
                    ${budgetPlan.exactAdCosts.mediaSpend.toLocaleString()}
                  </span>
                </div>
                <div className="border border-black bg-lime-50 p-2 shadow-[2px_2px_0_0_#000]">
                  <span className="font-mono text-[8px] uppercase font-bold text-lime-900 block">Est. Impressions</span>
                  <span className="font-display font-black text-sm text-lime-800">
                    {budgetPlan.totalEstimatedImpressions.toLocaleString()}+
                  </span>
                </div>
                <div className="border border-black bg-yellow-50 p-2 shadow-[2px_2px_0_0_#000]">
                  <span className="font-mono text-[8px] uppercase font-bold text-yellow-900 block">Est. Clicks</span>
                  <span className="font-display font-black text-sm text-yellow-800">
                    {budgetPlan.totalEstimatedClicks.toLocaleString()}+
                  </span>
                </div>
                <div className="border border-black bg-purple-50 p-2 shadow-[2px_2px_0_0_#000]">
                  <span className="font-mono text-[8px] uppercase font-bold text-purple-900 block">Projected ROAS</span>
                  <span className="font-display font-black text-sm text-purple-800">
                    {budgetPlan.projectedOverallRoas}x (${budgetPlan.exactAdCosts.projectedRevenue.toLocaleString()})
                  </span>
                </div>
              </div>
            )}

            {/* Platform Segregation & Ad Sizes Details */}
            {budgetPlan?.platforms && budgetPlan.platforms.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[10px] font-black uppercase text-black flex items-center justify-between">
                  <span>Platform Segregation &amp; Ad Creative Sizes:</span>
                  <span className="text-blue-600 font-bold text-[9px]">Click platform for exact ad dimensions</span>
                </span>

                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {budgetPlan.platforms.map((p: any) => {
                    const isExpanded = expandedPlatform === p.platformId;
                    return (
                      <div
                        key={p.platformId}
                        className="border-2 border-black bg-white shadow-[2px_2px_0_0_#000] overflow-hidden"
                      >
                        <div
                          onClick={() => setExpandedPlatform(isExpanded ? null : p.platformId)}
                          className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-yellow-50 cursor-pointer border-b border-black/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-black">{p.platformName}</span>
                            <span className="font-mono text-[9px] font-bold bg-black text-white px-1.5 py-0.5 rounded">
                              {p.sharePct}% share
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-display font-black text-xs text-emerald-700">
                              ${p.allocatedAmount.toLocaleString()}
                            </span>
                            <span className="font-mono text-[9px] text-black/60">
                              ~{(p.estimatedImpressions / 1000).toFixed(1)}k imp · ~{p.estimatedClicks} clicks
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-black" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-black" />
                            )}
                          </div>
                        </div>

                        {/* Creative Ad Sizes & Specs */}
                        {isExpanded && (
                          <div className="p-3 bg-white border-t-2 border-black flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[9px] font-black uppercase text-black/70 flex items-center gap-1">
                                <Maximize2 className="h-3 w-3 text-purple-600" />
                                Recommended Ad Sizes (Market Standard Specs)
                              </span>
                              <span className="font-mono text-[9px] text-black/50">
                                Avg CPM: ${p.avgCpm} · Avg CPC: ${p.avgCpc}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                              {p.recommendedSizes?.map((spec: any, sIdx: number) => (
                                <div
                                  key={sIdx}
                                  className="border border-black bg-gray-50 p-2 shadow-[1px_1px_0_0_#000]"
                                >
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="font-mono text-[10px] font-black text-black">
                                      {spec.format}
                                    </span>
                                    <span className="font-mono text-[9px] font-bold bg-neo-yellow px-1 py-0.2 border border-black rounded text-black">
                                      {spec.dimensions}
                                    </span>
                                  </div>
                                  <p className="font-mono text-[9px] text-black/60 leading-tight">
                                    {spec.description} ({spec.aspectRatio})
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                    const newModel = e.target.value;
                    setLlmModel(newModel);
                    if (newModel !== "custom") setCustomModel("");
                    // If current key belongs to a DIFFERENT provider than the newly selected model,
                    // clear the key so user is forced to enter the right one.
                    if (llmApiKey) {
                      const newModelProvider = getModelProvider(newModel);
                      const currentKeyProvider = detectKeyProvider(llmApiKey);
                      if (currentKeyProvider && newModelProvider !== "custom" && currentKeyProvider !== newModelProvider) {
                        setLlmApiKey("");
                        userEditedLlmKey.current = false; // allow auto-fill
                      }
                    }
                  }}
                  className="w-full bg-white border-[3px] border-black rounded-none px-3 py-2 font-medium font-mono text-xs shadow-[2px_2px_0_0_#000] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2"
                >
                  <optgroup label="Google Gemini">
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended / Default)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </optgroup>
                  <optgroup label="🚀 Groq (Free Tier — Ultra-fast)">
                    <option value="groq-llama-3.3-70b">Groq — Llama 3.3 70B Versatile (Free ✓)</option>
                    <option value="groq-llama-3.1-8b">Groq — Llama 3.1 8B Instant (Free ✓)</option>
                    <option value="groq-llama-4-scout">Groq — Llama 4 Scout 17B (Free ✓)</option>
                    <option value="groq-mixtral-8x7b">Groq — Mixtral 8x7B 32K (Free ✓)</option>
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
                <label className="font-mono text-[9px] font-bold uppercase text-black/60 flex items-center gap-1 flex-wrap">
                  LLM API Key
                  {llmApiKey && !hasMismatch && (
                    <span className="flex items-center gap-0.5 bg-green-100 text-green-700 border border-green-400 px-1 py-0.5 rounded text-[8px] font-bold">
                      <CheckCircle2 className="w-2.5 h-2.5" /> KEY ENTERED
                    </span>
                  )}
                  {hasMismatch && (
                    <span className="flex items-center gap-0.5 bg-red-100 text-red-700 border border-red-500 px-1 py-0.5 rounded text-[8px] font-bold animate-pulse">
                      ⚠ WRONG KEY TYPE — Need {providerLabel[modelProvider] ?? modelProvider}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-black/40" />
                  <input
                    type="password"
                    value={llmApiKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      userEditedLlmKey.current = true;
                      setLlmApiKey(val);
                      // Auto-switch model AND image model based on key prefix
                      if (val.startsWith("sk-or-")) {
                        setLlmModel("deepseek/deepseek-chat");
                        // Do not auto-switch image model — respect user's explicit image model choice
                      } else if (val.startsWith("gsk_")) {
                        setLlmModel("groq-llama-3.3-70b");
                        // Groq is text-only — keep current image model
                      } else if (val.startsWith("sk-ant-")) {
                        setLlmModel("claude-3-5-sonnet");
                      } else if (val.startsWith("sk-")) {
                        setLlmModel("gpt-4o-mini");
                        setImageModel("dall-e-2"); // OpenAI key → DALL-E 2 (cheaper)
                      } else if (val.startsWith("AIza")) {
                        setLlmModel("gemini-2.5-flash");
                      }
                    }}
                    placeholder={
                      llmModel.includes("gemini") ? "Paste Gemini API Key (AIza...)" :
                      (llmModel.includes("gpt") || llmModel.includes("o3")) ? "Paste OpenAI API Key (sk-...)" :
                      llmModel.includes("claude") ? "Paste Anthropic API Key (sk-ant-...)" :
                      llmModel.includes("groq") ? "Paste Groq API Key (gsk_...)" :
                      (llmModel.includes("deepseek") || llmModel.includes("llama")) ? "Paste OpenRouter API Key (sk-or-v1-...)" :
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
                  {/* ── FREE Models ──────────────────────────────── */}
                  <optgroup label="🆕 FREE — No Cost (OpenRouter Key Required)">
                    <option value="google/gemini-2.5-flash-image">Google Gemini 2.5 Flash Image — ~$0.0000003/img ⚡★ Default</option>
                    <option value="google/gemini-3-pro-image">Google Gemini 3 Pro Image — ~$0.000002/img 🏆</option>
                    <option value="bytedance-seed/seedream-5-0-flash">ByteDance Seedream 5.0 Flash — FREE 🆓</option>
                    <option value="bytedance-seed/seedream-5-0-lite">ByteDance Seedream 5.0 Lite — FREE 🆓</option>
                    <option value="qwen/qwen-image-2.1-turbo">Qwen Image 2.1 Turbo — FREE 🆓</option>
                    <option value="qwen/qwen-image-2.1-pro">Qwen Image 2.1 Pro — FREE 🆓</option>
                  </optgroup>
                  {/* ── Paid OpenRouter Models ────────────────────── */}
                  <optgroup label="💰 Paid — OpenRouter Key Required">
                    <option value="meta/muse-image-1.0-eval-20260824">Meta Muse Image 1.0 — ~$0.010/img · 1600×1600 (needs enabling)</option>
                    <option value="qwen/qwen-image-3">Qwen Image 3 — ~$0.003/img</option>
                    <option value="x-ai/grok-imagine-image-2.0">X-AI Grok Imagine 2.0 — ~$0.01/img</option>
                  </optgroup>
                  {/* ── OpenAI Key ────────────────────────────────── */}
                  <optgroup label="💰 Low Cost — OpenAI Key">
                    <option value="dall-e-2">DALL-E 2 (~$0.018/image)</option>
                    <option value="dall-e-3">DALL-E 3 (~$0.040/image)</option>
                  </optgroup>
                  {/* ── Together Free Tier ────────────────────────── */}
                  <optgroup label="🆓 Free Tier — Together API Key">
                    <option value="together-flux-free">Together AI — FLUX.1-schnell (Free Tier)</option>
                  </optgroup>
                  {/* ── HuggingFace ───────────────────────────────── */}
                  <optgroup label="HuggingFace — hf_ Token">
                    <option value="black-forest-labs/FLUX.1-schnell">FLUX.1-schnell via HuggingFace</option>
                    <option value="black-forest-labs/FLUX.1-dev">FLUX.1-dev via HuggingFace</option>
                  </optgroup>
                  <optgroup label="Custom">
                    <option value="custom">✨ Enter Custom Model ID...</option>
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
                <label className="font-mono text-[9px] font-bold uppercase text-black/60 flex items-center gap-2">
                  Image API Key
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameKeyForImage}
                      onChange={(e) => {
                        setSameKeyForImage(e.target.checked);
                        if (e.target.checked) {
                          userEditedImageKey.current = false;
                          setImageApiKey(llmApiKey);
                        }
                      }}
                      className="w-3 h-3 accent-black"
                    />
                    <span className="text-[8px] font-bold text-black/50">SAME AS LLM KEY</span>
                  </label>
                </label>
                <input
                  type="password"
                  value={sameKeyForImage ? llmApiKey : imageApiKey}
                  disabled={sameKeyForImage}
                  onChange={(e) => {
                    if (!sameKeyForImage) {
                      userEditedImageKey.current = true;
                      setImageApiKey(e.target.value);
                    }
                  }}
                  placeholder={
                    sameKeyForImage ? "(Using same key as LLM above)" :
                    (imageModel.includes("meta/") || imageModel.includes("muse") || imageModel.includes("google/") || imageModel.includes("qwen/") || imageModel.includes("bytedance") || imageModel.includes("x-ai/")) ? "Paste OpenRouter API Key (sk-or-v1-...)" :
                    imageModel.includes("together") ? "Paste Together AI Key (from api.together.xyz)" :
                    imageModel.includes("dall-e") ? "Paste OpenAI API Key (sk-...)" :
                    (imageModel.includes("FLUX") || imageModel.includes("black-forest")) ? "Paste HuggingFace Token (hf_...)" :
                    "Paste OpenRouter API Key (sk-or-v1-...)"
                  }
                  className={`w-full border-[3px] border-black rounded-none px-3 py-2 font-medium font-mono text-xs text-black shadow-[2px_2px_0_0_#000] placeholder:text-gray-400 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#00E0FF] focus-visible:outline-offset-2 ${sameKeyForImage ? "bg-gray-100 cursor-not-allowed opacity-70" : "bg-white"}`}
                />
                {sameKeyForImage && llmApiKey && (
                  <p className="font-mono text-[8px] text-green-700 font-bold">✓ Image key synced from LLM key above</p>
                )}
                {!sameKeyForImage && (imageModel.includes("google/") && imageModel.includes("gemini-2.5-flash-image")) && (
                  <p className="font-mono text-[8px] text-green-700 font-bold">⚡ Gemini 2.5 Flash Image · ~$0.0000003/img · No enabling needed · via OpenRouter</p>
                )}
                {!sameKeyForImage && (imageModel.includes("bytedance") || imageModel.includes("qwen/qwen-image-2")) && (
                  <p className="font-mono text-[8px] text-green-700 font-bold">🆓 This model is completely FREE via OpenRouter (no per-image cost)</p>
                )}
                {!sameKeyForImage && (imageModel.includes("meta/") || imageModel.includes("muse")) && (
                  <p className="font-mono text-[8px] text-orange-600 font-bold">⚠ Meta Muse requires enabling on openrouter.ai first</p>
                )}
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
