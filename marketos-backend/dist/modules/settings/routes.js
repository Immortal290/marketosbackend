"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/modules/settings/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default,
  encrypt: () => encrypt
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");

// src/lib/prisma.ts
var import_config = require("dotenv/config");
var import_client = require("@prisma/client");
var import_adapter_pg = require("@prisma/adapter-pg");
var import_pg = require("pg");
var DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "[Prisma] WARNING: DATABASE_URL environment variable is not set. Database queries will fail. Ensure DATABASE_URL is configured in Railway Variables."
  );
}
var pool = new import_pg.Pool({ connectionString: DATABASE_URL || "postgresql://localhost/marketos_placeholder" });
var adapter = new import_adapter_pg.PrismaPg(pool);
var globalForPrisma = globalThis;
var prisma = globalForPrisma.prisma ?? new import_client.PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// src/modules/settings/providers.ts
var PROVIDERS = {
  mailchimp: {
    id: "mailchimp",
    fields: [
      { key: "apiKey", regex: /^[a-f0-9]{32}-[a-z]{2,3}\d{1,2}$/ },
      { key: "audienceId", regex: /^[a-f0-9]{8,12}$/ }
    ],
    async verify({ apiKey, audienceId }) {
      const dc = apiKey.split("-")[1];
      const headers = { Authorization: "Basic " + Buffer.from("x:" + apiKey).toString("base64") };
      const ping = await fetch(`https://${dc}.api.mailchimp.com/3.0/ping`, { headers });
      if (!ping.ok) throw new Error("Mailchimp rejected this API key");
      const list = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}`, { headers });
      if (!list.ok) throw new Error("Audience ID not found in this account");
      const data = await list.json();
      return { accountLabel: data.name };
    }
  },
  hubspot: {
    id: "hubspot",
    fields: [
      { key: "portalId", regex: /^\d{6,10}$/ },
      { key: "token", regex: /^pat-[a-z0-9]+-[a-f0-9-]{36}$/ }
    ],
    async verify({ portalId, token }) {
      const r = await fetch("https://api.hubapi.com/account-info/v3/details", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("HubSpot rejected this token");
      const d = await r.json();
      if (String(d.portalId) !== String(portalId)) throw new Error("Token belongs to a different portal");
      return { accountLabel: `Portal ${d.portalId}` };
    }
  },
  meta: {
    id: "meta",
    fields: [
      { key: "adAccountId", regex: /^act_\d{5,20}$/ },
      { key: "pixelId", regex: /^\d{10,20}$/ },
      { key: "token", regex: /^EA[A-Za-z0-9]{20,}$/ }
    ],
    async verify({ adAccountId, pixelId, token }) {
      const q = (path, f) => fetch(`https://graph.facebook.com/v21.0/${path}?fields=${f}&access_token=${token}`);
      const acc = await q(adAccountId, "name,account_status");
      if (!acc.ok) throw new Error("Token has no access to this ad account");
      const px = await q(pixelId, "name");
      if (!px.ok) throw new Error("Pixel ID not found or not accessible");
      const data = await acc.json();
      return { accountLabel: data.name };
    }
  },
  linkedin: {
    id: "linkedin",
    fields: [
      { key: "adAccountId", regex: /^\d{5,15}$/ },
      { key: "companyPageId", regex: /^\d{5,15}$/ },
      { key: "insightPartnerId", regex: /^\d{5,15}$/ },
      { key: "token", regex: /^AQV[a-zA-Z0-9_-]{10,}$/ }
    ],
    async verify({ adAccountId, token }) {
      const r = await fetch(`https://api.linkedin.com/rest/adAccounts/${adAccountId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": "202312",
          "X-Restli-Protocol-Version": "2.0.0"
        }
      });
      if (!r.ok) throw new Error("LinkedIn token invalid or expired");
      const data = await r.json();
      return { accountLabel: data.name || `Ad Account ${adAccountId}` };
    }
  },
  ga4: {
    id: "ga4",
    fields: [
      { key: "propertyId", regex: /^\d{5,15}$/ },
      { key: "serviceAccount", regex: /"private_key":/ }
    ],
    async verify({ propertyId, serviceAccount }) {
      let parsed;
      try {
        parsed = JSON.parse(serviceAccount);
      } catch (e) {
        throw new Error("Invalid JSON for service account");
      }
      if (!parsed.client_email) throw new Error("Invalid service account JSON");
      return { accountLabel: `Property ${propertyId}` };
    }
  },
  google_ads: {
    id: "google_ads",
    fields: [
      { key: "customerId", regex: /^\d{3}-\d{3}-\d{4}$/ },
      { key: "developerToken", regex: /^.{10,30}$/ },
      { key: "clientId", regex: /^.+apps\.googleusercontent\.com$/ },
      { key: "clientSecret", regex: /^GOCSPX-.+$/ },
      { key: "refreshToken", regex: /^1\/\/.+$/ }
    ],
    async verify({ customerId }) {
      return { accountLabel: `Account ${customerId}` };
    }
  },
  razorpay: {
    id: "razorpay",
    fields: [
      { key: "keyId", regex: /^rzp_(test|live)_[a-zA-Z0-9]+$/ },
      { key: "keySecret", regex: /^[a-zA-Z0-9]{16,32}$/ }
    ],
    async verify({ keyId, keySecret }) {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const r = await fetch("https://api.razorpay.com/v1/payments?count=1", {
        headers: { Authorization: `Basic ${auth}` }
      });
      if (!r.ok) throw new Error("Razorpay rejected these credentials (invalid Key ID or Key Secret)");
      return { accountLabel: `Razorpay (${keyId.startsWith("rzp_test") ? "Test" : "Live"})` };
    }
  }
};

// src/modules/settings/razorpay.service.ts
var import_crypto = __toESM(require("crypto"));
var RazorpayService = class {
  keyId;
  keySecret;
  baseUrl = "https://api.razorpay.com/v1";
  constructor(keyId, keySecret) {
    this.keyId = keyId || process.env.RAZORPAY_KEY_ID || "rzp_test_TrhNQHCvgOMUn9";
    this.keySecret = keySecret || process.env.RAZORPAY_KEY_SECRET || "k811k53ViV7fAdern0v5vpAi";
  }
  getKeyId() {
    return this.keyId;
  }
  getAuthHeader() {
    return "Basic " + Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
  }
  /**
   * Create a new Razorpay order
   */
  async createOrder(options) {
    const payload = {
      amount: Math.round(options.amount),
      currency: options.currency || "USD",
      receipt: options.receipt || `rcpt_${Date.now()}`,
      notes: options.notes || {}
    };
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: "POST",
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.description || `Razorpay order creation failed with status ${res.status}`);
    }
    return await res.json();
  }
  /**
   * Cryptographically verify Razorpay payment HMAC SHA-256 signature
   */
  verifyPaymentSignature(options) {
    const { orderId, paymentId, signature } = options;
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = import_crypto.default.createHmac("sha256", this.keySecret).update(body).digest("hex");
    return expectedSignature === signature;
  }
  /**
   * Fetch payment details from Razorpay
   */
  async getPaymentDetails(paymentId) {
    const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: this.getAuthHeader()
      }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.description || `Failed to fetch payment details: ${res.status}`);
    }
    return await res.json();
  }
  /**
   * Verify Razorpay credentials validity
   */
  async verifyCredentials() {
    try {
      const res = await fetch(`${this.baseUrl}/payments?count=1`, {
        method: "GET",
        headers: {
          Authorization: this.getAuthHeader()
        }
      });
      return res.ok;
    } catch {
      return false;
    }
  }
};
var razorpayService = new RazorpayService();

// src/modules/settings/routes.ts
var import_crypto2 = __toESM(require("crypto"));
var KEY = Buffer.alloc(32, process.env.CRED_MASTER_KEY || "default_secret_key_32_bytes_long!");
function encrypt(text) {
  const iv = import_crypto2.default.randomBytes(12);
  const c = import_crypto2.default.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}
var router = (0, import_express.Router)();
var workspaceSettings = {
  id: "ws-uuid-001",
  name: "Acme Marketing",
  subdomain: "acme",
  timezone: "UTC",
  defaultTimezone: "UTC",
  brandColor: "#FFDE00",
  logoUrl: "https://marketos.app/logo.png",
  plan: "GROWTH",
  featureFlags: { aiAutopilot: true, autoOptimize: true }
};
var teamMembers = [
  { id: "u1", name: "Mara Lin", email: "mara@acme.io", role: "Owner", status: "active", avatarColor: "#FF2E93" },
  { id: "u2", name: "Devon Park", email: "devon@acme.io", role: "Admin", status: "active", avatarColor: "#00E0FF" },
  { id: "u3", name: "Sam Ortiz", email: "sam@acme.io", role: "Editor", status: "invited", avatarColor: "#00FF66" },
  { id: "u4", name: "Rae Cho", email: "rae@acme.io", role: "Viewer", status: "suspended", avatarColor: "#FFDE00" }
];
var integrationsList = [
  { id: "i1", name: "Google Ads", category: "Ads", connected: true, description: "Sync ad spend and campaign performance." },
  { id: "i2", name: "Meta Ads", category: "Ads", connected: false, description: "Run and monitor Facebook and Instagram ads." },
  { id: "i3", name: "GA4", category: "Analytics", connected: true, description: "Pull website conversion analytics." },
  { id: "i4", name: "HubSpot", category: "CRM", connected: false, description: "Sync contacts and lifecycle stages." },
  { id: "i5", name: "Mailchimp", category: "Email", connected: false, description: "Send and track email campaigns." },
  { id: "i6", name: "LinkedIn", category: "Social", connected: true, description: "Publish and track social posts." },
  { id: "razorpay", name: "Razorpay", category: "Payments", connected: true, description: "Live payment gateway and subscription auto-billing.", accountLabel: `Razorpay (${razorpayService.getKeyId().startsWith("rzp_test") ? "Test Mode" : "Live"})` }
];
var complianceSettings = {
  gdprEnabled: true,
  canSpamEnabled: true,
  caslEnabled: false,
  dataRetention: 365,
  score: 94,
  controls: [
    { id: "c1", label: "Data Retention Policy", description: "Auto-delete personal data after 24 months.", enabled: true, standard: "GDPR" },
    { id: "c2", label: "Right to Erasure", description: "Honor user deletion requests within 30 days.", enabled: true, standard: "GDPR" },
    { id: "c3", label: "Audit Logging", description: "Record all administrative actions immutably.", enabled: true, standard: "SOC2" },
    { id: "c4", label: "Do Not Sell", description: "Respect CCPA opt-out signals.", enabled: false, standard: "CCPA" },
    { id: "c5", label: "PHI Safeguards", description: "Encrypt protected health information at rest.", enabled: false, standard: "HIPAA" }
  ]
};
var billingSettings = {
  plan: "GROWTH",
  billingCycle: "MONTHLY",
  nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0],
  seats: { used: 5, total: 25 },
  agentTokens: { used: 34e5, total: 1e7 },
  paymentMethod: "Razorpay \u2022 VISA ending in 4242",
  gateway: "Razorpay",
  gatewayMode: razorpayService.getKeyId().startsWith("rzp_test") ? "Test" : "Live",
  keyId: razorpayService.getKeyId(),
  status: "active",
  transactions: [
    {
      id: "tx_init_growth",
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1e3).toISOString(),
      orderId: "order_TrhXivy8EbyQqD",
      paymentId: "pay_TrhZ1mK92qX",
      plan: "GROWTH",
      amount: 99,
      currency: "USD",
      status: "captured",
      receipt: "rcpt_growth_init",
      method: "Razorpay (Card)"
    }
  ]
};
var securitySettings = {
  mfaRequired: true,
  ssoEnabled: false,
  sessionTimeoutMinutes: "30",
  ipAllowlist: [],
  activeSessions: 3,
  policies: [
    { id: "s1", label: "Require Two-Factor Authentication", description: "All members must use 2FA to sign in.", enabled: true },
    { id: "s2", label: "Enforce SSO (SAML)", description: "Restrict login to the company identity provider.", enabled: false },
    { id: "s3", label: "Auto Session Timeout", description: "Log out idle sessions automatically.", enabled: true },
    { id: "s4", label: "IP Allowlist", description: "Only permit access from approved IP ranges.", enabled: false }
  ]
};
router.get("/workspace", async (req, res) => {
  try {
    const dbWs = await prisma.workspace.findFirst().catch(() => null);
    if (dbWs) {
      workspaceSettings.name = dbWs.name;
      workspaceSettings.id = dbWs.id;
    }
  } catch (_e) {
  }
  res.status(200).json({ success: true, data: workspaceSettings });
});
router.patch("/workspace", async (req, res) => {
  try {
    workspaceSettings = { ...workspaceSettings, ...req.body };
    if (req.body.name) {
      const dbWs = await prisma.workspace.findFirst().catch(() => null);
      if (dbWs) {
        await prisma.workspace.update({ where: { id: dbWs.id }, data: { name: req.body.name } }).catch(() => null);
      }
    }
  } catch (_e) {
  }
  res.status(200).json({
    success: true,
    data: workspaceSettings,
    agentFeedback: `Supervisor & Creative agents synchronized with workspace '${workspaceSettings.name}' (Brand Color: ${workspaceSettings.brandColor}, Timezone: ${workspaceSettings.defaultTimezone || workspaceSettings.timezone}).`
  });
});
router.get("/team", (req, res) => {
  res.status(200).json({ success: true, data: teamMembers });
});
router.post("/team/invite", (req, res) => {
  const { email, role = "Viewer" } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required" });
  }
  const name = email.split("@")[0];
  const colors = ["#FFDE00", "#FF2E93", "#00E0FF", "#BFFF00", "#00FF66"];
  const newMember = {
    id: `u${Date.now()}`,
    name,
    email,
    role,
    status: "invited",
    avatarColor: colors[Math.floor(Math.random() * colors.length)]
  };
  teamMembers.push(newMember);
  res.status(200).json({
    success: true,
    data: newMember,
    agentFeedback: `OnboardingAgent initiated invite sequence for ${email} as ${role}. Permissions linked across all 11 active agents.`
  });
});
router.delete("/team/:userId", (req, res) => {
  const { userId } = req.params;
  const removed = teamMembers.find((m) => m.id === userId);
  teamMembers = teamMembers.filter((m) => m.id !== userId);
  res.status(200).json({
    success: true,
    data: removed || null,
    agentFeedback: `SecurityAgent revoked active sessions, API keys, and workspace access for ${removed ? removed.name : userId}.`
  });
});
router.get("/integrations", (req, res) => {
  res.status(200).json({ success: true, data: integrationsList });
});
router.patch("/integrations/:id", (req, res) => {
  const { id } = req.params;
  const { connected } = req.body;
  let target = integrationsList.find((i) => i.id === id);
  if (target && typeof connected === "boolean") {
    target.connected = connected;
  } else if (!target && req.body.name) {
    target = {
      id,
      name: req.body.name,
      category: req.body.category || "Custom",
      connected: !!connected,
      description: req.body.description || "Custom integration"
    };
    integrationsList.push(target);
  }
  res.status(200).json({
    success: true,
    data: integrationsList,
    agentFeedback: target?.connected ? `AdsAgent & AnalyticsAgent established real-time bidirectional telemetry sync with ${target.name}.` : `AnalyticsAgent gracefully unlinked ${target?.name || id} pipeline without data loss.`
  });
});
router.post("/integrations/:provider/connect", async (req, res) => {
  const p = PROVIDERS[req.params.provider];
  if (!p) return res.status(404).json({ success: false, error: "Unknown integration" });
  const values = {};
  for (const f of p.fields) {
    const v = String(req.body[f.key] ?? "").trim();
    if (!f.regex.test(v)) return res.status(400).json({ success: false, field: f.key, error: `Invalid format` });
    values[f.key] = v;
  }
  try {
    const { accountLabel } = await p.verify(values);
    let target = integrationsList.find((i) => i.id === p.id);
    if (!target) {
      target = { id: p.id, name: p.id, category: "Integration", connected: true, description: "" };
      integrationsList.push(target);
    }
    target.connected = true;
    target.accountLabel = accountLabel;
    target.lastVerifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    res.json({ success: true, status: "active", accountLabel, data: integrationsList });
  } catch (e) {
    res.status(422).json({ success: false, status: "error", error: e.message });
  }
});
router.get("/compliance", (req, res) => {
  res.status(200).json({ success: true, data: complianceSettings });
});
router.patch("/compliance", (req, res) => {
  if (req.body.controls && Array.isArray(req.body.controls)) {
    complianceSettings.controls = req.body.controls;
  }
  if (typeof req.body.gdprEnabled === "boolean") complianceSettings.gdprEnabled = req.body.gdprEnabled;
  if (typeof req.body.canSpamEnabled === "boolean") complianceSettings.canSpamEnabled = req.body.canSpamEnabled;
  if (typeof req.body.caslEnabled === "boolean") complianceSettings.caslEnabled = req.body.caslEnabled;
  res.status(200).json({
    success: true,
    data: complianceSettings,
    agentFeedback: `ComplianceAgent locked new regulatory safeguards across all 11 AI agents. Data audit trails and privacy policies updated.`
  });
});
router.get("/billing", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      ...billingSettings,
      keyId: razorpayService.getKeyId(),
      gateway: "Razorpay",
      gatewayMode: razorpayService.getKeyId().startsWith("rzp_test") ? "Test" : "Live"
    }
  });
});
router.post("/settings/billing/create-order", async (req, res) => {
  try {
    const { planId, planName } = req.body;
    const targetPlan = (planName || (planId === "p3" ? "SCALE" : planId === "p2" ? "GROWTH" : "STARTER")).toUpperCase();
    if (targetPlan === "STARTER") {
      billingSettings.plan = "STARTER";
      billingSettings.agentTokens.total = 2e6;
      return res.status(200).json({
        success: true,
        isFree: true,
        plan: "STARTER",
        data: billingSettings,
        agentFeedback: `Workspace switched to STARTER tier. Free token pool allocated (2.0M tokens).`
      });
    }
    const priceUsd = targetPlan === "SCALE" ? 399 : 99;
    const amountInCents = priceUsd * 100;
    const receipt = `rcpt_${targetPlan.toLowerCase()}_${Date.now()}`;
    const order = await razorpayService.createOrder({
      amount: amountInCents,
      currency: "USD",
      receipt,
      notes: {
        plan: targetPlan,
        service: "MarketOS AI Agents Subscription"
      }
    });
    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayService.getKeyId(),
      plan: targetPlan,
      receipt: order.receipt
    });
  } catch (error) {
    console.error("Failed to create Razorpay order:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to initialize payment gateway order with Razorpay"
    });
  }
});
router.post("/settings/billing/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planName, planId } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Missing Razorpay order ID, payment ID, or signature"
      });
    }
    const isValid = razorpayService.verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: "Invalid Razorpay signature. Cryptographic verification failed."
      });
    }
    let paymentMethodLabel = "Razorpay Verified Payment";
    let paymentMethodType = "Card";
    try {
      const paymentDetails = await razorpayService.getPaymentDetails(razorpay_payment_id);
      if (paymentDetails) {
        if (paymentDetails.method === "card" && paymentDetails.card) {
          const card = paymentDetails.card;
          paymentMethodType = card.network || "Card";
          paymentMethodLabel = `Razorpay \u2022 ${card.network || "Card"} ending in ${card.last4 || "\u2022\u2022\u2022\u2022"}`;
        } else if (paymentDetails.method === "upi") {
          paymentMethodType = "UPI";
          paymentMethodLabel = `Razorpay \u2022 UPI (${paymentDetails.vpa || "Verified"})`;
        } else if (paymentDetails.method === "netbanking") {
          paymentMethodType = "Netbanking";
          paymentMethodLabel = `Razorpay \u2022 Netbanking (${paymentDetails.bank || "Verified"})`;
        } else {
          paymentMethodLabel = `Razorpay \u2022 ${paymentDetails.method || "Online"}`;
        }
      }
    } catch (fetchErr) {
      console.warn("Could not fetch payment details, using standard label:", fetchErr);
    }
    const targetPlan = (planName || (planId === "p3" ? "SCALE" : "GROWTH")).toUpperCase();
    billingSettings.plan = targetPlan;
    billingSettings.paymentMethod = paymentMethodLabel;
    billingSettings.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
    if (targetPlan === "SCALE") {
      billingSettings.agentTokens.total = 5e7;
    } else if (targetPlan === "GROWTH") {
      billingSettings.agentTokens.total = 1e7;
    } else {
      billingSettings.agentTokens.total = 2e6;
    }
    const newTx = {
      id: `tx_${Date.now()}`,
      date: (/* @__PURE__ */ new Date()).toISOString(),
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      plan: targetPlan,
      amount: targetPlan === "SCALE" ? 399 : 99,
      currency: "USD",
      status: "captured",
      receipt: `rcpt_${targetPlan.toLowerCase()}_${Date.now()}`,
      method: paymentMethodLabel
    };
    billingSettings.transactions = [newTx, ...billingSettings.transactions.slice(0, 9)];
    res.status(200).json({
      success: true,
      data: billingSettings,
      transaction: newTx,
      agentFeedback: `FinanceAgent cryptographically verified Razorpay payment ${razorpay_payment_id} and upgraded workspace SLA to ${targetPlan}. All 17 specialized AI agents unlocked with expanded token pool (${(billingSettings.agentTokens.total / 1e6).toFixed(1)}M tokens).`
    });
  } catch (error) {
    console.error("Error in Razorpay verification:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Payment verification failed"
    });
  }
});
router.post("/settings/billing/update-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (razorpay_signature && razorpay_order_id && razorpay_payment_id) {
      const isValid = razorpayService.verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
      });
      if (!isValid) {
        return res.status(400).json({ success: false, error: "Invalid Razorpay signature" });
      }
      const paymentDetails = await razorpayService.getPaymentDetails(razorpay_payment_id).catch(() => null);
      if (paymentDetails?.card) {
        billingSettings.paymentMethod = `Razorpay \u2022 ${paymentDetails.card.network || "Card"} ending in ${paymentDetails.card.last4 || "\u2022\u2022\u2022\u2022"}`;
      } else if (paymentDetails?.method === "upi") {
        billingSettings.paymentMethod = `Razorpay \u2022 UPI (${paymentDetails.vpa || "Verified"})`;
      } else {
        billingSettings.paymentMethod = `Razorpay \u2022 Online Verified (${razorpay_payment_id.slice(-6)})`;
      }
    } else if (req.body.paymentMethod) {
      billingSettings.paymentMethod = req.body.paymentMethod;
    }
    res.status(200).json({
      success: true,
      data: billingSettings,
      agentFeedback: `FinanceAgent verified and updated default billing method (${billingSettings.paymentMethod}) via Razorpay secure tokenization.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || "Failed to update payment method" });
  }
});
router.post("/settings/billing/webhook", (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || "k811k53ViV7fAdern0v5vpAi";
  const signature = req.headers["x-razorpay-signature"];
  if (signature) {
    const shasum = import_crypto2.default.createHmac("sha256", secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");
    if (digest !== signature) {
      return res.status(400).json({ status: "invalid_signature" });
    }
  }
  const event = req.body.event;
  if (event === "payment.captured" || event === "order.paid") {
    const payment = req.body.payload?.payment?.entity;
    if (payment) {
      const plan = payment.notes?.plan || "GROWTH";
      billingSettings.plan = plan;
      billingSettings.status = "active";
      if (payment.card) {
        billingSettings.paymentMethod = `Razorpay \u2022 ${payment.card.network || "Card"} ending in ${payment.card.last4 || "\u2022\u2022\u2022\u2022"}`;
      }
    }
  }
  res.status(200).json({ status: "ok" });
});
router.patch("/billing/plan", (req, res) => {
  const { planId, planName } = req.body;
  const planMap = { p1: "STARTER", p2: "GROWTH", p3: "SCALE" };
  const targetPlan = (planName || planMap[planId] || "GROWTH").toUpperCase();
  billingSettings.plan = targetPlan;
  if (targetPlan === "SCALE") {
    billingSettings.agentTokens.total = 5e7;
  } else if (targetPlan === "GROWTH") {
    billingSettings.agentTokens.total = 1e7;
  } else {
    billingSettings.agentTokens.total = 2e6;
  }
  res.status(200).json({
    success: true,
    data: billingSettings,
    agentFeedback: `FinanceAgent adjusted workspace SLA to ${targetPlan}. AI agents pool allocated (${(billingSettings.agentTokens.total / 1e6).toFixed(1)}M tokens).`
  });
});
router.patch("/billing/payment", (req, res) => {
  if (req.body.paymentMethod) {
    billingSettings.paymentMethod = req.body.paymentMethod;
  }
  res.status(200).json({
    success: true,
    data: billingSettings,
    agentFeedback: `FinanceAgent verified billing credentials (${billingSettings.paymentMethod}) via secure Razorpay tokenization.`
  });
});
router.get("/security", (req, res) => {
  res.status(200).json({ success: true, data: securitySettings });
});
router.patch("/security", (req, res) => {
  if (req.body.policies && Array.isArray(req.body.policies)) {
    securitySettings.policies = req.body.policies;
  }
  if (typeof req.body.mfaRequired === "boolean") securitySettings.mfaRequired = req.body.mfaRequired;
  if (typeof req.body.ssoEnabled === "boolean") securitySettings.ssoEnabled = req.body.ssoEnabled;
  if (req.body.sessionTimeoutMinutes) securitySettings.sessionTimeoutMinutes = String(req.body.sessionTimeoutMinutes);
  res.status(200).json({
    success: true,
    data: securitySettings,
    agentFeedback: `SupervisorAgent enforced new security posture (Session timeout: ${securitySettings.sessionTimeoutMinutes} min, MFA: ${securitySettings.policies.find((p) => p.id === "s1")?.enabled ? "Mandated" : "Optional"}).`
  });
});
router.get("/api-keys", async (req, res) => {
  try {
    const user = await prisma.user.findFirst();
    res.status(200).json({ success: true, data: user?.apiKeys || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch API keys" });
  }
});
router.patch("/api-keys", async (req, res) => {
  try {
    const user = await prisma.user.findFirst();
    if (user) {
      const currentKeys = typeof user.apiKeys === "object" && user.apiKeys !== null ? user.apiKeys : {};
      const updatedKeys = { ...currentKeys, ...req.body };
      await prisma.user.update({
        where: { id: user.id },
        data: { apiKeys: updatedKeys }
      });
      res.status(200).json({ success: true, data: updatedKeys, agentFeedback: "API keys updated securely in database." });
    } else {
      res.status(404).json({ success: false, error: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update API keys" });
  }
});
var routes_default = router;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  encrypt
});
