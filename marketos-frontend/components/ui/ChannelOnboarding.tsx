"use client";

import * as React from "react";
import { useState } from "react";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoInput } from "@/components/ui/NeoInput";
import { CheckCircle2, ChevronRight, KeyRound, Globe } from "lucide-react";
import { cn } from "@/lib/cn";

import { toast } from "sonner";

export interface ChannelConfig {
  id: string;
  name: string;
  description: string;
  accent: "yellow" | "pink" | "cyan" | "lime";
  fields: {
    id: string;
    label: string;
    placeholder: string;
    type?: string;
  }[];
}

interface ChannelOnboardingProps {
  channel: ChannelConfig;
}

export function ChannelOnboarding({ channel }: ChannelOnboardingProps) {
  const [step, setStep] = useState(1);
  const [isConnecting, setIsConnecting] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate API connection delay
    setTimeout(() => {
      setIsConnecting(false);
      setStep(3);
      toast.success(`${channel.name} Connected`, {
        description: "Data synchronization has started.",
      });
    }, 1500);
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Connect {channel.name}
          </h1>
          <p className="font-medium text-black/70">
            Step {step} of 3: {step === 1 ? "Overview" : step === 2 ? "Credentials" : "Success"}
          </p>
        </div>
      </div>

      {/* Onboarding Steps */}
      <div className="relative">
        {/* Step 1: Overview */}
        {step === 1 && (
          <NeoCard title="Integration Overview" accent={channel.accent} className="animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <Globe className="mt-1 h-8 w-8 flex-shrink-0" />
                <div>
                  <h3 className="font-display text-xl font-black uppercase">About {channel.name} Integration</h3>
                  <p className="mt-2 font-medium text-black/70">{channel.description}</p>
                </div>
              </div>
              
              <div className="border-t-[3px] border-black pt-6">
                <h4 className="mb-4 font-mono text-sm font-bold uppercase">What this integration enables:</h4>
                <ul className="flex flex-col gap-3">
                  <li className="flex items-center gap-3 font-medium">
                    <CheckCircle2 className="h-5 w-5 text-neo-green" /> Sync campaign performance data
                  </li>
                  <li className="flex items-center gap-3 font-medium">
                    <CheckCircle2 className="h-5 w-5 text-neo-green" /> Automate ad creation and publishing
                  </li>
                  <li className="flex items-center gap-3 font-medium">
                    <CheckCircle2 className="h-5 w-5 text-neo-green" /> Monitor spend and optimize budgets with AI
                  </li>
                </ul>
              </div>

              <div className="flex justify-end pt-4">
                <NeoButton variant="primary" onClick={() => setStep(2)}>
                  Continue to Setup <ChevronRight className="ml-2 h-4 w-4" />
                </NeoButton>
              </div>
            </div>
          </NeoCard>
        )}

        {/* Step 2: Credentials */}
        {step === 2 && (
          <NeoCard title="Connection Settings" accent={channel.accent} className="animate-in fade-in slide-in-from-right-8">
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <KeyRound className="mt-1 h-8 w-8 flex-shrink-0" />
                <div>
                  <h3 className="font-display text-xl font-black uppercase">Enter your credentials</h3>
                  <p className="mt-1 font-medium text-black/70">
                    Provide the API keys or OAuth tokens needed to authenticate with {channel.name}.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col gap-4 border-t-[3px] border-black pt-6">
                {channel.fields.map((field) => (
                  <NeoInput 
                    key={field.id}
                    label={field.label}
                    type={field.type || "text"}
                    placeholder={field.placeholder}
                    value={credentials[field.id] || ""}
                    onChange={(e) => setCredentials({ ...credentials, [field.id]: e.target.value })}
                  />
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <NeoButton variant="secondary" onClick={() => setStep(1)} disabled={isConnecting}>
                  Back
                </NeoButton>
                <NeoButton 
                  variant="primary" 
                  onClick={handleConnect}
                  disabled={isConnecting || channel.fields.some(f => !credentials[f.id])}
                >
                  {isConnecting ? "Connecting..." : "Verify & Connect"}
                </NeoButton>
              </div>
            </div>
          </NeoCard>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <NeoCard title="Connection Successful" accent="lime" className="animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center gap-6 py-8 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-[4px] border-black bg-neo-green shadow-neo">
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>
              <div>
                <h3 className="font-display text-3xl font-black uppercase tracking-tight">You&apos;re all set!</h3>
                <p className="mt-2 max-w-md font-medium text-black/70">
                  {channel.name} has been successfully connected to MarketOS. Data synchronization will begin shortly.
                </p>
              </div>
              
              <div className="mt-4 flex gap-4">
                <NeoButton variant="secondary" onClick={() => setStep(1)}>
                  Review Settings
                </NeoButton>
                <NeoButton variant="primary" onClick={() => window.location.href = "/dashboard"}>
                  Return to Dashboard
                </NeoButton>
              </div>
            </div>
          </NeoCard>
        )}
      </div>
    </div>
  );
}
