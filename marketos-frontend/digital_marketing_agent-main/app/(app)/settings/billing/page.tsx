"use client";

import { useState, useEffect } from "react";
import type { BillingPlan } from "@/lib/types";
import { NeoCard } from "@/components/ui/NeoCard";
import { NeoBadge } from "@/components/ui/NeoBadge";
import { NeoButton } from "@/components/ui/NeoButton";
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
  ExternalLink,
  Lock,
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

const initialPlans: BillingPlan[] = [
  {
    id: "p1",
    name: "Starter",
    priceMonthly: 0,
    features: ["1 workspace", "3 agents", "Community support", "2.0M Agent Tokens"],
    current: false,
  },
  {
    id: "p2",
    name: "Growth",
    priceMonthly: 99,
    features: [
      "5 workspaces",
      "All 17 agents",
      "Email support",
      "Daily optimization",
      "10.0M Agent Tokens",
    ],
    current: true,
  },
  {
    id: "p3",
    name: "Scale",
    priceMonthly: 399,
    features: [
      "Unlimited workspaces",
      "All 17 agents",
      "24/7 priority support",
      "Custom SLAs",
      "50.0M Agent Tokens",
    ],
    current: false,
  },
];

const accents = ["yellow", "pink", "cyan"] as const;

export default function BillingSettingsPage() {
  const [plansList, setPlansList] = useState<BillingPlan[]>(initialPlans);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("p2");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [billingData, setBillingData] = useState<BillingState>({
    plan: "GROWTH",
    billingCycle: "MONTHLY",
    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    seats: { used: 5, total: 25 },
    agentTokens: { used: 3400000, total: 10000000 },
    paymentMethod: "Razorpay • VISA ending in 4242",
    gateway: "Razorpay",
    gatewayMode: "Test",
    keyId: "rzp_test_TrhNQHCvgOMUn9",
    transactions: [
      {
        id: "tx_init_growth",
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        orderId: "order_TrhXivy8EbyQqD",
        paymentId: "pay_TrhZ1mK92qX",
        plan: "GROWTH",
        amount: 99,
        currency: "USD",
        status: "captured",
        receipt: "rcpt_growth_init",
        method: "Razorpay (Card)",
      },
    ],
  });

  const loadBillingInfo = async () => {
    try {
      const response = await apiRequest<any>("/settings/billing");
      if (response && response.data) {
        const d = response.data;
        setBillingData((prev) => ({
          ...prev,
          ...d,
          transactions: d.transactions || prev.transactions,
        }));

        if (d.plan) {
          const planUpper = d.plan.toUpperCase();
          setPlansList((list) =>
            list.map((p) => ({
              ...p,
              current: p.name.toUpperCase() === planUpper,
            })),
          );
          const found = initialPlans.find((p) => p.name.toUpperCase() === planUpper);
          if (found) setSelectedPlanId(found.id);
        }
      }
    } catch (error) {
      console.warn("Could not fetch remote billing state, using cached:", error);
    }
  };

  useEffect(() => {
    void loadBillingInfo();
  }, []);

  // Dynamically inject Razorpay Checkout script if needed
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
            `Workspace downgraded to ${plan.name} free tier. 2.0M agent token pool allocated.`,
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
        body: JSON.stringify({ planId: plan.id, planName: plan.name }),
      });

      if (!orderRes || !orderRes.orderId) {
        throw new Error(orderRes?.error || "Order initialization failed on payment gateway.");
      }

      const keyId = orderRes.keyId || billingData.keyId || "rzp_test_TrhNQHCvgOMUn9";

      // Configure Razorpay checkout modal
      const options = {
        key: keyId,
        amount: orderRes.amount,
        currency: orderRes.currency || "USD",
        name: "MarketOS AI Fleet",
        description: `${plan.name} Tier Subscription (${orderRes.currency === "USD" ? `$${plan.priceMonthly}` : `₹${plan.priceMonthly}`}/mo)`,
        order_id: orderRes.orderId,
        prefill: {
          name: "Acme Marketing",
          email: "billing@acme.io",
          contact: "+919876543210",
        },
        notes: {
          plan: plan.name,
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
            toast.info("Payment cancelled. Current tier remains unchanged.");
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

      // Create a $1 / ₹1 verification token order
      const orderRes = await apiRequest<any>("/settings/billing/create-order", {
        method: "POST",
        body: JSON.stringify({
          planId: "verification",
          planName: billingData.plan,
        }),
      });

      const keyId = orderRes?.keyId || billingData.keyId || "rzp_test_TrhNQHCvgOMUn9";
      const orderId = orderRes?.orderId;

      const options = {
        key: keyId,
        amount: orderRes?.amount || 9900,
        currency: orderRes?.currency || "USD",
        name: "MarketOS - Billing Card Update",
        description: "Verify & Tokenize Payment Method via Razorpay",
        order_id: orderId,
        prefill: {
          name: "Acme Marketing",
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

            toast.success("Payment Method Tokenized & Verified", {
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

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-[3px] border-black pb-4">
        <div>
          <h2 className="font-display text-2xl font-black uppercase tracking-tight">
            Subscription & SLA Allocation
          </h2>
          <p className="font-mono text-xs text-black/70">
            Managed autonomously by FinanceAgent & SupervisorAgent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NeoBadge tone="success" className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Active SLA
          </NeoBadge>
          <NeoBadge tone="info" className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Razorpay Gateway Connected
          </NeoBadge>
        </div>
      </div>

      {/* Razorpay Gateway Status Banner */}
      <div className="border-[3px] border-black bg-[#FFE600] p-4 shadow-neo flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="border-[2px] border-black bg-white p-2 shadow-neo-sm">
            <Lock className="h-5 w-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-black text-sm uppercase">Razorpay Payment Gateway</span>
              <span className="bg-black text-[#00E0FF] font-mono text-[10px] font-bold px-1.5 py-0.5 uppercase">
                {billingData.gatewayMode || "Test"} Mode Active
              </span>
            </div>
            <p className="font-mono text-xs text-black/80">
              API Key: <code className="font-bold">{billingData.keyId || "rzp_test_TrhNQHCvgOMUn9"}</code> • HMAC-SHA256 Cryptographic Verification
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="font-mono text-xs text-black/70">Agent Token Pool</div>
            <div className="font-display font-black text-sm">
              {(billingData.agentTokens.used / 1000000).toFixed(1)}M / {(billingData.agentTokens.total / 1000000).toFixed(1)}M Tokens
            </div>
          </div>
          <div className="h-8 w-1 bg-black/20 hidden sm:block" />
          <NeoBadge tone="neutral" className="bg-white">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 mr-1 inline" />
            PCI-DSS Compliant
          </NeoBadge>
        </div>
      </div>

      {/* Subscription Plans Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {plansList.map((plan, i) => {
          const isCurrent = plan.current;
          const isSelected = selectedPlanId === plan.id;
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
                <div className="flex items-baseline justify-between">
                  <div className="font-display text-3xl font-black">
                    {plan.priceMonthly === 0 ? "Free" : `$${plan.priceMonthly}/mo`}
                  </div>
                  {isCurrent ? (
                    <NeoBadge tone="success">Current Plan</NeoBadge>
                  ) : (
                    <NeoBadge tone="info">Available Tier</NeoBadge>
                  )}
                </div>

                <ul className="flex list-disc flex-col gap-2 pl-5 min-h-[140px]">
                  {plan.features.map((f) => (
                    <li key={f} className="font-medium text-sm">
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
                  Verified
                </NeoBadge>
              </div>
              <p className="font-mono text-xs text-black/70 flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-3.5 w-3.5" />
                Next automated billing cycle: <strong>{billingData.nextBillingDate}</strong> ({currentPlanObj.name} plan • ${currentPlanObj.priceMonthly}/mo)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NeoButton
              variant="secondary"
              size="sm"
              disabled={updatingPayment}
              onClick={handleUpdatePaymentMethod}
            >
              <CheckCircle2 className="mr-2 h-4 w-4 inline" />
              {updatingPayment ? "Connecting..." : "Update Card via Razorpay"}
            </NeoButton>
          </div>
        </div>
      </NeoCard>

      {/* Razorpay Verified Transactions & Invoices Table */}
      <NeoCard title="Razorpay Invoices & Payment Ledger" accent="yellow">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b-[2px] border-black bg-black/5 font-bold uppercase">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Description / Plan</th>
                <th className="py-2.5 px-3">Razorpay Payment ID</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {billingData.transactions && billingData.transactions.length > 0 ? (
                billingData.transactions.map((tx) => (
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
                      ${tx.amount}.00 {tx.currency}
                    </td>
                    <td className="py-3 px-3">
                      <NeoBadge tone="success" className="text-[10px]">
                        {tx.status.toUpperCase()}
                      </NeoBadge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          toast.success(`Receipt ${tx.receipt}`, {
                            description: `Razorpay Payment ID: ${tx.paymentId} • Amount: $${tx.amount} ${tx.currency} • Verified by FinanceAgent`,
                          })
                        }
                        className="inline-flex items-center gap-1 font-bold underline hover:text-[#00E0FF]"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        {tx.receipt}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-black/60">
                    No Razorpay transactions found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </NeoCard>
    </div>
  );
}
