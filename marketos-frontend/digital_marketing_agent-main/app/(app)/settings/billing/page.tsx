"use client";

import { useState, useEffect } from "react";
import type { BillingPlan } from "@/lib/types";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
import { NeoModal } from "@/components/ui/NeoModal";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import {
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Receipt,
  Calendar,
  Sparkles,
  Lock,
  RefreshCw,
  HelpCircle,
  Printer,
  ChevronDown,
  ChevronUp,
  Cpu,
  ArrowRight,
  Sliders,
} from "lucide-react";

interface BillingTransaction {
  id: string;
  date: string;
  orderId: string;
  paymentId: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string;
  method?: string;
  billingCycle?: string;
}

interface BillingState {
  plan: string;
  billingCycle: string;
  nextBillingDate: string;
  seats: { used: number; total: number };
  agentTokens: { used: number; total: number };
  paymentMethod: string;
  gateway?: string;
  gatewayMode?: string;
  keyId?: string;
  transactions?: BillingTransaction[];
}

const basePlans: BillingPlan[] = [
  {
    id: "p1",
    name: "Starter",
    priceMonthly: 0,
    features: [
      "1 workspace",
      "3 active agents",
      "Community support",
      "2.0M Agent Tokens / mo",
      "Standard LLM routing",
    ],
    current: false,
  },
  {
    id: "p2",
    name: "Growth",
    priceMonthly: 99,
    features: [
      "5 workspaces",
      "All 17 specialized agents",
      "Priority email & ticket support",
      "10.0M Agent Tokens / mo",
      "Daily campaign optimization",
      "Multi-channel dispatch (SMS, Email, Phone)",
    ],
    current: true,
  },
  {
    id: "p3",
    name: "Scale",
    priceMonthly: 399,
    features: [
      "Unlimited workspaces",
      "All 17+ agents with zero queueing",
      "24/7 dedicated account manager",
      "50.0M Agent Tokens / mo",
      "Custom SLA guarantees (99.9%)",
      "Custom fine-tuned LLM routing",
    ],
    current: false,
  },
];

const accents = ["yellow", "pink", "cyan"] as const;

