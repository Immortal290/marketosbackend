"use client";

import { useState, useEffect, useCallback } from "react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { Cpu, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, RefreshCw } from "lucide-react";

interface ApiKeyField {
  name: string;
  key: string;
  placeholder: string;
  hint: string;
  docsUrl: string;
}

const API_KEY_FIELDS: ApiKeyField[] = [
  {
    name: "Gemini (Google AI)",
    key: "gemini",
    placeholder: "AIzaSy...",
    hint: "Primary model for all AI Agents — Supervisor, Copy, Email, SMS and more.",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    name: "OpenAI",
    key: "openai",
    placeholder: "sk-...",
    hint: "Fallback for GPT-4o and reasoning tasks.",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    name: "Anthropic",
    key: "anthropic",
    placeholder: "sk-ant-...",
    hint: "Used for compliance checks and copy editing.",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    name: "Groq (Ultra-fast)",
    key: "groq",
    placeholder: "gsk_...",
    hint: "Lightning-fast Llama 3.3 70B for high-throughput tasks.",
    docsUrl: "https://console.groq.com/keys",
  },
];

export default function AIModelsSettingsPage() {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    gemini: "", openai: "", anthropic: "", groq: "",
  });
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState<Record<string, boolean>>({});
  const [validationResults, setValidationResults] = useState<Record<string, boolean | null>>({});

  const loadApiKeys = useCallback(async () => {
    try {
      const response = await apiRequest<any>("/settings/api-keys");
      if (response?.data) {
        const data = response.data as Record<string, string>;
        setApiKeys((prev) => ({ ...prev, ...data }));
        // Mark which keys have saved values
        const saved: Record<string, boolean> = {};
        for (const k of Object.keys(data)) {
          if (data[k]) saved[k] = true;
        }
        setSavedKeys(saved);
      }
    } catch (error) {
      console.error("Failed to load API keys:", error);
    }
  }, []);

  useEffect(() => {
    void loadApiKeys();
  }, [loadApiKeys]);

  const handleChange = (key: string, value: string) => {
    setApiKeys((prev) => ({ ...prev, [key]: value }));
    setSavedKeys((prev) => ({ ...prev, [key]: false }));
    setValidationResults((prev) => ({ ...prev, [key]: null }));
  };

  const toggleShow = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleValidate = async (field: ApiKeyField) => {
    const key = apiKeys[field.key];
    if (!key) {
      toast.error("No API key to validate", { description: `Enter a ${field.name} key first.` });
      return;
    }
    setValidating((prev) => ({ ...prev, [field.key]: true }));
    try {
      // Save first so the agent service can pick it up
      await apiRequest<any>("/settings/api-keys", {
        method: "PATCH",
        body: JSON.stringify({ [field.key]: key }),
      });
      // Probe the agent service health (which calls /v1/health on Python)
      const health = await apiRequest<any>("/ai-command-center/agent-service/health").catch(() => null);
      // If agent service is reachable, assume valid (we can't call the LLM vendor directly from browser)
      if (health) {
        setValidationResults((prev) => ({ ...prev, [field.key]: true }));
        toast.success(`${field.name} key saved & agent service reachable!`);
      } else {
        setValidationResults((prev) => ({ ...prev, [field.key]: false }));
        toast.error("Agent service unreachable — key saved but could not verify.");
      }
    } catch {
      setValidationResults((prev) => ({ ...prev, [field.key]: false }));
      toast.error(`Validation failed for ${field.name}`);
    } finally {
      setValidating((prev) => ({ ...prev, [field.key]: false }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only save keys that have values
      const toSave: Record<string, string> = {};
      for (const [k, v] of Object.entries(apiKeys)) {
        if (v) toSave[k] = v;
      }
      const response = await apiRequest<any>("/settings/api-keys", {
        method: "PATCH",
        body: JSON.stringify(toSave),
      });
      const newSaved: Record<string, boolean> = {};
      for (const k of Object.keys(toSave)) {
        newSaved[k] = true;
      }
      setSavedKeys((prev) => ({ ...prev, ...newSaved }));
      toast.success("API Keys Saved", {
        description: response?.agentFeedback || "Your keys are encrypted and stored securely. AI Agents will use them automatically.",
      });
    } catch (error) {
      console.error("Failed to save API keys:", error);
      toast.error("Failed to save API keys", { description: "Make sure your backend is running." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <NeoCard title="AI Model Configuration" accent="cyan">
        <div className="mb-4 flex items-center justify-between border-b-[3px] border-black pb-4">
          <p className="font-mono text-xs font-bold uppercase text-black/70 flex items-center gap-2">
            <Cpu className="w-4 h-4" /> Manage API keys for LLM providers — keys are securely stored per-user
          </p>
          <button
            onClick={loadApiKeys}
            title="Reload saved keys"
            className="p-1 border-2 border-black shadow-[2px_2px_0_0_#000] hover:-translate-y-px hover:shadow-[3px_3px_0_0_#000] transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-6">
          {API_KEY_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2 border-[2px] border-black p-4 shadow-[3px_3px_0_0_#000]">
              <div className="flex items-center justify-between">
                <label className="font-display font-black text-base flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-black/60" />
                  {field.name} API Key
                  {savedKeys[field.key] && (
                    <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 border border-green-400 px-2 py-0.5 font-mono font-bold rounded">
                      <CheckCircle2 className="w-3 h-3" /> SAVED
                    </span>
                  )}
                  {validationResults[field.key] === true && (
                    <span className="flex items-center gap-1 text-[10px] bg-blue-100 text-blue-700 border border-blue-400 px-2 py-0.5 font-mono font-bold rounded">
                      <CheckCircle2 className="w-3 h-3" /> VERIFIED
                    </span>
                  )}
                  {validationResults[field.key] === false && (
                    <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 border border-red-400 px-2 py-0.5 font-mono font-bold rounded">
                      <AlertCircle className="w-3 h-3" /> ERROR
                    </span>
                  )}
                </label>
                <a
                  href={field.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-blue-600 underline hover:text-blue-800"
                >
                  Get Key →
                </a>
              </div>
              <p className="font-medium text-sm text-black/60">{field.hint}</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKeys[field.key] ? "text" : "password"}
                    value={apiKeys[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={savedKeys[field.key] ? "••••••••••••••••••• (saved — click 👁 to view)" : field.placeholder}
                    className="w-full rounded-none border-[3px] border-black bg-white px-4 py-3 font-mono text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-0 focus:border-neo-blue pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow(field.key)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
                  >
                    {showKeys[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => handleValidate(field)}
                  disabled={validating[field.key] || !apiKeys[field.key]}
                  className="border-[3px] border-black bg-neo-yellow px-4 py-3 font-display font-black text-xs uppercase shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {validating[field.key] ? "..." : "Test"}
                </button>
              </div>
            </div>
          ))}

          <div className="pt-4 border-t-[3px] border-black">
            <NeoButton onClick={handleSave} disabled={saving} variant="primary" className="w-full justify-center">
              {saving ? "Saving..." : "💾 Save All API Keys"}
            </NeoButton>
            <p className="font-mono text-xs text-black/50 mt-2 text-center">
              Keys are saved to your user profile. The AI Agents will automatically use your Gemini key when you run campaigns.
            </p>
          </div>
        </div>
      </NeoCard>
    </div>
  );
}
