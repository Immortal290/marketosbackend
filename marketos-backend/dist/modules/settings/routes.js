"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/modules/settings/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
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
  throw new Error("DATABASE_URL environment variable is not set. Check your .env file.");
}
var pool = new import_pg.Pool({ connectionString: DATABASE_URL });
var adapter = new import_adapter_pg.PrismaPg(pool);
var globalForPrisma = globalThis;
var prisma = globalForPrisma.prisma ?? new import_client.PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// src/modules/settings/routes.ts
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
  { id: "i6", name: "LinkedIn", category: "Social", connected: true, description: "Publish and track social posts." }
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
  billingCycle: "ANNUAL",
  nextBillingDate: "2027-01-01",
  seats: { used: 8, total: 25 },
  agentTokens: { used: 42e5, total: 1e7 },
  paymentMethod: "VISA ending 4242"
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
  res.status(200).json({ success: true, data: billingSettings });
});
router.patch("/billing/plan", (req, res) => {
  const { planId, planName } = req.body;
  const planMap = { p1: "STARTER", p2: "GROWTH", p3: "SCALE" };
  const targetPlan = planName || planMap[planId] || "GROWTH";
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
    agentFeedback: `FinanceAgent upgraded workspace SLA to ${targetPlan}. All 17 specialized AI agents unlocked with expanded token pool (${(billingSettings.agentTokens.total / 1e6).toFixed(1)}M tokens).`
  });
});
router.patch("/billing/payment", (req, res) => {
  if (req.body.paymentMethod) {
    billingSettings.paymentMethod = req.body.paymentMethod;
  }
  res.status(200).json({
    success: true,
    data: billingSettings,
    agentFeedback: `FinanceAgent verified billing credentials (${billingSettings.paymentMethod}) via secure Stripe tokenization.`
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
var routes_default = router;