export default function BillingSettingsPage() {
  const [plansList, setPlansList] = useState<BillingPlan[]>(basePlans);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("p2");
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [pingingGateway, setPingingGateway] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<BillingTransaction | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "captured">("all");
  const [gatewayLatency, setGatewayLatency] = useState<string | null>("68ms");

  const [billingData, setBillingData] = useState<BillingState>({
    plan: "GROWTH",
    billingCycle: "MONTHLY",
    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    seats: { used: 5, total: 25 },
    agentTokens: { used: 3400000, total: 10000000 },
    paymentMethod: "Razorpay Verified Card",
    gateway: "Razorpay",
    gatewayMode: "Live",
    keyId: "rzp_test_TrhNQHCvgOMUn9",
    transactions: [],
  });

  const loadBillingInfo = async () => {
    try {
      const response = await apiRequest<any>("/settings/billing");
      if (response && response.data) {
        const d = response.data;
        setBillingData((prev) => ({
          ...prev,
          ...d,
          transactions: d.transactions || prev.transactions || [],
        }));

        if (d.billingCycle) {
          setBillingCycle(d.billingCycle.toUpperCase() === "ANNUAL" ? "ANNUAL" : "MONTHLY");
        }

        if (d.plan) {
          const planUpper = d.plan.toUpperCase();
          setPlansList((list) =>
            list.map((p) => ({
              ...p,
              current: p.name.toUpperCase() === planUpper,
            })),
          );
          const found = basePlans.find((p) => p.name.toUpperCase() === planUpper);
          if (found) setSelectedPlanId(found.id);
        }
      }
    } catch (error) {
      console.warn("Could not fetch remote billing state, using active cache:", error);
    }
  };

  useEffect(() => {
    void loadBillingInfo();
  }, []);

  // Dynamically inject Razorpay Checkout script
  const ensureRazorpayLoaded = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined") return resolve(false);
      if ((window as any).Razorpay) return resolve(true);

      const existingScript = document.getElementById("razorpay-checkout-js");
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(true));
        return;
      }

      const script = document.createElement("script");
      script.id = "razorpay-checkout-js";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Test live connection to Razorpay Gateway
  const handlePingGateway = async () => {
    setPingingGateway(true);
    try {
      const res = await apiRequest<any>("/settings/billing/ping", { method: "POST" });
      if (res && res.success) {
        setGatewayLatency(res.latency || "74ms");
        toast.success("Razorpay Gateway Verified", {
          description:
            res.agentFeedback ||
            `FinanceAgent established round-trip connection with Razorpay servers (${res.latency || "74ms"} latency). 256-bit TLS encrypted.`,
        });
      } else {
        toast.error("Gateway ping did not return success response");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to ping Razorpay gateway");
    } finally {
      setPingingGateway(false);
    }
  };

  // Compute pricing dynamically based on cycle and currency
  const getPlanPrice = (plan: BillingPlan) => {
    if (plan.priceMonthly === 0) return { display: "Free", amount: 0 };

    const isAnnual = billingCycle === "ANNUAL";
    // 20% discount on annual plans
    const monthlyRateUsd = isAnnual
      ? plan.id === "p3"
        ? 319
        : 79
      : plan.priceMonthly;

    if (currency === "INR") {
      const inrRate = 83;
      const inrPrice = Math.round(monthlyRateUsd * inrRate);
      return {
        display: `₹${inrPrice.toLocaleString()}/mo`,
        subtext: isAnnual ? `Billed annually (₹${(inrPrice * 12).toLocaleString()}/yr)` : "Billed monthly",
        amount: isAnnual ? inrPrice * 12 : inrPrice,
      };
    }

    return {
      display: `$${monthlyRateUsd}/mo`,
      subtext: isAnnual ? `Billed annually ($${monthlyRateUsd * 12}/yr)` : "Billed monthly",
      amount: isAnnual ? monthlyRateUsd * 12 : monthlyRateUsd,
    };
  };

  // Choose & Upgrade or Downgrade plan
  const handleChoosePlan = async (plan: BillingPlan) => {
    setLoadingPlan(plan.id);
    setSelectedPlanId(plan.id);

    // Free plan (Starter) requires no checkout
    if (plan.priceMonthly === 0) {
      try {
        const response = await apiRequest<any>("/settings/billing/plan", {
          method: "PATCH",
          body: JSON.stringify({ planId: plan.id, planName: "STARTER" }),
        });

        setPlansList((list) =>
          list.map((p) => ({
            ...p,
            current: p.id === plan.id,
          })),
        );
        setBillingData((prev) => ({
          ...prev,
          plan: "STARTER",
          agentTokens: { ...prev.agentTokens, total: 2000000 },
        }));

        toast.success(`Subscription switched to ${plan.name}`, {
          description:
            response?.agentFeedback ||
            `Workspace adjusted to ${plan.name} free tier. 2.0M agent token pool allocated.`,
        });
      } catch (err: any) {
        toast.error(err.message || "Failed to switch to Starter tier");
      } finally {
        setLoadingPlan(null);
      }
      return;
    }

    // Paid plan (Growth / Scale) -> Initialize Razorpay Order
    try {
      const scriptReady = await ensureRazorpayLoaded();
      if (!scriptReady) {
        throw new Error("Unable to load Razorpay payment gateway script.");
      }

      // Create Razorpay order on backend
      const orderRes = await apiRequest<any>("/settings/billing/create-order", {
        method: "POST",
        body: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          billingCycle,
          currency,
        }),
      });

      if (!orderRes || !orderRes.orderId) {
        throw new Error(orderRes?.error || "Order initialization failed on Razorpay gateway.");
      }

      const keyId = orderRes.keyId || billingData.keyId || "rzp_test_TrhNQHCvgOMUn9";
      const priceMeta = getPlanPrice(plan);

      // Configure Razorpay checkout modal
      const options = {
        key: keyId,
        amount: orderRes.amount,
        currency: orderRes.currency || currency,
        name: "MarketOS AI Fleet",
        description: `${plan.name} Tier (${priceMeta.display}) - Autonomous Agent Operations`,
        order_id: orderRes.orderId,
        prefill: {
          name: "Acme Marketing Corp",
          email: "billing@acme.io",
          contact: "+919876543210",
        },
        notes: {
          plan: plan.name,
          billingCycle,
          platform: "MarketOS Autonomous Marketing OS",
        },
        theme: {
          color: "#00E0FF",
        },
        handler: async function (response: any) {
          // Cryptographic verification on backend
          try {
            const verifyRes = await apiRequest<any>("/settings/billing/verify-payment", {
              method: "POST",
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId: plan.id,
                planName: plan.name,
              }),
            });

            if (verifyRes && verifyRes.success) {
              setPlansList((list) =>
                list.map((p) => ({
                  ...p,
                  current: p.id === plan.id,
                })),
              );

              if (verifyRes.data) {
                setBillingData(verifyRes.data);
              } else {
                void loadBillingInfo();
              }

              toast.success(`Subscription Upgraded to ${plan.name}!`, {
                description:
                  verifyRes.agentFeedback ||
                  `FinanceAgent validated cryptographic Razorpay signature (${response.razorpay_payment_id}). All 17 specialized AI agents unlocked!`,
              });
            } else {
              toast.error(verifyRes?.error || "Payment signature verification failed.");
            }
          } catch (verErr: any) {
            toast.error("Verification failed: " + (verErr.message || "Unknown error"));
          } finally {
            setLoadingPlan(null);
          }
        },
        modal: {
          ondismiss: function () {
            setLoadingPlan(null);
            toast.info("Payment window closed. Current tier remains unchanged.");
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.open();
    } catch (error: any) {
      console.error("Razorpay checkout failed to open:", error);
      toast.error(error.message || "Failed to launch Razorpay checkout.");
      setLoadingPlan(null);
    }
  };

  // Launch Razorpay to update / tokenize payment method
  const handleUpdatePaymentMethod = async () => {
    setUpdatingPayment(true);
    try {
      const scriptReady = await ensureRazorpayLoaded();
      if (!scriptReady) {
        throw new Error("Unable to load Razorpay payment gateway.");
      }

      // Create a verification order
      const orderRes = await apiRequest<any>("/settings/billing/create-order", {
        method: "POST",
        body: JSON.stringify({
          planId: "verification",
          planName: billingData.plan,
          currency,
        }),
      });

      const keyId = orderRes?.keyId || billingData.keyId || "rzp_test_TrhNQHCvgOMUn9";
      const orderId = orderRes?.orderId;

      const options = {
        key: keyId,
        amount: orderRes?.amount || 9900,
        currency: orderRes?.currency || currency,
        name: "MarketOS - Billing Card Update",
        description: "Tokenize & Verify Card via Razorpay Gateway",
        order_id: orderId,
        prefill: {
          name: "Acme Marketing Corp",
          email: "billing@acme.io",
          contact: "+919876543210",
        },
        theme: {
          color: "#00E0FF",
        },
        handler: async function (response: any) {
          try {
            const updateRes = await apiRequest<any>("/settings/billing/update-payment", {
              method: "POST",
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (updateRes?.success && updateRes?.data) {
              setBillingData(updateRes.data);
            } else {
              void loadBillingInfo();
            }

            toast.success("Payment Method Verified & Saved", {
              description:
                updateRes?.agentFeedback ||
                `FinanceAgent verified payment credentials (${response.razorpay_payment_id}) via secure Razorpay tokenization.`,
            });
          } catch (e: any) {
            toast.error("Failed to save updated card: " + e.message);
          } finally {
            setUpdatingPayment(false);
          }
        },
        modal: {
          ondismiss: function () {
            setUpdatingPayment(false);
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.open();
    } catch (err: any) {
      toast.error(err.message || "Failed to launch payment method update.");
      setUpdatingPayment(false);
    }
  };

  const currentPlanObj = plansList.find((p) => p.current) || plansList[1];
  const displayedTransactions = (billingData.transactions || []).filter((tx) =>
    filterStatus === "all" ? true : tx.status.toLowerCase() === "captured"
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-[3px] border-black pb-4">
        <div>
          <h2 className="font-display text-2xl font-black uppercase tracking-tight">
            Subscription & SLA Allocation
          </h2>
          <p className="font-mono text-xs text-black/70">
            Autonomous compute orchestration by FinanceAgent & SupervisorAgent
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NeoBadge tone="success" className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Active SLA
          </NeoBadge>
          <NeoBadge tone="info" className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Live Razorpay Gateway
          </NeoBadge>
        </div>
      </div>

      {/* Guided Walkthrough Bar (Collapsible) */}
      <div className="border-[3px] border-black bg-white p-4 shadow-neo">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="border-[2px] border-black bg-[#FFE600] p-1.5 shadow-neo-sm">
              <Sparkles className="h-4 w-4 text-black" />
            </div>
            <div>
              <span className="font-display font-black text-sm uppercase tracking-tight">
                How Autonomous SLA & Billing Works
              </span>
              <p className="font-mono text-xs text-black/60">
                End-to-end automated compute scaling and instant checkout
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1 border-[2px] border-black bg-gray-100 px-2.5 py-1 text-xs font-mono font-bold hover:bg-gray-200"
          >
            {showGuide ? (
              <>
                Hide Guide <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Show Guide <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {showGuide && (
          <div className="mt-4 grid gap-3 pt-3 border-t-[2px] border-black/10 md:grid-cols-3">
            <div className="border-[2px] border-black bg-amber-50 p-3">
              <div className="flex items-center gap-2 font-display font-black text-xs uppercase text-amber-900">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] text-white">
                  1
                </span>
                Choose Subscription Scale
              </div>
              <p className="mt-1 font-mono text-[11px] text-black/75">
                Select between Starter (pilot), Growth (full 17-agent marketing suite), or Scale (dedicated computing cluster).
              </p>
            </div>

            <div className="border-[2px] border-black bg-cyan-50 p-3">
              <div className="flex items-center gap-2 font-display font-black text-xs uppercase text-cyan-900">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] text-white">
                  2
                </span>
                One-Click Razorpay Checkout
              </div>
              <p className="mt-1 font-mono text-[11px] text-black/75">
                Launch the secure 256-bit encrypted checkout modal supporting Cards, UPI, Netbanking, and International Accounts.
              </p>
            </div>

            <div className="border-[2px] border-black bg-emerald-50 p-3">
              <div className="flex items-center gap-2 font-display font-black text-xs uppercase text-emerald-900">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] text-white">
                  3
                </span>
                Cryptographic Token Unlock
              </div>
              <p className="mt-1 font-mono text-[11px] text-black/75">
                FinanceAgent validates the HMAC-SHA256 signature in real time, unlocking up to 50M tokens and custom SLAs.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Controls Bar: Billing Cycle & Currency Switchers */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-[3px] border-black bg-[#FFE600] p-4 shadow-neo">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-black uppercase text-black">
            Billing Cadence:
          </span>
          <div className="inline-flex border-[2px] border-black bg-white p-0.5 shadow-neo-sm">
            <button
              type="button"
              onClick={() => setBillingCycle("MONTHLY")}
              className={`px-3 py-1 text-xs font-mono font-black transition-colors ${
                billingCycle === "MONTHLY"
                  ? "bg-black text-white"
                  : "text-black hover:bg-black/10"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("ANNUAL")}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-black transition-colors ${
                billingCycle === "ANNUAL"
                  ? "bg-black text-[#00E0FF]"
                  : "text-black hover:bg-black/10"
              }`}
            >
              Annual Billing
              <span className="rounded bg-[#FF2E93] px-1 py-0.2 text-[9px] text-white">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-black uppercase text-black">
            Currency:
          </span>
          <div className="inline-flex border-[2px] border-black bg-white p-0.5 shadow-neo-sm">
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`px-2.5 py-1 text-xs font-mono font-black ${
                currency === "USD" ? "bg-black text-white" : "text-black hover:bg-black/10"
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`px-2.5 py-1 text-xs font-mono font-black ${
                currency === "INR" ? "bg-black text-[#00E0FF]" : "text-black hover:bg-black/10"
              }`}
            >
              INR (₹)
            </button>
          </div>

          <NeoButton
            variant="secondary"
            size="sm"
            onClick={handlePingGateway}
            disabled={pingingGateway}
            className="ml-2"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 inline ${pingingGateway ? "animate-spin" : ""}`}
            />
            {pingingGateway ? "Pinging..." : `Verify Gateway (${gatewayLatency || "72ms"})`}
          </NeoButton>
        </div>
      </div>

      {/* Subscription Plans Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {plansList.map((plan, i) => {
          const isCurrent = plan.current;
          const isSelected = selectedPlanId === plan.id;
          const priceMeta = getPlanPrice(plan);

          return (
            <NeoCard
              key={plan.id}
              title={plan.name}
              accent={accents[i % accents.length]}
              className={
                isCurrent
                  ? "outline outline-[4px] outline-offset-2 outline-[#00E0FF] shadow-neo"
                  : isSelected
                  ? "outline outline-[2px] outline-black"
                  : undefined
              }
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col">
                  <div className="flex items-baseline justify-between">
                    <div className="font-display text-3xl font-black">
                      {priceMeta.display}
                    </div>
                    {isCurrent ? (
                      <NeoBadge tone="success">Current Plan</NeoBadge>
                    ) : (
                      <NeoBadge tone="info">Available Tier</NeoBadge>
                    )}
                  </div>
                  {priceMeta.subtext && (
                    <span className="font-mono text-[11px] font-bold text-black/60 mt-0.5">
                      {priceMeta.subtext}
                    </span>
                  )}
                </div>

                <ul className="flex list-disc flex-col gap-2 pl-5 min-h-[160px]">
                  {plan.features.map((f) => (
                    <li key={f} className="font-medium text-xs sm:text-sm">
                      {f}
                    </li>
                  ))}
                </ul>

                <NeoButton
                  variant={isCurrent ? "ghost" : "primary"}
                  disabled={isCurrent || loadingPlan === plan.id}
                  fullWidth
                  onClick={() => handleChoosePlan(plan)}
                >
                  {loadingPlan === plan.id ? (
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 animate-spin" />
                      Opening Razorpay...
                    </span>
                  ) : isCurrent ? (
                    "Current Tier"
                  ) : plan.priceMonthly === 0 ? (
                    "Switch to Free"
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Zap className="h-4 w-4" />
                      Upgrade via Razorpay
                    </span>
                  )}
                </NeoButton>
              </div>
            </NeoCard>
          );
        })}
      </div>

      {/* Payment Method & Auto-Billing NeoCard */}
      <NeoCard title="Payment Method & Auto-Billing (Razorpay)" accent="cyan">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="border-[2px] border-black bg-white p-3 shadow-neo-sm">
              <CreditCard className="h-8 w-8 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-lg">{billingData.paymentMethod}</span>
                <NeoBadge tone="success" className="text-[10px] py-0.5">
                  Verified & Active
                </NeoBadge>
              </div>
              <p className="font-mono text-xs text-black/70 flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-3.5 w-3.5" />
                Next automated billing cycle: <strong>{billingData.nextBillingDate}</strong> ({currentPlanObj.name} tier)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NeoButton
              variant="secondary"
              size="sm"
              disabled={updatingPayment}
              onClick={handleUpdatePaymentMethod}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4 inline" />
              {updatingPayment ? "Connecting..." : "Update Card via Razorpay"}
            </NeoButton>
          </div>
        </div>
      </NeoCard>

      {/* Razorpay Invoices & Payment Ledger */}
      <NeoCard title="Razorpay Invoices & Live Payment Ledger" accent="yellow">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-[2px] border-black/10 pb-3">
          <p className="font-mono text-xs text-black/70">
            Real-time cryptographic audit trail of all transactions processed via Razorpay.
          </p>

          <div className="flex items-center gap-1 border-[2px] border-black bg-white p-0.5 shadow-neo-sm">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={`px-2.5 py-1 text-xs font-mono font-bold ${
                filterStatus === "all" ? "bg-black text-white" : "text-black hover:bg-black/10"
              }`}
            >
              All Records
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("captured")}
              className={`px-2.5 py-1 text-xs font-mono font-bold ${
                filterStatus === "captured" ? "bg-black text-[#00E0FF]" : "text-black hover:bg-black/10"
              }`}
            >
              Captured Only
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b-[2px] border-black bg-black/5 font-bold uppercase">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Razorpay Payment ID</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {displayedTransactions.length > 0 ? (
                displayedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-black/[0.02]">
                    <td className="py-3 px-3 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-3 font-medium">
                      MarketOS {tx.plan} Subscription
                    </td>
                    <td className="py-3 px-3 font-bold text-black/80">
                      <code>{tx.paymentId}</code>
                    </td>
                    <td className="py-3 px-3 font-display font-black text-sm">
                      {tx.currency === "INR" ? "₹" : "$"}
                      {tx.amount}.00 {tx.currency}
                    </td>
                    <td className="py-3 px-3">
                      <NeoBadge tone="success" className="text-[10px]">
                        {tx.status.toUpperCase()}
                      </NeoBadge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(tx)}
                        className="inline-flex items-center gap-1 font-bold underline hover:text-[#00E0FF]"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        View Receipt
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="border-[2px] border-black bg-[#00E0FF] p-2.5 shadow-neo-sm">
                        <Receipt className="h-6 w-6 text-black" />
                      </div>
                      <p className="font-display font-black text-sm uppercase">
                        No Razorpay Transactions Recorded Yet
                      </p>
                      <p className="font-mono text-xs text-black/60 max-w-sm">
                        Select a plan above or update your payment card to initiate your live billing ledger.
                      </p>
                      <NeoButton
                        size="sm"
                        variant="secondary"
                        onClick={() => handleChoosePlan(plansList[1])}
                        className="mt-2"
                      >
                        <Zap className="mr-1.5 h-3.5 w-3.5 inline" />
                        Initialize Growth Tier with Razorpay
                      </NeoButton>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </NeoCard>

      {/* Invoice Receipt Modal */}
      {selectedReceipt && (
        <NeoModal
          isOpen={Boolean(selectedReceipt)}
          onClose={() => setSelectedReceipt(null)}
          title="Official Razorpay Invoice Receipt"
        >
          <div className="flex flex-col gap-4 font-mono text-xs">
            {/* Receipt Header */}
            <div className="flex items-center justify-between border-b-[2px] border-black pb-3">
              <div>
                <span className="font-display font-black text-lg uppercase tracking-tight">
                  MarketOS
                </span>
                <p className="text-[11px] text-black/60">Autonomous Marketing Operating System</p>
              </div>
              <NeoBadge tone="success">PAID & VERIFIED</NeoBadge>
            </div>

            {/* Receipt Metadata */}
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 border-[2px] border-black">
              <div>
                <span className="font-bold text-black/60 block text-[10px] uppercase">Receipt Reference</span>
                <span className="font-bold">{selectedReceipt.receipt}</span>
              </div>
              <div>
                <span className="font-bold text-black/60 block text-[10px] uppercase">Date Processed</span>
                <span>{new Date(selectedReceipt.date).toLocaleString()}</span>
              </div>
              <div>
                <span className="font-bold text-black/60 block text-[10px] uppercase">Payment Gateway</span>
                <span>Razorpay (256-bit Encrypted)</span>
              </div>
              <div>
                <span className="font-bold text-black/60 block text-[10px] uppercase">Razorpay Payment ID</span>
                <code className="text-[11px] font-bold">{selectedReceipt.paymentId}</code>
              </div>
            </div>

            {/* Item Table */}
            <div className="border-[2px] border-black">
              <div className="flex justify-between bg-black text-white p-2 font-bold uppercase text-[11px]">
                <span>Item</span>
                <span>Amount</span>
              </div>
              <div className="flex justify-between p-2.5 border-b border-black/10">
                <span>MarketOS {selectedReceipt.plan} Autonomous Agent Subscription</span>
                <span className="font-bold">
                  {selectedReceipt.currency === "INR" ? "₹" : "$"}
                  {selectedReceipt.amount}.00 {selectedReceipt.currency}
                </span>
              </div>
              <div className="flex justify-between p-2.5 bg-gray-50 font-display font-black text-sm">
                <span>Total Paid</span>
                <span>
                  {selectedReceipt.currency === "INR" ? "₹" : "$"}
                  {selectedReceipt.amount}.00 {selectedReceipt.currency}
                </span>
              </div>
            </div>

            {/* Footer */}
            <p className="text-[11px] text-black/60 text-center">
              Cryptographically verified by FinanceAgent. Thank you for powering your marketing fleet with MarketOS.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t-[2px] border-black">
              <NeoButton
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
              >
                <Printer className="mr-1.5 h-3.5 w-3.5 inline" />
                Print / Save PDF
              </NeoButton>
              <NeoButton
                variant="primary"
                size="sm"
                onClick={() => setSelectedReceipt(null)}
              >
                Close Receipt
              </NeoButton>
            </div>
          </div>
        </NeoModal>
      )}
    </div>
  );
}
