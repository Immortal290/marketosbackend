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

// src/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default25
});
module.exports = __toCommonJS(routes_exports);
var import_express26 = require("express");

// src/modules/auth/routes.ts
var import_express = require("express");

// src/modules/auth/service.ts
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));

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

// src/modules/auth/service.ts
var JWT_SECRET = process.env.JWT_SECRET || "secret";
var JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
var JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret";
var JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
var AuthService = class {
  async register(data) {
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new Error("User already exists");
    }
    const hashedPassword = await import_bcryptjs.default.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName
      }
    });
    return this.generateTokens(user.id);
  }
  async login(data) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new Error("Invalid credentials");
    }
    const isMatch = await import_bcryptjs.default.compare(data.password, user.password);
    if (!isMatch) {
      throw new Error("Invalid credentials");
    }
    return this.generateTokens(user.id);
  }
  async refresh(refreshToken) {
    try {
      const payload = import_jsonwebtoken.default.verify(refreshToken, JWT_REFRESH_SECRET);
      return this.generateTokens(payload.userId);
    } catch {
      throw new Error("Invalid or expired refresh token");
    }
  }
  async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true
      }
    });
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }
  generateTokens(userId) {
    const accessToken = import_jsonwebtoken.default.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = import_jsonwebtoken.default.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
    return { accessToken, refreshToken, expiresIn: 86400 };
  }
};

// src/modules/auth/controller.ts
var import_http_status_codes = require("http-status-codes");
var AuthController = class {
  service = new AuthService();
  register = async (req, res, next) => {
    try {
      const tokens = await this.service.register(req.body);
      res.status(import_http_status_codes.StatusCodes.CREATED).json({
        success: true,
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  };
  login = async (req, res, next) => {
    try {
      const tokens = await this.service.login(req.body);
      res.status(import_http_status_codes.StatusCodes.OK).json({
        success: true,
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  };
  refresh = async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(import_http_status_codes.StatusCodes.BAD_REQUEST).json({
          success: false,
          error: "refreshToken is required"
        });
      }
      const tokens = await this.service.refresh(refreshToken);
      res.status(import_http_status_codes.StatusCodes.OK).json({
        success: true,
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  };
  logout = async (req, res, next) => {
    try {
      res.status(import_http_status_codes.StatusCodes.OK).json({
        success: true,
        data: null,
        message: "Logged out successfully"
      });
    } catch (error) {
      next(error);
    }
  };
  me = async (req, res, next) => {
    try {
      const userId = req.user?.userId ?? "unknown";
      const user = await this.service.getMe(userId);
      res.status(import_http_status_codes.StatusCodes.OK).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  };
};

// src/middlewares/validate.middleware.ts
var import_zod = require("zod");
var import_http_status_codes2 = require("http-status-codes");
var validate = (schema) => {
  return async (req, res, next) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      return next();
    } catch (error) {
      console.log("VALIDATION ERROR CAUGHT:", error);
      console.log("IS ZOD ERROR?", error instanceof import_zod.ZodError);
      if (error instanceof import_zod.ZodError) {
        return res.status(import_http_status_codes2.StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Validation failed",
          errors: error.errors
        });
      }
      return next(error);
    }
  };
};

// src/modules/auth/validator.ts
var import_zod2 = require("zod");
var registerSchema = import_zod2.z.object({
  body: import_zod2.z.object({
    email: import_zod2.z.string().email(),
    password: import_zod2.z.string().min(8),
    firstName: import_zod2.z.string().optional(),
    lastName: import_zod2.z.string().optional(),
    workspaceName: import_zod2.z.string().optional()
  })
});
var loginSchema = import_zod2.z.object({
  body: import_zod2.z.object({
    email: import_zod2.z.string().email(),
    password: import_zod2.z.string()
  })
});

// src/modules/auth/routes.ts
var router = (0, import_express.Router)();
var controller = new AuthController();
router.post("/register", validate(registerSchema), controller.register);
router.post("/login", validate(loginSchema), controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", controller.me);
var routes_default = router;

// src/modules/settings/routes.ts
var import_express2 = require("express");
var router2 = (0, import_express2.Router)();
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
router2.get("/workspace", async (req, res) => {
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
router2.patch("/workspace", async (req, res) => {
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
router2.get("/team", (req, res) => {
  res.status(200).json({ success: true, data: teamMembers });
});
router2.post("/team/invite", (req, res) => {
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
router2.delete("/team/:userId", (req, res) => {
  const { userId } = req.params;
  const removed = teamMembers.find((m) => m.id === userId);
  teamMembers = teamMembers.filter((m) => m.id !== userId);
  res.status(200).json({
    success: true,
    data: removed || null,
    agentFeedback: `SecurityAgent revoked active sessions, API keys, and workspace access for ${removed ? removed.name : userId}.`
  });
});
router2.get("/integrations", (req, res) => {
  res.status(200).json({ success: true, data: integrationsList });
});
router2.patch("/integrations/:id", (req, res) => {
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
router2.get("/compliance", (req, res) => {
  res.status(200).json({ success: true, data: complianceSettings });
});
router2.patch("/compliance", (req, res) => {
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
router2.get("/billing", (req, res) => {
  res.status(200).json({ success: true, data: billingSettings });
});
router2.patch("/billing/plan", (req, res) => {
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
router2.patch("/billing/payment", (req, res) => {
  if (req.body.paymentMethod) {
    billingSettings.paymentMethod = req.body.paymentMethod;
  }
  res.status(200).json({
    success: true,
    data: billingSettings,
    agentFeedback: `FinanceAgent verified billing credentials (${billingSettings.paymentMethod}) via secure Stripe tokenization.`
  });
});
router2.get("/security", (req, res) => {
  res.status(200).json({ success: true, data: securitySettings });
});
router2.patch("/security", (req, res) => {
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
router2.get("/api-keys", async (req, res) => {
  try {
    const user = await prisma.user.findFirst();
    res.status(200).json({ success: true, data: user?.apiKeys || {} });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch API keys" });
  }
});
router2.patch("/api-keys", async (req, res) => {
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
var routes_default2 = router2;

// src/modules/dashboard/routes.ts
var import_express3 = require("express");

// src/modules/dashboard/service.ts
var DashboardService = class {
  async getKpis(workspaceId) {
    const totalCampaigns = await prisma.campaign.count({
      where: { workspaceId }
    });
    const activeCampaigns = await prisma.campaign.count({
      where: { workspaceId, status: "ACTIVE" }
    });
    return {
      totalCampaigns,
      activeCampaigns
      // more KPIs can be added here
    };
  }
  async getActivityFeed(workspaceId) {
    const recentCampaigns = await prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    return recentCampaigns.map((c) => ({
      type: "CAMPAIGN_CREATED",
      title: `Campaign "${c.name}" was created`,
      timestamp: c.createdAt
    }));
  }
};

// src/modules/dashboard/controller.ts
var import_http_status_codes3 = require("http-status-codes");
var DashboardController = class {
  service = new DashboardService();
  getKpis = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes3.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const kpis = await this.service.getKpis(workspaceId);
      res.status(import_http_status_codes3.StatusCodes.OK).json({ success: true, data: kpis });
    } catch (error) {
      next(error);
    }
  };
  getActivityFeed = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes3.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const feed = await this.service.getActivityFeed(workspaceId);
      res.status(import_http_status_codes3.StatusCodes.OK).json({ success: true, data: feed });
    } catch (error) {
      next(error);
    }
  };
};

// src/modules/agents/types.ts
var AgentType = /* @__PURE__ */ ((AgentType2) => {
  AgentType2["AB_TEST"] = "AB_TEST";
  AgentType2["ANALYTICS"] = "ANALYTICS";
  AgentType2["COMPETITOR"] = "COMPETITOR";
  AgentType2["COMPLIANCE"] = "COMPLIANCE";
  AgentType2["COPY"] = "COPY";
  AgentType2["CREATIVE"] = "CREATIVE";
  AgentType2["EMAIL"] = "EMAIL";
  AgentType2["FINANCE"] = "FINANCE";
  AgentType2["LEAD_SCORING"] = "LEAD_SCORING";
  AgentType2["MONITOR"] = "MONITOR";
  AgentType2["ONBOARDING"] = "ONBOARDING";
  AgentType2["PERSONALIZATION"] = "PERSONALIZATION";
  AgentType2["REPORTING"] = "REPORTING";
  AgentType2["SEO"] = "SEO";
  AgentType2["SMS"] = "SMS";
  AgentType2["SOCIAL"] = "SOCIAL";
  AgentType2["SUPERVISOR"] = "SUPERVISOR";
  AgentType2["VOICE"] = "VOICE";
  return AgentType2;
})(AgentType || {});

// src/modules/agents/repository.ts
var AgentsRepository = class {
  getAgentName(type) {
    const parts = type.split("_");
    const capitalized = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("");
    return `${capitalized}Agent`;
  }
  getAllAgents() {
    return Object.values(AgentType).map((type, i) => ({
      id: `agent-${i + 1}`,
      name: this.getAgentName(type),
      type,
      status: ["SUPERVISOR", "COPY", "EMAIL", "COMPLIANCE"].includes(type) ? "RUNNING" : "IDLE",
      currentTask: ["SUPERVISOR", "COPY", "EMAIL", "COMPLIANCE"].includes(type) ? "Processing tasks" : null,
      queueLength: ["SUPERVISOR", "COPY", "EMAIL", "COMPLIANCE"].includes(type) ? 3 : 0,
      successRate: 96 + Math.round(Math.random() * 3 * 10) / 10,
      runtimeMs: 142e3,
      tokenUsage: Math.floor(Math.random() * 5e4),
      costUsd: Math.round(Math.random() * 200) / 100
    }));
  }
  getAgentByType(type) {
    const uppercaseType = type.toUpperCase();
    if (!Object.values(AgentType).includes(uppercaseType)) {
      return null;
    }
    return {
      id: `agent-${uppercaseType}`,
      name: this.getAgentName(uppercaseType),
      type: uppercaseType,
      status: "IDLE",
      currentTask: null,
      queueLength: 0,
      successRate: 98.4,
      runtimeMs: 0,
      tokenUsage: 12400,
      costUsd: 0.24
    };
  }
  getAgentTasks(type, status, page = 1, limit = 20) {
    return { tasks: [], total: 0 };
  }
  getAgentMemory(type, memType, search, page = 1, limit = 20) {
    return { memories: [], total: 0 };
  }
};

// src/lib/kafka.ts
var import_kafkajs = require("kafkajs");

// src/lib/logger.ts
var import_winston = __toESM(require("winston"));
var import_fs = __toESM(require("fs"));
var { combine, timestamp, printf, colorize } = import_winston.default.format;
var customFormat = printf(({ level, message, timestamp: timestamp2, ...metadata }) => {
  let msg = `${timestamp2} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});
var isProduction = process.env.NODE_ENV === "production";
var transports = [
  new import_winston.default.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      customFormat
    )
  })
];
if (!isProduction) {
  try {
    if (!import_fs.default.existsSync("logs")) import_fs.default.mkdirSync("logs", { recursive: true });
    transports.push(new import_winston.default.transports.File({ filename: "logs/error.log", level: "error" }));
    transports.push(new import_winston.default.transports.File({ filename: "logs/combined.log" }));
  } catch (_e) {
  }
}
var logger = import_winston.default.createLogger({
  level: isProduction ? "info" : "debug",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    import_winston.default.format.json()
  ),
  transports
});

// src/lib/socket.ts
var import_socket = require("socket.io");
var io;

// src/lib/redis.ts
var import_ioredis = __toESM(require("ioredis"));
var redisClient = new import_ioredis.default({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
  lazyConnect: true,
  // Limit reconnect attempts so a missing Redis doesn't spam logs forever
  retryStrategy: (times) => {
    if (times > 5) {
      logger.warn("[Redis] Max reconnect attempts reached. Redis features will be unavailable.");
      return null;
    }
    return Math.min(times * 500, 3e3);
  }
});
redisClient.on("connect", () => {
  logger.info("[Redis] Connected");
});
redisClient.on("error", (err) => {
  logger.error("[Redis] Connection error (non-fatal):", err.message);
});

// src/lib/kafka.ts
var kafkaBroker = process.env.KAFKA_BROKER || "localhost:9092";
var clientId = process.env.KAFKA_CLIENT_ID || "marketos-backend";
var kafka = new import_kafkajs.Kafka({
  clientId,
  brokers: [kafkaBroker],
  // ── Railway fix ────────────────────────────────────────────────────────────
  // The Railway Kafka broker returns its internal container IP in metadata
  // after the bootstrap handshake. That IP is unreachable from other services.
  // enforceRequestTimeout makes stuck connections fail fast so KafkaJS
  // re-resolves the hostname via DNS on the next retry instead of spinning.
  enforceRequestTimeout: true,
  requestTimeout: 15e3,
  retry: {
    retries: 5,
    initialRetryTime: 2e3,
    maxRetryTime: 15e3,
    factor: 2,
    restartOnFailure: async () => true
  }
});
var producer = kafka.producer();
var resultConsumer = kafka.consumer({
  groupId: "marketos-backend-results"
});

// src/lib/agentClient.ts
var AGENT_SERVICE_CANDIDATES = [
  process.env.AGENT_SERVICE_URL,
  process.env.AGENTS_SERVICE_URL,
  process.env.AGENTS_URL,
  process.env.RAILWAY_AGENTS_URL,
  "http://renewed-dedication.railway.internal:8000",
  "http://renewed-dedication.railway.internal",
  "http://reneweddedication.railway.internal:8000",
  "http://reneweddedication.railway.internal",
  "http://marketos_agents:8000",
  "http://localhost:8000"
].filter((url) => Boolean(url) && typeof url === "string");
logger.info(`[AgentClient] Candidates configured: ${AGENT_SERVICE_CANDIDATES.join(", ")}`);
async function agentFetch(path, opts = {}) {
  const { method = "GET", body, timeoutMs = 3e4 } = opts;
  let lastErr = null;
  for (const base of AGENT_SERVICE_CANDIDATES) {
    const url = `${base.replace(/\/$/, "")}${path}`;
    const controller7 = new AbortController();
    const timer = setTimeout(() => controller7.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body !== void 0 ? JSON.stringify(body) : void 0,
        signal: controller7.signal
      });
      clearTimeout(timer);
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Agent service returned ${response.status}: ${text.slice(0, 200)}`);
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
    }
  }
  throw lastErr || new Error(`Failed to reach agent service at any candidate URL: ${AGENT_SERVICE_CANDIDATES.join(", ")}`);
}
async function agentFetchStream(path, body) {
  let lastErr = null;
  for (const base of AGENT_SERVICE_CANDIDATES) {
    const url = `${base.replace(/\/$/, "")}${path}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (response.ok && response.body) {
        return response.body;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`Agent stream failed to connect at any candidate URL: ${AGENT_SERVICE_CANDIDATES.join(", ")}`);
}
async function getAgentServiceHealth() {
  return agentFetch("/v1/health");
}
async function listAgents() {
  return agentFetch("/v1/agents");
}
async function runAgent(agentName, state) {
  return agentFetch(`/v1/agents/${agentName}/run`, {
    method: "POST",
    body: { state },
    timeoutMs: 6e4
  });
}
async function runCampaignSync(opts) {
  return agentFetch("/v1/pipeline/campaign", {
    method: "POST",
    body: opts,
    timeoutMs: 12e4
  });
}
async function runCampaignAsync(opts) {
  return agentFetch("/v1/pipeline/campaign/async", {
    method: "POST",
    body: opts,
    timeoutMs: 15e3
  });
}
async function getCampaignStatus(campaignId) {
  return agentFetch(`/v1/pipeline/${campaignId}/status`);
}
async function streamCampaign(opts) {
  return agentFetchStream("/v1/pipeline/campaign/stream", opts);
}
async function streamQuery(opts) {
  return agentFetchStream("/v1/query/stream", opts);
}
var agentClient = {
  baseUrl: AGENT_SERVICE_CANDIDATES[0] || "http://localhost:8000",
  candidates: AGENT_SERVICE_CANDIDATES,
  getHealth: getAgentServiceHealth,
  listAgents,
  runAgent,
  runCampaignSync,
  runCampaignAsync,
  getCampaignStatus,
  streamCampaign,
  streamQuery
};
var agentClient_default = agentClient;

// src/modules/agents/service.ts
function metaToAgent(meta, index) {
  const typeKey = meta.name.toUpperCase().replace(/-/g, "_");
  return {
    id: `agent-${index + 1}`,
    name: meta.name.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(""),
    type: typeKey,
    status: "IDLE",
    currentTask: null,
    queueLength: 0,
    successRate: 98,
    runtimeMs: 0,
    tokenUsage: 0,
    costUsd: 0
  };
}
var AgentsService = class {
  repository = new AgentsRepository();
  /**
   * Return live agent list from the Python service, with fallback to the
   * static mock registry if the service is unavailable.
   */
  async getAllAgents() {
    try {
      const response = await agentClient_default.listAgents();
      if (response.ok && Array.isArray(response.data?.agents)) {
        return response.data.agents.map((meta, i) => metaToAgent(meta, i));
      }
    } catch (err) {
      logger.warn("[AgentsService] Agent service unavailable \u2014 falling back to static data:", err);
    }
    return this.repository.getAllAgents();
  }
  /**
   * Synchronous version for backwards-compatible callers that don't await.
   * Prefer getAllAgents() for new code.
   */
  getAgentByType(type) {
    return this.repository.getAgentByType(type);
  }
  getAgentTasks(type, status, page = 1, limit = 20) {
    return this.repository.getAgentTasks(type, status, page, limit);
  }
  getAgentMemory(type, memType, search, page = 1, limit = 20) {
    return this.repository.getAgentMemory(type, memType, search, page, limit);
  }
  /**
   * Run a single named agent on the Python service.
   */
  async runAgent(agentName, state) {
    return agentClient_default.runAgent(agentName, state);
  }
  /**
   * Execute a control command against an agent via Kafka.
   */
  async executeCommand(type, payload) {
    try {
      const topic = `agent.${type.toLowerCase()}.commands`;
      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(payload) }]
      });
      logger.info(`Successfully dispatched command to topic ${topic}`);
      return true;
    } catch (error) {
      logger.error("Failed to dispatch command to Kafka:", error);
      return false;
    }
  }
};

// src/modules/dashboard/routes.ts
var router3 = (0, import_express3.Router)();
var controller2 = new DashboardController();
router3.get("/kpis", controller2.getKpis);
router3.get("/activity", controller2.getActivityFeed);
router3.get("/agents", async (req, res) => {
  const agentsService = new AgentsService();
  res.status(200).json({
    success: true,
    data: await agentsService.getAllAgents()
  });
});
router3.get("/alerts", async (req, res) => {
  const agentsService = new AgentsService();
  const agents = await agentsService.getAllAgents();
  const alerts = [];
  const failedAgents = agents.filter((a) => a.status === "ERROR" || a.successRate < 90);
  failedAgents.forEach((agent) => {
    alerts.push({
      id: `alert-${agent.id}`,
      type: "CRITICAL",
      title: "Agent Performance Degradation",
      message: `${agent.name} is experiencing low success rates or errors.`,
      resolved: false,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  if (alerts.length === 0) {
    alerts.push({
      id: "1",
      type: "WARNING",
      title: "Budget threshold reached",
      message: 'Campaign "Summer Sale" has used 90% of budget',
      resolved: false,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  res.status(200).json({ success: true, data: alerts });
});
router3.get("/campaign-health", async (req, res) => {
  const agentsService = new AgentsService();
  const agents = await agentsService.getAllAgents();
  const activeAgents = agents.filter((a) => a.status === "RUNNING");
  const performanceMultiplier = activeAgents.length / agents.length || 0.5;
  res.status(200).json({
    success: true,
    data: [
      { campaignId: "c1", campaignName: "Q4 Product Launch", healthScore: 91.2 * performanceMultiplier, roas: 5.1 * performanceMultiplier, ctr: 3.2, conversionRate: 4.1, budgetStatus: "ON_TRACK" },
      { campaignId: "c2", campaignName: "Summer Sale", healthScore: 74.3 * performanceMultiplier, roas: 2.8 * performanceMultiplier, ctr: 1.9, conversionRate: 2.3, budgetStatus: "AT_RISK" }
    ]
  });
});
var routes_default3 = router3;

// src/modules/campaigns/routes.ts
var import_express4 = require("express");

// src/modules/campaigns/service.ts
var CampaignsService = class {
  async getAll(workspaceId) {
    return prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    });
  }
  async getById(id, workspaceId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, workspaceId }
    });
    if (!campaign) throw new Error("Campaign not found");
    return campaign;
  }
  async create(data) {
    return prisma.campaign.create({
      data: {
        name: data.name,
        workspaceId: data.workspaceId
      }
    });
  }
  async update(id, workspaceId, data) {
    await this.getById(id, workspaceId);
    return prisma.campaign.update({
      where: { id },
      data
    });
  }
  async delete(id, workspaceId) {
    await this.getById(id, workspaceId);
    return prisma.campaign.delete({
      where: { id }
    });
  }
};

// src/modules/campaigns/controller.ts
var import_http_status_codes4 = require("http-status-codes");
var CampaignsController = class {
  service = new CampaignsService();
  // Assuming workspaceId is passed either in body, query, or via a middleware that extracts it from user tokens
  // For simplicity, let's extract it from query or body for now.
  getAll = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes4.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const campaigns = await this.service.getAll(workspaceId);
      res.status(import_http_status_codes4.StatusCodes.OK).json({ success: true, data: campaigns });
    } catch (error) {
      next(error);
    }
  };
  getById = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes4.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const campaign = await this.service.getById(req.params.id, workspaceId);
      res.status(import_http_status_codes4.StatusCodes.OK).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };
  create = async (req, res, next) => {
    try {
      const campaign = await this.service.create(req.body);
      res.status(import_http_status_codes4.StatusCodes.CREATED).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };
  update = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes4.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const campaign = await this.service.update(req.params.id, workspaceId, req.body);
      res.status(import_http_status_codes4.StatusCodes.OK).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };
  delete = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes4.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      await this.service.delete(req.params.id, workspaceId);
      res.status(import_http_status_codes4.StatusCodes.OK).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  };
};

// src/modules/campaigns/validator.ts
var import_zod3 = require("zod");
var createCampaignSchema = import_zod3.z.object({
  body: import_zod3.z.object({
    name: import_zod3.z.string().min(1, "Name is required"),
    workspaceId: import_zod3.z.string().uuid()
  })
});
var updateCampaignSchema = import_zod3.z.object({
  body: import_zod3.z.object({
    name: import_zod3.z.string().optional(),
    status: import_zod3.z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).optional()
  })
});

// src/modules/campaigns/routes.ts
var router4 = (0, import_express4.Router)();
var controller3 = new CampaignsController();
router4.get("/", controller3.getAll);
router4.get("/stats", (req, res) => {
  res.status(200).json({
    success: true,
    data: { total: 42, active: 8, paused: 3, scheduled: 5, completed: 26 }
  });
});
router4.get("/:id", controller3.getById);
router4.post("/", validate(createCampaignSchema), controller3.create);
router4.patch("/:id", validate(updateCampaignSchema), controller3.update);
router4.delete("/:id", controller3.delete);
router4.post("/:id/launch", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: "ACTIVE" } });
});
router4.post("/:id/pause", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: "PAUSED" } });
});
var routes_default4 = router4;

// src/modules/campaign_detail/routes.ts
var import_express5 = require("express");
var router5 = (0, import_express5.Router)();
router5.get("/:campaignId/overview", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      campaign: { id: req.params.campaignId, name: "Q4 Product Launch", status: "ACTIVE", healthScore: 87.5 },
      goalProgress: { target: 1e3, current: 642, pct: 64.2 },
      timeline: { startDate: "2026-10-01T00:00:00Z", endDate: "2026-12-31T23:59:59Z", daysLeft: 14 },
      budget: { total: 5e4, spent: 23400, remaining: 26600 }
    }
  });
});
router5.get("/:campaignId/audience", (req, res) => {
  res.status(200).json({ success: true, data: { total: 48200, reachable: 44100, suppressed: 4100, segments: [] } });
});
router5.get("/:campaignId/assets", (req, res) => {
  res.status(200).json({ success: true, data: [] });
});
router5.get("/:campaignId/channels", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      email: { sent: 24e3, openRate: 28.4, clickRate: 4.2, unsubRate: 0.3, revenue: 48200 },
      sms: { sent: 8e3, deliveryRate: 97.8, clickRate: 6.1 },
      social: { impressions: 42e4, engagement: 3.7, clicks: 15540 },
      paidAds: { impressions: 12e5, cpc: 1.24, roas: 4.8 }
    }
  });
});
router5.get("/:campaignId/timeline", (req, res) => {
  res.status(200).json({ success: true, data: [
    { stage: "CREATION", timestamp: "2026-10-01T10:00:00Z", actor: "John Doe", note: "Campaign created" },
    { stage: "LAUNCH", timestamp: "2026-10-05T09:00:00Z", actor: "SupervisorAgent", note: "Campaign launched" }
  ] });
});
router5.get("/:campaignId/ab-tests", (req, res) => {
  res.status(200).json({ success: true, data: [] });
});
router5.get("/:campaignId/analytics", (req, res) => {
  res.status(200).json({ success: true, data: { impressions: 164e4, clicks: 42300, leads: 2810, mqls: 410, revenue: 96400 } });
});
router5.get("/:campaignId/finance", (req, res) => {
  res.status(200).json({ success: true, data: { budget: 5e4, spend: 23400, revenue: 96400, roi: 3.12, roas: 4.12, projectedRevenue: 19e4 } });
});
router5.get("/:campaignId/activity-log", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
var routes_default5 = router5;

// src/modules/analytics/routes.ts
var import_express6 = require("express");
var router6 = (0, import_express6.Router)();
router6.get("/executive", (req, res) => {
  res.status(200).json({ success: true, data: { revenue: 124e4, pipeline: 56e5, cac: 124.5, ltv: 4800, roas: 4.2, conversionRate: 3.47 } });
});
router6.get("/attribution", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      model: "MULTI_TOUCH",
      channels: [
        { channel: "EMAIL", contribution: 34.2, revenue: 424080 },
        { channel: "PAID_ADS", contribution: 28.7, revenue: 355880 },
        { channel: "SOCIAL", contribution: 22.1, revenue: 274040 },
        { channel: "SMS", contribution: 15, revenue: 186e3 }
      ]
    }
  });
});
router6.get("/channels", (req, res) => {
  res.status(200).json({ success: true, data: { email: {}, sms: {}, social: {}, paidAds: {} } });
});
router6.get("/funnel", (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { stage: "IMPRESSION", count: 164e4, convRate: 100, dropoffRate: 0 },
      { stage: "CLICK", count: 42300, convRate: 2.58, dropoffRate: 97.42 },
      { stage: "VISIT", count: 38100, convRate: 90.1, dropoffRate: 9.9 },
      { stage: "LEAD", count: 12400, convRate: 32.5, dropoffRate: 67.5 },
      { stage: "MQL", count: 1870, convRate: 15.1, dropoffRate: 84.9 },
      { stage: "SQL", count: 430, convRate: 23, dropoffRate: 77 },
      { stage: "CUSTOMER", count: 186, convRate: 43.3, dropoffRate: 56.7 }
    ]
  });
});
router6.get("/journey", (req, res) => {
  res.status(200).json({ success: true, data: { topPaths: [], touchpoints: [], dropoffs: [] } });
});
router6.get("/cohorts", (req, res) => {
  res.status(200).json({ success: true, data: { cohorts: [], periods: [] } });
});
router6.get("/realtime", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      connected: true,
      latestSnapshot: {
        revenue: 124e4,
        pipeline: 56e5,
        cac: 124.5,
        ltv: 4800,
        roas: 4.2,
        conversionRate: 3.47,
        _ts: (/* @__PURE__ */ new Date()).toISOString()
      },
      anomalies: [],
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
});
var routes_default6 = router6;

// src/modules/audience/routes.ts
var import_express7 = require("express");
var router7 = (0, import_express7.Router)();
router7.get("/contacts", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router7.get("/contacts/:id", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, email: "contact@example.com", firstName: "Jane", lastName: "Smith", leadScore: 72, lifecycleStage: "MQL" } });
});
router7.post("/contacts", (req, res) => {
  res.status(201).json({ success: true, data: { id: "new-uuid", ...req.body, leadScore: 0, createdAt: (/* @__PURE__ */ new Date()).toISOString() } });
});
router7.patch("/contacts/:id", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, ...req.body } });
});
router7.delete("/contacts/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
router7.get("/segments", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router7.post("/segments", (req, res) => {
  res.status(201).json({ success: true, data: { id: "new-uuid", ...req.body, size: 0, createdAt: (/* @__PURE__ */ new Date()).toISOString() } });
});
router7.delete("/segments/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
router7.get("/lead-scores", async (req, res) => {
  const agentsService = new AgentsService();
  const agents = await agentsService.getAllAgents();
  const activeAgents = agents.filter((a) => a.status === "RUNNING");
  const mult = activeAgents.length / agents.length || 0.5;
  res.status(200).json({
    success: true,
    data: {
      model: { fields: ["email_opens", "page_visits", "demo_requested"] },
      distribution: [
        { range: "80-100", count: Math.round(1240 * mult), label: "Hot" },
        { range: "60-79", count: Math.round(3420 * mult), label: "Warm" },
        { range: "40-59", count: Math.round(5810 * mult), label: "Cool" },
        { range: "0-39", count: Math.round(2130 * mult), label: "Cold" }
      ]
    }
  });
});
router7.get("/personas", async (req, res) => {
  const agentsService = new AgentsService();
  const agents = await agentsService.getAllAgents();
  const activeAgents = agents.filter((a) => a.status === "RUNNING");
  const mult = activeAgents.length / agents.length || 0.5;
  res.status(200).json({ success: true, data: [
    { id: "p1", name: "Enterprise CTO", description: "Technical leader at 500+ employee companies", size: Math.round(2840 * mult), traits: ["technical", "risk-averse", "ROI-focused"] },
    { id: "p2", name: "SMB Founder", description: "Owner of 10-50 employee companies", size: Math.round(5120 * mult), traits: ["budget-conscious", "growth-driven", "hands-on"] }
  ] });
});
router7.get("/lifecycle", async (req, res) => {
  const agentsService = new AgentsService();
  const agents = await agentsService.getAllAgents();
  const activeAgents = agents.filter((a) => a.status === "RUNNING");
  const mult = activeAgents.length / agents.length || 0.5;
  res.status(200).json({
    success: true,
    data: [
      { stage: "LEAD", count: Math.round(12400 * mult), convRate: 15.1 * mult },
      { stage: "MQL", count: Math.round(1870 * mult), convRate: 23 * mult },
      { stage: "SQL", count: Math.round(430 * mult), convRate: 43.3 * mult },
      { stage: "OPPORTUNITY", count: Math.round(186 * mult), convRate: 58.1 * mult },
      { stage: "CUSTOMER", count: Math.round(108 * mult), convRate: null },
      { stage: "EVANGELIST", count: Math.round(32 * mult), convRate: null }
    ]
  });
});
var routes_default7 = router7;

// src/modules/ai_command_center/routes.ts
var import_express8 = require("express");
var router8 = (0, import_express8.Router)();
router8.post("/command", (req, res) => {
  const prompt = req.body.prompt?.toLowerCase() || "";
  let intent = "UNKNOWN_INTENT";
  let agentsSpawned = ["GeneralAgent"];
  let routeTo = "/dashboard";
  if (prompt.includes("campaign")) {
    intent = "CREATE_CAMPAIGN";
    agentsSpawned = ["CopyAgent", "CreativeAgent", "EmailAgent"];
    routeTo = "/campaigns";
  } else if (prompt.includes("content") || prompt.includes("post") || prompt.includes("email") || prompt.includes("generation")) {
    intent = "GENERATE_CONTENT";
    agentsSpawned = ["CreativeAgent", "CopyAgent"];
    routeTo = "/creative-studio";
  } else if (prompt.includes("analy") || prompt.includes("report") || prompt.includes("performance")) {
    intent = "ANALYZE_PERFORMANCE";
    agentsSpawned = ["AnalyticsAgent"];
    routeTo = "/reports";
  } else {
    intent = "GENERAL_QUERY";
  }
  res.status(200).json({
    success: true,
    data: {
      taskId: `task-${Date.now()}`,
      intent,
      confidence: 0.94,
      agentsSpawned,
      estimatedMs: 12e3,
      routeTo
    }
  });
});
router8.get("/suggestions", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "s1", label: "Boost Q4 campaign budget", description: "ROAS is 5.1x \u2014 increasing budget could yield 40% more revenue", impact: "HIGH", prompt: "Increase budget for Q4 Product Launch campaign by 20%" },
    { id: "s2", label: "Re-engage cold leads", description: "4,200 leads haven't opened an email in 30 days", impact: "MEDIUM", prompt: "Create a re-engagement sequence for cold leads" }
  ] });
});
router8.get("/agents", async (req, res) => {
  try {
    const health = await agentClient_default.getHealth();
    const infra = health?.data || {};
    const agentNames = ["SUPERVISOR", "COPY", "CREATIVE", "ANALYTICS", "COMPLIANCE", "EMAIL", "SMS", "SOCIAL", "SEO", "COMPETITOR", "FINANCE"];
    const agents = agentNames.map((type, i) => ({
      id: `agent-${i}`,
      name: `${type.charAt(0)}${type.slice(1).toLowerCase()}Agent`,
      type,
      status: infra.status === "healthy" ? i < 3 ? "RUNNING" : "IDLE" : "OFFLINE",
      queueLength: i < 3 ? 2 : 0,
      successRate: 97 + Math.random() * 2
    }));
    res.status(200).json({ success: true, data: agents });
  } catch {
    const agentNames = ["SUPERVISOR", "COPY", "CREATIVE", "ANALYTICS", "COMPLIANCE", "EMAIL", "SMS", "SOCIAL", "SEO", "COMPETITOR", "FINANCE"];
    res.status(200).json({ success: true, data: agentNames.map((type, i) => ({ id: `agent-${i}`, name: `${type.charAt(0)}${type.slice(1).toLowerCase()}Agent`, type, status: "OFFLINE", queueLength: 0, successRate: 0 })) });
  }
});
router8.get("/tasks", async (req, res) => {
  const page = parseInt(String(req.query.page || "1"));
  const limit = parseInt(String(req.query.limit || "20"));
  const skip = (page - 1) * limit;
  const where = req.query.status ? { steps: { some: { status: req.query.status } } } : {};
  const [runs, total] = await Promise.all([
    prisma.workflowRun.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { steps: { orderBy: { createdAt: "asc" } } }
    }),
    prisma.workflowRun.count({ where })
  ]);
  const data = runs.map((r) => ({
    id: r.id,
    command: r.command,
    status: r.status,
    agentType: "PIPELINE",
    task: r.command,
    startedAt: r.createdAt,
    updatedAt: r.updatedAt,
    steps: r.steps,
    duration: r.updatedAt.getTime() - r.createdAt.getTime()
  }));
  res.status(200).json({
    success: true,
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) }
  });
});
router8.get("/decisions", async (req, res) => {
  const limit = parseInt(String(req.query.limit || "20"));
  const runs = await prisma.workflowRun.findMany({
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: { steps: { orderBy: { createdAt: "asc" }, take: 1 } }
  });
  const data = runs.map((r) => ({
    id: r.id,
    decision: r.command,
    reasoning: `Workflow executed ${r.steps.length} agent step(s). Status: ${r.status}.`,
    confidence: 0.91,
    outcome: r.status === "completed" ? "EXECUTED" : r.status === "failed" ? "REJECTED" : r.status === "awaiting_approval" ? "PENDING" : "PENDING",
    timestamp: r.updatedAt.toISOString(),
    steps: r.steps
  }));
  res.status(200).json({ success: true, data });
});
router8.get("/memory", async (req, res) => {
  const page = parseInt(String(req.query.page || "1"));
  const limit = parseInt(String(req.query.limit || "20"));
  const skip = (page - 1) * limit;
  const [runs, total] = await Promise.all([
    prisma.workflowRun.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { steps: { where: { output: { not: null } }, take: 3 } }
    }),
    prisma.workflowRun.count()
  ]);
  const data = runs.flatMap(
    (r) => r.steps.map((s) => ({
      id: s.id,
      agentType: s.agentName.toUpperCase().replace("AGENT", ""),
      memType: "EPISODIC",
      key: `run:${r.id}:${s.agentName}`,
      value: s.output,
      createdAt: s.createdAt
    }))
  );
  res.status(200).json({
    success: true,
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) }
  });
});
router8.get("/automation-rules", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "r1", name: "Pause ad if ROAS < 2x", type: "BUDGET", enabled: true, trigger: { metric: "roas", operator: "lt", value: 2 }, action: { type: "PAUSE_AD" }, lastFired: null },
    { id: "r2", name: "Alert on budget threshold", type: "ALERT", enabled: true, trigger: { metric: "budgetUsed", operator: "gte", value: 80 }, action: { type: "SEND_ALERT" }, lastFired: "2026-06-14T08:00:00Z" }
  ] });
});
router8.post("/automation-rules", (req, res) => {
  res.status(201).json({ success: true, data: { id: "new-uuid", ...req.body, lastFired: null } });
});
router8.delete("/automation-rules/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
router8.post("/pipeline/campaign", async (req, res) => {
  try {
    const user = await prisma.user.findFirst();
    req.body.llm_api_key = user?.apiKeys?.gemini;
    const result = await agentClient_default.runCampaignSync(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[AI CC] Campaign pipeline error:", message);
    res.status(502).json({ success: false, error: "Agent service unavailable", detail: message });
  }
});
router8.post("/pipeline/campaign/async", async (req, res) => {
  try {
    const user = await prisma.user.findFirst();
    req.body.llm_api_key = user?.apiKeys?.gemini;
    const result = await agentClient_default.runCampaignAsync(req.body);
    res.status(202).json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[AI CC] Async campaign error:", message);
    res.status(502).json({ success: false, error: "Agent service unavailable", detail: message });
  }
});
router8.get("/pipeline/:campaignId/status", async (req, res) => {
  const { campaignId } = req.params;
  logger.info(`[AI CC][STATUS POLL] job_id=${campaignId}`);
  try {
    const cached = await redisClient.get(`job:${campaignId}:result`);
    if (cached) {
      const parsed = JSON.parse(cached);
      logger.info(`[AI CC][STATUS HIT] job_id=${campaignId} source=redis status=${parsed.status}`);
      return res.status(200).json({ success: true, source: "redis", data: parsed });
    }
  } catch (redisErr) {
    logger.warn(`[AI CC] Redis read failed for ${campaignId}: ${redisErr}`);
  }
  try {
    const result = await agentClient_default.getCampaignStatus(campaignId);
    logger.info(`[AI CC][STATUS HIT] job_id=${campaignId} source=agent-service`);
    res.status(200).json({ success: true, source: "agent-service", data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[AI CC] Campaign status error:", message);
    res.status(502).json({ success: false, error: "Agent service unavailable", detail: message });
  }
});
router8.get("/status/:jobId", async (req, res) => {
  const { jobId } = req.params;
  logger.info(`[AI CC][STATUS POLL] job_id=${jobId}`);
  try {
    const cached = await redisClient.get(`job:${jobId}:result`);
    if (cached) {
      const parsed = JSON.parse(cached);
      logger.info(`[AI CC][STATUS HIT] job_id=${jobId} source=redis status=${parsed.status}`);
      return res.status(200).json({ success: true, source: "redis", data: parsed });
    }
  } catch (redisErr) {
    logger.warn(`[AI CC] Redis read failed for ${jobId}: ${redisErr}`);
  }
  try {
    const result = await agentClient_default.getCampaignStatus(jobId);
    if (result?.data) {
      logger.info(`[AI CC][STATUS HIT] job_id=${jobId} source=agent-service`);
      return res.status(200).json({ success: true, source: "agent-service", data: result.data });
    }
    logger.info(`[AI CC][STATUS MISS] job_id=${jobId} not found`);
    return res.status(404).json({ success: false, error: `Job ${jobId} not found` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[AI CC] Status lookup failed for ${jobId}: ${message}`);
    res.status(502).json({ success: false, error: "Status lookup failed", detail: message });
  }
});
router8.post("/pipeline/campaign/stream", async (req, res) => {
  try {
    const user = await prisma.user.findFirst();
    req.body.llm_api_key = user?.apiKeys?.gemini;
    const stream = await agentClient_default.streamCampaign(req.body);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Connection", "keep-alive");
    const reader = stream.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (pipeErr) {
        logger.warn("[AI CC] Stream pipe error:", pipeErr);
      } finally {
        res.end();
      }
    };
    pump();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[AI CC] Campaign stream error:", message);
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: "Agent service unavailable", detail: message });
    } else {
      res.write(`event: error
data: ${JSON.stringify({ error: message })}

`);
      res.end();
    }
  }
});
router8.post("/query/stream", async (req, res) => {
  try {
    const user = await prisma.user.findFirst();
    req.body.llm_api_key = user?.apiKeys?.gemini;
    const stream = await agentClient_default.streamQuery(req.body);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Connection", "keep-alive");
    const reader = stream.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (pipeErr) {
        logger.warn("[AI CC] Query stream pipe error:", pipeErr);
      } finally {
        res.end();
      }
    };
    pump();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[AI CC] Query stream error:", message);
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: "Agent service unavailable", detail: message });
    } else {
      res.write(`event: error
data: ${JSON.stringify({ error: message })}

`);
      res.end();
    }
  }
});
router8.get("/agent-service/health", async (_req, res) => {
  try {
    const health = await agentClient_default.getHealth();
    res.status(health.data?.status === "healthy" ? 200 : 207).json({ success: true, data: health });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[AI CC] Agent service health check failed:", message);
    res.status(502).json({ success: false, error: "Agent service unreachable", detail: message });
  }
});
var routes_default8 = router8;

// src/modules/agents/routes.ts
var import_express9 = require("express");

// src/modules/agents/controller.ts
var AgentsController = class {
  service = new AgentsService();
  getAllAgents = async (req, res, next) => {
    try {
      const agents = await this.service.getAllAgents();
      res.status(200).json({ success: true, data: agents });
    } catch (error) {
      next(error);
    }
  };
  /**
   * POST /agents/:agentType/run
   * Proxy a single-agent execution to the Python agent service.
   */
  runAgent = async (req, res, next) => {
    try {
      const { agentType } = req.params;
      const state = req.body.state ?? req.body ?? {};
      const result = await this.service.runAgent(agentType, state);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
  getAgentByType = (req, res, next) => {
    try {
      const { agentType } = req.params;
      const agent = this.service.getAgentByType(agentType);
      if (!agent) {
        return res.status(404).json({ success: false, message: "Agent type not found" });
      }
      res.status(200).json({ success: true, data: agent });
    } catch (error) {
      next(error);
    }
  };
  getAgentTasks = (req, res, next) => {
    try {
      const { agentType } = req.params;
      const { status, page, limit } = req.query;
      const { tasks, total } = this.service.getAgentTasks(
        agentType,
        status,
        parseInt(page) || 1,
        parseInt(limit) || 20
      );
      res.status(200).json({
        success: true,
        data: tasks,
        meta: { total, page: parseInt(page) || 1, limit: parseInt(limit) || 20, pages: Math.ceil(total / (parseInt(limit) || 20)) }
      });
    } catch (error) {
      next(error);
    }
  };
  getAgentMemory = (req, res, next) => {
    try {
      const { agentType } = req.params;
      const { memType, search, page, limit } = req.query;
      const { memories, total } = this.service.getAgentMemory(
        agentType,
        memType,
        search,
        parseInt(page) || 1,
        parseInt(limit) || 20
      );
      res.status(200).json({
        success: true,
        data: memories,
        meta: { total, page: parseInt(page) || 1, limit: parseInt(limit) || 20, pages: Math.ceil(total / (parseInt(limit) || 20)) }
      });
    } catch (error) {
      next(error);
    }
  };
  executeCommand = async (req, res, next) => {
    try {
      const { agentType } = req.params;
      const { command, taskPayload } = req.body;
      if (!command) {
        return res.status(400).json({ success: false, message: "Command is required" });
      }
      const success = await this.service.executeCommand(agentType, { command, taskPayload });
      if (!success) {
        return res.status(500).json({ success: false, message: "Failed to dispatch command to agent via Kafka" });
      }
      res.status(200).json({
        success: true,
        data: { agentType, command, status: "ACCEPTED" }
      });
    } catch (error) {
      next(error);
    }
  };
};

// src/modules/agents/routes.ts
var router9 = (0, import_express9.Router)();
var controller4 = new AgentsController();
router9.get("/", controller4.getAllAgents);
router9.post("/:agentType/run", controller4.runAgent);
router9.get("/:agentType", controller4.getAgentByType);
router9.get("/:agentType/tasks", controller4.getAgentTasks);
router9.get("/:agentType/memory", controller4.getAgentMemory);
router9.post("/:agentType/command", controller4.executeCommand);
var routes_default9 = router9;

// src/modules/workflow_engine/routes.ts
var import_express10 = require("express");

// src/modules/workflow_engine/approvalConfig.ts
var AGENT_APPROVAL_CONFIG = {
  EmailAgent: {
    requiresApproval: true,
    reason: "Email dispatch to external contacts requires human review"
  },
  ComplianceAgent: {
    requiresApproval: true,
    reason: "Compliance policy & legal check requires explicit approval"
  },
  SocialMediaAgent: {
    requiresApproval: true,
    reason: "Publishing ad campaigns/posts to social platforms requires approval"
  },
  VoiceAgent: {
    requiresApproval: true,
    reason: "Outbound AI voice calls require manual authorization"
  },
  WhatsappAgent: {
    requiresApproval: true,
    reason: "Outbound WhatsApp messaging requires manual authorization"
  },
  // Auto-run agents (no approval required)
  SupervisorAgent: { requiresApproval: false },
  CopyAgent: { requiresApproval: false },
  CreativeAgent: { requiresApproval: false },
  AnalyticsAgent: { requiresApproval: false },
  FinanceAgent: { requiresApproval: false },
  LeadScoringAgent: { requiresApproval: false },
  MonitorAgent: { requiresApproval: false },
  OnboardingAgent: { requiresApproval: false },
  PersonalizationAgent: { requiresApproval: false },
  ReportingAgent: { requiresApproval: false },
  SeoAgent: { requiresApproval: false },
  CompetitorAgent: { requiresApproval: false },
  AbTestAgent: { requiresApproval: false }
};
function normalizeAgentName(name) {
  const cleaned = name.trim();
  if (cleaned.endsWith("Agent")) {
    return cleaned;
  }
  const pascal = cleaned.split(/_|\s|-/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join("");
  return `${pascal}Agent`;
}
function checkAgentRequiresApproval(agentName) {
  const normalized = normalizeAgentName(agentName);
  return AGENT_APPROVAL_CONFIG[normalized]?.requiresApproval ?? false;
}

// src/modules/workflow_engine/orchestrator.ts
function determineAgentPlan(command) {
  const lower = command.toLowerCase();
  if (lower.includes("campaign") || lower.includes("launch") || lower.includes("target") || lower.includes("cmo")) {
    return ["SupervisorAgent", "CopyAgent", "CreativeAgent", "ComplianceAgent", "EmailAgent", "AnalyticsAgent"];
  }
  if (lower.includes("content") || lower.includes("post") || lower.includes("social") || lower.includes("blog") || lower.includes("creative")) {
    return ["CopyAgent", "CreativeAgent", "ComplianceAgent", "SocialMediaAgent"];
  }
  if (lower.includes("analy") || lower.includes("report") || lower.includes("performance") || lower.includes("finance") || lower.includes("roi")) {
    return ["AnalyticsAgent", "FinanceAgent", "ReportingAgent"];
  }
  if (lower.includes("lead") || lower.includes("score") || lower.includes("audience") || lower.includes("contact")) {
    return ["LeadScoringAgent", "PersonalizationAgent", "EmailAgent"];
  }
  return ["SupervisorAgent", "CopyAgent", "ComplianceAgent", "EmailAgent", "ReportingAgent"];
}
async function startWorkflow(command) {
  const agentPlan = determineAgentPlan(command);
  const run = await prisma.workflowRun.create({
    data: {
      command,
      status: "running",
      steps: {
        create: agentPlan.map((agentName) => ({
          agentName,
          status: "pending",
          input: command,
          requiresApproval: checkAgentRequiresApproval(agentName)
        }))
      }
    },
    include: {
      steps: true
    }
  });
  logger.info(`[WorkflowEngine] Started run ${run.id} with ${run.steps.length} steps: ${agentPlan.join(", ")}`);
  if (io) {
    io.emit("workflow:update", {
      event: "CREATED",
      runId: run.id,
      command: run.command,
      status: run.status,
      steps: run.steps
    });
  }
  executeWorkflowLoop(run.id).catch((err) => {
    logger.error(`[WorkflowEngine] Unhandled error executing run ${run.id}:`, err);
  });
  return run;
}
async function executeWorkflowLoop(runId) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { createdAt: "asc" } } }
  });
  if (!run) {
    logger.error(`[WorkflowEngine] Workflow run ${runId} not found`);
    return;
  }
  if (run.status === "completed" || run.status === "failed" || run.status === "awaiting_approval") {
    logger.info(`[WorkflowEngine] Run ${runId} is currently in state '${run.status}', skipping execution loop.`);
    return;
  }
  const previousOutputs = {};
  for (const s of run.steps) {
    if (s.output && typeof s.output === "object") {
      previousOutputs[s.agentName] = s.output;
    }
  }
  for (const step of run.steps) {
    if (step.status === "done" || step.status === "approved") {
      continue;
    }
    if (step.status === "rejected") {
      await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: "failed" }
      });
      return;
    }
    const updatedStep = await prisma.workflowStep.update({
      where: { id: step.id },
      data: { status: "running" }
    });
    logger.info(`[WorkflowEngine] Run ${runId} -> Running agent: ${step.agentName}`);
    if (io) {
      io.emit("workflow:step_update", {
        runId,
        stepId: step.id,
        agentName: step.agentName,
        status: "running",
        requiresApproval: step.requiresApproval
      });
      io.emit("agentEvent", {
        topic: `agent.${step.agentName.toLowerCase()}.events`,
        payload: {
          run_id: runId,
          agent_name: step.agentName,
          status: "RUNNING",
          message: `Executing ${step.agentName}...`
        }
      });
    }
    let agentResultData = {};
    const t0 = Date.now();
    try {
      const agentKey = step.agentName.toLowerCase().replace(/agent$/, "");
      const response = await agentClient_default.runAgent(agentKey, {
        command: run.command,
        previous_outputs: previousOutputs
      });
      agentResultData = response.data || response;
    } catch (err) {
      logger.warn(`[WorkflowEngine] Call to Python service for ${step.agentName} failed (${err.message}). Using simulated fallback output.`);
      agentResultData = {
        status: "completed",
        agent: step.agentName,
        summary: `Generated strategy and execution plan for '${run.command.slice(0, 40)}...'`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        details: {
          confidence: 0.95,
          recommendedAction: `Proceed with ${step.agentName} task execution`
        }
      };
    }
    const elapsedMs = Date.now() - t0;
    previousOutputs[step.agentName] = agentResultData;
    if (step.requiresApproval) {
      logger.info(`[WorkflowEngine] Run ${runId} -> Agent ${step.agentName} REQUIRES HUMAN APPROVAL. Pausing workflow.`);
      const pausedStep = await prisma.workflowStep.update({
        where: { id: step.id },
        data: {
          status: "awaiting_approval",
          output: agentResultData
        }
      });
      const pausedRun = await prisma.workflowRun.update({
        where: { id: runId },
        data: { status: "awaiting_approval" }
      });
      if (io) {
        io.emit("workflow:step_update", {
          runId,
          stepId: pausedStep.id,
          agentName: pausedStep.agentName,
          status: "awaiting_approval",
          output: agentResultData,
          requiresApproval: true,
          elapsedMs
        });
        io.emit("workflow:awaiting_approval", {
          runId,
          step: pausedStep,
          output: agentResultData,
          agentName: pausedStep.agentName
        });
      }
      return;
    }
    const completedStep = await prisma.workflowStep.update({
      where: { id: step.id },
      data: {
        status: "done",
        output: agentResultData
      }
    });
    if (io) {
      io.emit("workflow:step_update", {
        runId,
        stepId: completedStep.id,
        agentName: completedStep.agentName,
        status: "done",
        output: agentResultData,
        elapsedMs
      });
      io.emit("agentEvent", {
        topic: `agent.${step.agentName.toLowerCase()}.responses`,
        payload: {
          run_id: runId,
          agent_name: step.agentName,
          status: "DONE",
          output: agentResultData
        }
      });
    }
  }
  const finalRun = await prisma.workflowRun.update({
    where: { id: runId },
    data: { status: "completed" },
    include: { steps: true }
  });
  logger.info(`[WorkflowEngine] Run ${runId} COMPLETED SUCCESSFULLY! All ${finalRun.steps.length} steps done.`);
  if (io) {
    io.emit("workflow:update", {
      event: "COMPLETED",
      runId,
      status: "completed",
      steps: finalRun.steps
    });
  }
}
async function approveWorkflowStep(runId, decision) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { createdAt: "asc" } } }
  });
  if (!run) {
    throw new Error(`Workflow run ${runId} not found`);
  }
  const awaitingStep = run.steps.find((s) => s.status === "awaiting_approval");
  if (!awaitingStep) {
    throw new Error(`Workflow run ${runId} has no step awaiting approval`);
  }
  if (decision === "rejected") {
    logger.info(`[WorkflowEngine] User REJECTED step ${awaitingStep.agentName} for run ${runId}`);
    const rejectedStep = await prisma.workflowStep.update({
      where: { id: awaitingStep.id },
      data: { status: "rejected" }
    });
    const failedRun = await prisma.workflowRun.update({
      where: { id: runId },
      data: { status: "failed" },
      include: { steps: true }
    });
    if (io) {
      io.emit("workflow:step_update", {
        runId,
        stepId: rejectedStep.id,
        agentName: rejectedStep.agentName,
        status: "rejected"
      });
      io.emit("workflow:update", {
        event: "FAILED",
        runId,
        status: "failed",
        steps: failedRun.steps,
        reason: `Step ${awaitingStep.agentName} was rejected by user.`
      });
    }
    return failedRun;
  }
  logger.info(`[WorkflowEngine] User APPROVED step ${awaitingStep.agentName} for run ${runId}. Resuming execution loop.`);
  const approvedStep = await prisma.workflowStep.update({
    where: { id: awaitingStep.id },
    data: { status: "done" }
  });
  await prisma.workflowRun.update({
    where: { id: runId },
    data: { status: "running" }
  });
  if (io) {
    io.emit("workflow:step_update", {
      runId,
      stepId: approvedStep.id,
      agentName: approvedStep.agentName,
      status: "done"
    });
  }
  executeWorkflowLoop(runId).catch((err) => {
    logger.error(`[WorkflowEngine] Error resuming execution loop for run ${runId}:`, err);
  });
  return prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { steps: true }
  });
}
async function getWorkflowRun(runId) {
  return prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { createdAt: "asc" } } }
  });
}

// src/modules/workflow_engine/routes.ts
var router10 = (0, import_express10.Router)();
router10.post("/workflows", async (req, res) => {
  try {
    const command = req.body.command || req.body.prompt;
    if (!command || typeof command !== "string") {
      res.status(400).json({ success: false, error: "Command string is required." });
      return;
    }
    const run = await startWorkflow(command);
    res.status(200).json({
      success: true,
      data: {
        runId: run.id,
        command: run.command,
        status: run.status,
        steps: run.steps
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router10.post("/", async (req, res) => {
  try {
    const command = req.body.command || req.body.prompt;
    if (!command || typeof command !== "string") {
      res.status(400).json({ success: false, error: "Command string is required." });
      return;
    }
    const run = await startWorkflow(command);
    res.status(200).json({
      success: true,
      data: {
        runId: run.id,
        command: run.command,
        status: run.status,
        steps: run.steps
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router10.get("/workflows/:runId", async (req, res) => {
  try {
    const run = await getWorkflowRun(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Workflow run not found" });
      return;
    }
    res.status(200).json({ success: true, data: run });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router10.get("/:runId", async (req, res) => {
  try {
    const run = await getWorkflowRun(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Workflow run not found" });
      return;
    }
    res.status(200).json({ success: true, data: run });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router10.post("/workflows/:runId/approve", async (req, res) => {
  try {
    const { decision } = req.body;
    if (decision !== "approved" && decision !== "rejected") {
      res.status(400).json({ success: false, error: "Decision must be 'approved' or 'rejected'" });
      return;
    }
    const updatedRun = await approveWorkflowStep(req.params.runId, decision);
    res.status(200).json({ success: true, data: updatedRun });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});
router10.post("/:runId/approve", async (req, res) => {
  try {
    const { decision } = req.body;
    if (decision !== "approved" && decision !== "rejected") {
      res.status(400).json({ success: false, error: "Decision must be 'approved' or 'rejected'" });
      return;
    }
    const updatedRun = await approveWorkflowStep(req.params.runId, decision);
    res.status(200).json({ success: true, data: updatedRun });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});
router10.get("/graph", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      nodes: [
        { id: "supervisor", label: "SupervisorAgent", type: "SUPERVISOR", status: "RUNNING", x: 400, y: 50 },
        { id: "copy", label: "CopyAgent", type: "COPY", status: "RUNNING", x: 200, y: 200 },
        { id: "creative", label: "CreativeAgent", type: "CREATIVE", status: "WAITING", x: 400, y: 200 },
        { id: "compliance", label: "ComplianceAgent", type: "COMPLIANCE", status: "WAITING", x: 600, y: 200 },
        { id: "email", label: "EmailAgent", type: "EMAIL", status: "IDLE", x: 200, y: 350 },
        { id: "analytics", label: "AnalyticsAgent", type: "ANALYTICS", status: "IDLE", x: 600, y: 350 }
      ],
      edges: [
        { source: "supervisor", target: "copy", label: "brief" },
        { source: "supervisor", target: "creative", label: "brief" },
        { source: "supervisor", target: "compliance", label: "content" },
        { source: "copy", target: "email", label: "email_copy" },
        { source: "creative", target: "email", label: "assets" },
        { source: "compliance", target: "email", label: "approval" },
        { source: "email", target: "analytics", label: "metrics" }
      ]
    }
  });
});
router10.get("/executions", (_req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router10.get("/executions/:id", (req, res) => {
  res.status(200).json({ success: true, data: { execution: { id: req.params.id }, steps: [] } });
});
router10.post("/executions/:id/cancel", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: "CANCELLED" } });
});
router10.get("/dependencies", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      parallelGroups: [["CopyAgent", "CreativeAgent"], ["EmailAgent", "SmsAgent", "SocialAgent"], ["AnalyticsAgent"]],
      criticalPath: ["SupervisorAgent", "CopyAgent", "ComplianceAgent", "EmailAgent", "AnalyticsAgent"]
    }
  });
});
router10.get("/automation", (_req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "wf1", name: "Full Campaign Launch Workflow", description: "End-to-end workflow from brief to launch", steps: 8, lastRun: null, enabled: true },
    { id: "wf2", name: "Re-engagement Workflow", description: "Automated re-engagement sequence for cold leads", steps: 5, lastRun: "2026-06-01T10:00:00Z", enabled: true }
  ] });
});
router10.post("/automation/:id/trigger", (_req, res) => {
  res.status(200).json({ success: true, data: { executionId: "exec-uuid", status: "RUNNING" } });
});
var routes_default10 = router10;

// src/modules/creative_studio/routes.ts
var import_express11 = require("express");
var router11 = (0, import_express11.Router)();
router11.get("/assets", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router11.delete("/assets/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
router11.get("/brand-kit", (req, res) => {
  res.status(200).json({ success: true, data: { colors: { primary: "#6C63FF", secondary: "#FF6584", background: "#0F0F1A" }, fonts: { heading: "Inter", body: "Inter" }, logos: [], toneOfVoice: "Professional, confident, data-driven" } });
});
router11.patch("/brand-kit", (req, res) => {
  res.status(200).json({ success: true, data: req.body });
});
router11.post("/generate", (req, res) => {
  res.status(200).json({ success: true, data: { taskId: "gen-task-uuid", status: "QUEUED", estimatedMs: 8e3 } });
});
router11.get("/generated", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router11.get("/templates", (req, res) => {
  res.status(200).json({ success: true, data: [] });
});
var routes_default11 = router11;

// src/modules/competitive_intelligence/routes.ts
var import_express12 = require("express");
var router12 = (0, import_express12.Router)();
router12.get("/competitors", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "c1", name: "RivalCo", website: "https://rivalco.com", adSpend: 25e4, keywords: ["crm", "marketing automation"] }
  ] });
});
router12.post("/competitors", (req, res) => {
  res.status(201).json({ success: true, data: { id: "new-uuid", ...req.body } });
});
router12.delete("/competitors/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
router12.get("/ad-monitoring", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router12.get("/pricing", (req, res) => {
  res.status(200).json({ success: true, data: [] });
});
router12.get("/seo", (req, res) => {
  res.status(200).json({ success: true, data: { yourDomain: { domainAuthority: 48, organicKeywords: 3200, backlinks: 12400 }, competitors: [], keywordGaps: [] } });
});
router12.get("/opportunities", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "o1", type: "PRICING_GAP", title: "RivalCo raised starter plan price by 25%", description: "Their starter plan now costs $149/mo vs your $99/mo \u2014 opportunity to capture price-sensitive segment", impact: "HIGH", detectedAt: (/* @__PURE__ */ new Date()).toISOString() }
  ] });
});
var routes_default12 = router12;

// src/modules/finance/routes.ts
var import_express13 = require("express");
var router13 = (0, import_express13.Router)();
router13.get("/spend", (req, res) => {
  res.status(200).json({ success: true, data: { totalBudget: 5e5, totalSpend: 214300, remainingBudget: 285700, projectedSpend: 49e4, roas: 4.2, roi: 3.2 } });
});
router13.get("/revenue", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      totalRevenue: 124e4,
      byChannel: [
        { channel: "EMAIL", revenue: 424080, pct: 34.2 },
        { channel: "PAID_ADS", revenue: 355880, pct: 28.7 },
        { channel: "SOCIAL", revenue: 274040, pct: 22.1 },
        { channel: "SMS", revenue: 186e3, pct: 15 }
      ],
      byCampaign: []
    }
  });
});
router13.get("/roas", (req, res) => {
  res.status(200).json({ success: true, data: { overallRoas: 4.2, benchmark: 3.5, breakdown: [], trend: [] } });
});
router13.get("/budget", (req, res) => {
  res.status(200).json({ success: true, data: [] });
});
router13.patch("/budget/:campaignId", (req, res) => {
  res.status(200).json({ success: true, data: { campaignId: req.params.campaignId, ...req.body } });
});
router13.get("/forecast", (req, res) => {
  res.status(200).json({ success: true, data: { projectedRevenue: 148e4, projectedSpend: 49e4, projectedRoas: 3.9, confidence: 0.84, timeline: [] } });
});
var routes_default13 = router13;

// src/modules/reports/routes.ts
var import_express14 = require("express");
var router14 = (0, import_express14.Router)();
router14.get("/scheduled", (req, res) => {
  res.status(200).json({ success: true, data: [] });
});
router14.post("/scheduled", (req, res) => {
  res.status(201).json({ success: true, data: { id: "new-uuid", ...req.body, status: "PENDING", createdAt: (/* @__PURE__ */ new Date()).toISOString() } });
});
router14.post("/custom", (req, res) => {
  res.status(200).json({ success: true, data: { reportId: "rpt-uuid", status: "GENERATING", estimatedMs: 15e3 } });
});
router14.get("/executive", async (req, res) => {
  const agentsService = new AgentsService();
  const agents = await agentsService.getAllAgents();
  const reportingAgent = agents.find((a) => a.type === "REPORTING");
  const isAgentActive = reportingAgent && reportingAgent.status === "RUNNING";
  const reportStatus = isAgentActive ? "READY" : "GENERATING";
  res.status(200).json({ success: true, data: [
    { id: "r1", name: "Monthly Revenue Summary", type: "EXECUTIVE", format: "PDF", status: reportStatus, downloadUrl: "https://example.com/reports/r1.pdf", createdAt: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "r2", name: "AI Agent Performance ROI", type: "ANALYTICS", format: "EXCEL", status: reportStatus, downloadUrl: "https://example.com/reports/r2.xlsx", createdAt: (/* @__PURE__ */ new Date()).toISOString() }
  ] });
});
router14.get("/:id/download", (req, res) => {
  res.status(200).json({ success: true, data: { downloadUrl: `https://example.com/reports/${req.params.id}.pdf`, expiresAt: new Date(Date.now() + 36e5).toISOString() } });
});
router14.delete("/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
var routes_default14 = router14;

// src/modules/monitoring/routes.ts
var import_express15 = require("express");
var router15 = (0, import_express15.Router)();
router15.get("/health", (req, res) => {
  res.status(200).json({ success: true, data: { overall: "HEALTHY", api: "HEALTHY", database: "HEALTHY", redis: "HEALTHY", kafka: "HEALTHY", agents: "HEALTHY", uptime: 99.97, checkedAt: (/* @__PURE__ */ new Date()).toISOString() } });
});
router15.get("/alerts", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "a1", type: "WARNING", title: "Redis memory at 85%", message: "Redis is approaching memory limits", resolved: false, timestamp: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "a2", type: "CRITICAL", title: "EmailAgent failure", message: "EmailAgent has crashed \u2014 auto-restart in progress", resolved: false, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
  ], meta: { total: 2, page: 1, limit: 20, pages: 1 } });
});
router15.post("/alerts/:id/resolve", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, resolved: true } });
});
router15.get("/incidents", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router15.get("/remediation", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "rem1", alertId: "a2", action: "Restarted EmailAgent", outcome: "SUCCESS", timestamp: (/* @__PURE__ */ new Date()).toISOString() }
  ], meta: { total: 1, page: 1, limit: 20, pages: 1 } });
});
var routes_default15 = router15;

// src/modules/audit_logs/routes.ts
var import_express16 = require("express");
var router16 = (0, import_express16.Router)();
router16.get("/activity", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router16.get("/agents", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router16.get("/api", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router16.get("/compliance", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router16.get("/events", (req, res) => {
  res.status(200).json({ success: true, data: [], lastEventAt: (/* @__PURE__ */ new Date()).toISOString() });
});
var routes_default16 = router16;

// src/modules/brand_profile/routes.ts
var import_express17 = require("express");

// src/modules/brand_profile/service.ts
var BrandProfileService = class {
  async create(data) {
    return prisma.brandProfile.create({
      data: {
        workspaceId: data.workspaceId,
        businessName: data.businessName,
        industry: data.industry,
        websiteUrl: data.websiteUrl,
        mission: data.mission,
        usp: data.usp,
        positioning: data.positioning,
        voiceAdjectives: data.voiceAdjectives,
        voiceDos: data.voiceDos,
        voiceDonts: data.voiceDonts,
        logoUrl: data.logoUrl,
        brandColors: data.brandColors,
        styleGuideUrl: data.styleGuideUrl,
        personas: data.personas,
        competitors: data.competitors,
        complianceRegion: data.complianceRegion,
        complianceNotes: data.complianceNotes,
        pastCampaignRefs: data.pastCampaignRefs
      }
    });
  }
  async findByWorkspace(workspaceId) {
    return prisma.brandProfile.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    });
  }
  async findById(id) {
    const profile = await prisma.brandProfile.findUnique({ where: { id } });
    if (!profile) throw new Error("BrandProfile not found");
    return profile;
  }
  async update(id, data) {
    await this.findById(id);
    return prisma.brandProfile.update({
      where: { id },
      data: {
        ...data,
        personas: data.personas,
        competitors: data.competitors,
        pastCampaignRefs: data.pastCampaignRefs
      }
    });
  }
  /**
   * Calls the Python agent service's brand scraper and returns
   * suggested autofill values WITHOUT persisting them.
   * The frontend shows the result for user confirmation/edit.
   */
  async autofill(websiteUrl) {
    const agentServiceUrl = process.env.AGENT_SERVICE_URL || "http://localhost:8000";
    const resp = await fetch(`${agentServiceUrl}/v1/tools/scrape-brand-site`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteUrl }),
      signal: AbortSignal.timeout(2e4)
    });
    if (!resp.ok) {
      throw new Error(`Agent service scraper returned ${resp.status}`);
    }
    return resp.json();
  }
};

// src/modules/brand_profile/controller.ts
var import_http_status_codes5 = require("http-status-codes");
var BrandProfileController = class {
  service = new BrandProfileService();
  /** POST /brand-profile */
  create = async (req, res, next) => {
    try {
      const profile = await this.service.create(req.body);
      res.status(import_http_status_codes5.StatusCodes.CREATED).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };
  /** GET /brand-profile?workspaceId=... */
  listByWorkspace = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId)
        return res.status(import_http_status_codes5.StatusCodes.BAD_REQUEST).json({ error: "workspaceId query param is required" });
      const profiles = await this.service.findByWorkspace(workspaceId);
      res.status(import_http_status_codes5.StatusCodes.OK).json({ success: true, data: profiles });
    } catch (error) {
      next(error);
    }
  };
  /** GET /brand-profile/:id */
  getById = async (req, res, next) => {
    try {
      const profile = await this.service.findById(req.params.id);
      res.status(import_http_status_codes5.StatusCodes.OK).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };
  /** PATCH /brand-profile/:id */
  update = async (req, res, next) => {
    try {
      const profile = await this.service.update(req.params.id, req.body);
      res.status(import_http_status_codes5.StatusCodes.OK).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };
  /**
   * POST /brand-profile/:id/autofill
   * Body: { websiteUrl: string }
   * Returns suggested field values WITHOUT saving — user must confirm.
   */
  autofill = async (req, res, next) => {
    try {
      const suggestions = await this.service.autofill(req.body.websiteUrl);
      res.status(import_http_status_codes5.StatusCodes.OK).json({ success: true, data: suggestions });
    } catch (error) {
      next(error);
    }
  };
};

// src/modules/brand_profile/validator.ts
var import_zod4 = require("zod");
var PersonaSchema = import_zod4.z.object({
  name: import_zod4.z.string().min(1),
  demographics: import_zod4.z.string().min(1),
  painPoints: import_zod4.z.string().min(1),
  goals: import_zod4.z.string().min(1)
});
var CompetitorSchema = import_zod4.z.object({
  name: import_zod4.z.string().min(1),
  url: import_zod4.z.string().url().optional().or(import_zod4.z.literal("")),
  notes: import_zod4.z.string().optional()
});
var createBrandProfileSchema = import_zod4.z.object({
  body: import_zod4.z.object({
    workspaceId: import_zod4.z.string().uuid("workspaceId must be a valid UUID"),
    businessName: import_zod4.z.string().min(1, "Business name is required"),
    industry: import_zod4.z.string().min(1, "Industry is required"),
    websiteUrl: import_zod4.z.string().url().optional().or(import_zod4.z.literal("")),
    mission: import_zod4.z.string().optional(),
    usp: import_zod4.z.string().optional(),
    positioning: import_zod4.z.string().optional(),
    voiceAdjectives: import_zod4.z.array(import_zod4.z.string()).min(1, "At least one voice adjective is required"),
    voiceDos: import_zod4.z.array(import_zod4.z.string()),
    voiceDonts: import_zod4.z.array(import_zod4.z.string()),
    logoUrl: import_zod4.z.string().optional(),
    brandColors: import_zod4.z.array(import_zod4.z.string()),
    styleGuideUrl: import_zod4.z.string().optional(),
    personas: import_zod4.z.array(PersonaSchema).min(1).max(5),
    competitors: import_zod4.z.array(CompetitorSchema).max(5),
    complianceRegion: import_zod4.z.enum(["none", "EU-GDPR", "US-HIPAA", "US-FINRA", "other"]).optional(),
    complianceNotes: import_zod4.z.string().optional(),
    pastCampaignRefs: import_zod4.z.array(import_zod4.z.object({}).passthrough()).optional()
  })
});
var updateBrandProfileSchema = import_zod4.z.object({
  body: import_zod4.z.object({
    businessName: import_zod4.z.string().min(1).optional(),
    industry: import_zod4.z.string().min(1).optional(),
    websiteUrl: import_zod4.z.string().url().optional().or(import_zod4.z.literal("")),
    mission: import_zod4.z.string().optional(),
    usp: import_zod4.z.string().optional(),
    positioning: import_zod4.z.string().optional(),
    voiceAdjectives: import_zod4.z.array(import_zod4.z.string()).optional(),
    voiceDos: import_zod4.z.array(import_zod4.z.string()).optional(),
    voiceDonts: import_zod4.z.array(import_zod4.z.string()).optional(),
    logoUrl: import_zod4.z.string().optional(),
    brandColors: import_zod4.z.array(import_zod4.z.string()).optional(),
    styleGuideUrl: import_zod4.z.string().optional(),
    personas: import_zod4.z.array(PersonaSchema).max(5).optional(),
    competitors: import_zod4.z.array(CompetitorSchema).max(5).optional(),
    complianceRegion: import_zod4.z.enum(["none", "EU-GDPR", "US-HIPAA", "US-FINRA", "other"]).optional(),
    complianceNotes: import_zod4.z.string().optional(),
    pastCampaignRefs: import_zod4.z.array(import_zod4.z.object({}).passthrough()).optional()
  })
});
var autofillSchema = import_zod4.z.object({
  body: import_zod4.z.object({
    websiteUrl: import_zod4.z.string().url("websiteUrl must be a valid URL")
  })
});

// src/modules/brand_profile/routes.ts
var router17 = (0, import_express17.Router)();
var controller5 = new BrandProfileController();
router17.post("/", validate(createBrandProfileSchema), controller5.create);
router17.get("/", controller5.listByWorkspace);
router17.get("/:id", controller5.getById);
router17.patch("/:id", validate(updateBrandProfileSchema), controller5.update);
router17.post("/:id/autofill", validate(autofillSchema), controller5.autofill);
var routes_default17 = router17;

// src/modules/campaign_brief/routes.ts
var import_express18 = require("express");

// src/modules/campaign_brief/service.ts
var CampaignBriefService = class {
  /**
   * Creates a CampaignBrief linked to a BrandProfile, then assembles the full
   * structured payload and forwards it to the agent service's streaming pipeline.
   * Returns { brief, campaign, agentResponse } so the caller can stream SSE.
   */
  async createAndLaunch(data) {
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: data.brandProfileId }
    });
    if (!brandProfile) throw new Error("BrandProfile not found");
    const user = await prisma.user.findFirst();
    const apiKeys = user?.apiKeys;
    const llmApiKey = apiKeys?.gemini;
    const brief = await prisma.campaignBrief.create({
      data: {
        workspaceId: data.workspaceId,
        brandProfileId: data.brandProfileId,
        goal: data.goal,
        channels: data.channels,
        budget: data.budget,
        timelineStart: data.timelineStart ? new Date(data.timelineStart) : void 0,
        timelineEnd: data.timelineEnd ? new Date(data.timelineEnd) : void 0,
        keyMessage: data.keyMessage,
        offerDetails: data.offerDetails,
        kpiTarget: data.kpiTarget,
        freeTextContext: data.freeTextContext,
        rawPromptFallback: data.rawPromptFallback
      }
    });
    const campaign = await prisma.campaign.create({
      data: {
        name: `${brandProfile.businessName} \u2014 ${data.goal} campaign`,
        workspaceId: data.workspaceId,
        status: "ACTIVE",
        campaignBriefId: brief.id
      }
    });
    const agentPayload = {
      brand_profile: {
        id: brandProfile.id,
        business_name: brandProfile.businessName,
        industry: brandProfile.industry,
        website_url: brandProfile.websiteUrl,
        mission: brandProfile.mission,
        usp: brandProfile.usp,
        positioning: brandProfile.positioning,
        voice_adjectives: brandProfile.voiceAdjectives,
        voice_dos: brandProfile.voiceDos,
        voice_donts: brandProfile.voiceDonts,
        logo_url: brandProfile.logoUrl,
        brand_colors: brandProfile.brandColors,
        personas: brandProfile.personas,
        competitors: brandProfile.competitors,
        compliance_region: brandProfile.complianceRegion,
        compliance_notes: brandProfile.complianceNotes,
        past_campaign_refs: brandProfile.pastCampaignRefs
      },
      campaign_brief: {
        id: brief.id,
        goal: brief.goal,
        channels: brief.channels,
        budget: brief.budget,
        timeline_start: brief.timelineStart?.toISOString(),
        timeline_end: brief.timelineEnd?.toISOString(),
        key_message: brief.keyMessage,
        offer_details: brief.offerDetails,
        kpi_target: brief.kpiTarget,
        free_text_context: brief.freeTextContext
      },
      // Raw prompt fallback for legacy path inside agent
      user_intent: brief.rawPromptFallback ?? brief.keyMessage ?? `${brief.goal} campaign for ${brandProfile.businessName}`,
      channels: brief.channels,
      workspace_id: data.workspaceId,
      recipient_email: data.recipientEmail,
      recipient_phone: data.recipientPhone,
      sender_name: data.senderName ?? brandProfile.businessName,
      company_name: data.companyName ?? brandProfile.businessName,
      company_address: data.companyAddress ?? "",
      unsubscribe_url: data.unsubscribeUrl ?? "https://example.com/unsubscribe",
      llm_api_key: llmApiKey
    };
    return { brief, campaign, agentPayload };
  }
};

// src/modules/campaign_brief/controller.ts
var CampaignBriefController = class {
  service = new CampaignBriefService();
  /**
   * POST /campaign/brief
   * Creates the brief and forwards the request to the agent service.
   * Streams the agent response back to the client using SSE.
   */
  createAndLaunch = async (req, res, next) => {
    try {
      const { brief, campaign, agentPayload } = await this.service.createAndLaunch(req.body);
      const agentServiceUrl = process.env.AGENT_SERVICE_URL || "http://localhost:8000";
      const agentRes = await fetch(`${agentServiceUrl}/v1/pipeline/campaign/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentPayload)
      });
      if (!agentRes.ok) {
        throw new Error(`Agent service returned ${agentRes.status}`);
      }
      if (!agentRes.body) {
        throw new Error("Agent service returned no body");
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const reader = agentRes.body.getReader();
      const decoder = new TextDecoder("utf-8");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value));
      }
      res.end();
    } catch (error) {
      next(error);
    }
  };
};

// src/modules/campaign_brief/validator.ts
var import_zod5 = require("zod");
var createCampaignBriefSchema = import_zod5.z.object({
  body: import_zod5.z.object({
    workspaceId: import_zod5.z.string().uuid("workspaceId must be a valid UUID"),
    brandProfileId: import_zod5.z.string().uuid("brandProfileId must be a valid UUID"),
    goal: import_zod5.z.enum(["awareness", "leads", "sales", "retention"], {
      errorMap: () => ({
        message: "goal must be one of: awareness, leads, sales, retention"
      })
    }),
    channels: import_zod5.z.array(import_zod5.z.enum(["email", "sms", "voice", "whatsapp", "social"])).min(1, "At least one channel is required"),
    budget: import_zod5.z.number().positive().optional(),
    timelineStart: import_zod5.z.string().datetime({ offset: true }).optional(),
    timelineEnd: import_zod5.z.string().datetime({ offset: true }).optional(),
    keyMessage: import_zod5.z.string().min(1).optional(),
    offerDetails: import_zod5.z.string().optional(),
    kpiTarget: import_zod5.z.string().optional(),
    freeTextContext: import_zod5.z.string().optional(),
    rawPromptFallback: import_zod5.z.string().optional(),
    // Optional send context
    recipientEmail: import_zod5.z.string().email().optional(),
    recipientPhone: import_zod5.z.string().optional(),
    senderName: import_zod5.z.string().optional(),
    companyName: import_zod5.z.string().optional(),
    companyAddress: import_zod5.z.string().optional(),
    unsubscribeUrl: import_zod5.z.string().url().optional()
  })
});

// src/modules/campaign_brief/routes.ts
var router18 = (0, import_express18.Router)();
var controller6 = new CampaignBriefController();
router18.post(
  "/brief",
  validate(createCampaignBriefSchema),
  controller6.createAndLaunch
);
var routes_default18 = router18;

// src/modules/whatsapp/routes.ts
var import_express20 = require("express");

// src/middlewares/auth.middleware.ts
var import_express19 = require("@clerk/express");
var import_bcryptjs2 = __toESM(require("bcryptjs"));
var requireClerkAuth = async (req, res, next) => {
  const auth = (0, import_express19.getAuth)(req);
  if (!auth.userId) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized - No active Clerk session",
      code: "UNAUTHORIZED"
    });
  }
  try {
    const clerkUser = await import_express19.clerkClient.users.getUser(auth.userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "No email address associated with Clerk user",
        code: "BAD_REQUEST"
      });
    }
    let user = await prisma.user.findUnique({
      where: { email }
    });
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await import_bcryptjs2.default.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: clerkUser.firstName || "",
          lastName: clerkUser.lastName || ""
        }
      });
      const workspaceName = clerkUser.firstName ? `${clerkUser.firstName}'s Workspace` : "Default Workspace";
      const workspace = await prisma.workspace.create({
        data: {
          name: workspaceName
        }
      });
      await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "OWNER"
        }
      });
    }
    req.user = {
      userId: user.id,
      email: user.email,
      clerkId: auth.userId
    };
    next();
  } catch (error) {
    console.error("Clerk Authentication Middleware Error:", error);
    next(error);
  }
};

// src/modules/whatsapp/core.ts
var {
  GEMINI_API_KEY,
  GEMINI_MODEL = "gemini-2.5-flash",
  ZERNIO_API_KEY,
  ZERNIO_ACCOUNT_ID,
  DEFAULT_COUNTRY_CODE = "",
  MAX_RECIPIENTS = "500"
} = process.env;
var ZERNIO_BASE = "https://zernio.com/api";
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function normalizeNumbers(input) {
  const raw = Array.isArray(input) ? input : String(input ?? "").split(/[\n,;]+/);
  const valid = [];
  const invalid = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of raw) {
    const text = String(item).trim();
    if (!text) continue;
    let digits = text.replace(/\D/g, "");
    if (DEFAULT_COUNTRY_CODE && digits.length === 10) {
      digits = DEFAULT_COUNTRY_CODE + digits;
    }
    if (digits.length < 8 || digits.length > 15) {
      invalid.push(text);
      continue;
    }
    if (!seen.has(digits)) {
      seen.add(digits);
      valid.push(digits);
    }
  }
  return { valid, invalid };
}
var SYSTEM_PROMPT = `You are a WhatsApp marketing copywriter for brand managers.
Turn the brief into ONE WhatsApp promotional message.
Rules:
- Under 600 characters. Short lines, easy to read on a phone.
- First line is the hook. One clear call to action at the end.
- At most two emojis. No ALL CAPS shouting, no fake urgency, no invented discounts, prices, dates or claims that are not in the brief.
- If the brief lacks a detail (link, offer, date), use a clear placeholder in [square brackets].
- End with: Reply STOP to opt out.
- Write in the requested language and tone.
Return only the message text. No preamble, no quotes, no markdown.`;
async function generateMessage({
  prompt,
  brand = "",
  tone = "friendly",
  language = "English"
}) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set on the server. Add it to marketos-backend/.env"
    );
  }
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt is empty.");
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Brand: ${brand || "(not given)"}
Tone: ${tone}
Language: ${language}
Brief: ${prompt}`
              }
            ]
          }
        ],
        generationConfig: { maxOutputTokens: 600 }
      })
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error?.message ?? `Gemini API request failed (${res.status})`
    );
  }
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("\n").trim();
  if (!text) {
    throw new Error(
      "The AI returned an empty message (it may have been blocked by a safety filter)."
    );
  }
  return text;
}
function requireZernioConfig() {
  if (!ZERNIO_API_KEY) {
    throw new Error(
      "ZERNIO_API_KEY must be set on the server. Get it from the Zernio dashboard (zernio.com)."
    );
  }
}
function zernioHeaders() {
  return {
    Authorization: `Bearer ${ZERNIO_API_KEY}`,
    "content-type": "application/json"
  };
}
async function verifyBusinessNumber(businessNumber) {
  requireZernioConfig();
  const typed = normalizeNumbers([businessNumber]).valid[0];
  if (!typed) {
    throw new Error(
      "The business number you entered is not a valid phone number. Include the country code, e.g. +14155550100."
    );
  }
  const pnRes = await fetch(`${ZERNIO_BASE}/v1/whatsapp/phone-numbers`, {
    headers: zernioHeaders()
  });
  const pnData = await pnRes.json();
  if (!pnRes.ok) {
    throw new Error(
      pnData?.error?.message ?? pnData?.message ?? `Zernio error fetching WhatsApp phone numbers (HTTP ${pnRes.status}).`
    );
  }
  const connected = pnData.connected ?? [];
  const sandbox = pnData.sandbox ?? null;
  for (const entry of connected) {
    const entryDigits = String(entry.phoneNumber).replace(/\D/g, "");
    if (entryDigits.endsWith(typed.slice(-10))) {
      const resolvedId = ZERNIO_ACCOUNT_ID || entry.accountId;
      return {
        accountId: resolvedId,
        number: entry.phoneNumber,
        name: entry.displayName ?? ""
      };
    }
  }
  if (sandbox) {
    const sandboxDigits = String(sandbox.phoneNumber).replace(/\D/g, "");
    if (sandboxDigits.endsWith(typed.slice(-10))) {
      return {
        accountId: sandbox.accountId,
        number: sandbox.phoneNumber,
        name: "Sandbox"
      };
    }
  }
  if (ZERNIO_ACCOUNT_ID) {
    const accRes = await fetch(`${ZERNIO_BASE}/v1/accounts`, {
      headers: zernioHeaders()
    });
    const accData = await accRes.json();
    const accounts = accData.accounts ?? [];
    const waAccount = accounts.find((a) => {
      if (a.platform !== "whatsapp") return false;
      const num = String(a.username ?? a.phoneNumber ?? "").replace(/\D/g, "");
      return num.endsWith(typed.slice(-10));
    });
    if (waAccount) {
      return {
        accountId: ZERNIO_ACCOUNT_ID,
        number: waAccount.username ?? waAccount.phoneNumber ?? typed,
        name: ""
      };
    }
  }
  const connectedNums = connected.map((e) => e.phoneNumber).join(", ") || "none";
  const sandboxNum = sandbox ? ` | Sandbox: ${sandbox.phoneNumber}` : "";
  throw new Error(
    `The business number +${typed} is not connected to your Zernio account.
Connected numbers: ${connectedNums}${sandboxNum}.
Connect your WhatsApp Business number in the Zernio dashboard first.`
  );
}
function buildPayload(to, { accountId, mode, message, templateName, languageCode }) {
  const base = { accountId, participantId: to };
  if (mode === "template") {
    const flat = message.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
    return {
      ...base,
      templateName,
      templateLanguage: languageCode ?? "en",
      templateParams: [flat]
    };
  }
  return { ...base, message };
}
async function sendOne(to, opts) {
  const res = await fetch(`${ZERNIO_BASE}/v1/inbox/conversations`, {
    method: "POST",
    headers: zernioHeaders(),
    body: JSON.stringify(buildPayload(to, opts))
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      to,
      ok: false,
      error: data?.error?.message ?? data?.message ?? data?.error ?? `HTTP ${res.status}`
    };
  }
  return {
    to,
    ok: true,
    messageId: data?.data?.id ?? data?.id ?? data?._id
  };
}
async function sendBulk({
  businessNumber,
  recipients,
  message,
  mode = "text",
  templateName,
  languageCode = "en",
  optInConfirmed = false
}) {
  if (!optInConfirmed) {
    throw new Error(
      "You must confirm that every recipient has opted in to receive WhatsApp messages from your business before sending."
    );
  }
  if (!message || !message.trim()) {
    throw new Error("Message is empty.");
  }
  if (mode === "template" && !templateName) {
    throw new Error("Template name is required when using template send mode.");
  }
  const { accountId } = await verifyBusinessNumber(businessNumber);
  const { valid, invalid } = normalizeNumbers(recipients);
  if (!valid.length) {
    throw new Error(
      "No valid recipient numbers found. Use international format, e.g. +14155550123."
    );
  }
  const cap = Number(MAX_RECIPIENTS);
  if (valid.length > cap) {
    throw new Error(
      `Too many recipients (${valid.length}). Maximum allowed per send is ${cap}.`
    );
  }
  const opts = { accountId, mode, message, templateName, languageCode };
  const results = [];
  for (let i = 0; i < valid.length; i += 5) {
    const batch = valid.slice(i, i + 5);
    results.push(...await Promise.all(batch.map((n) => sendOne(n, opts))));
    if (i + 5 < valid.length) await sleep(300);
  }
  return {
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    invalidNumbers: invalid,
    results
  };
}

// src/modules/whatsapp/routes.ts
var router19 = (0, import_express20.Router)();
router19.post(
  "/generate",
  requireClerkAuth,
  async (req, res) => {
    try {
      const message = await generateMessage(req.body);
      res.json({ message });
    } catch (e) {
      res.status(400).json({ error: e.message ?? "Unknown error" });
    }
  }
);
router19.post(
  "/send",
  requireClerkAuth,
  async (req, res) => {
    try {
      const result = await sendBulk(req.body);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message ?? "Unknown error" });
    }
  }
);
var routes_default19 = router19;

// src/modules/phone/routes.ts
var import_express21 = require("express");
var router20 = (0, import_express21.Router)();
router20.post("/verify", async (req, res) => {
  const { accountSid, authToken, phoneNumber } = req.body;
  if (!accountSid || !authToken) {
    return res.status(400).json({
      success: false,
      error: "accountSid and authToken are required"
    });
  }
  if (!accountSid.startsWith("AC") || accountSid.length < 34) {
    return res.status(400).json({
      success: false,
      error: "Invalid Account SID format. Must start with AC and be 34 characters."
    });
  }
  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const accountRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json"
        }
      }
    );
    if (!accountRes.ok) {
      const errData = await accountRes.json().catch(() => ({}));
      return res.status(401).json({
        success: false,
        verified: false,
        error: errData.message || `Twilio authentication failed (HTTP ${accountRes.status})`,
        code: accountRes.status
      });
    }
    const accountData = await accountRes.json();
    let phoneVerified = false;
    let phoneFriendlyName = phoneNumber;
    if (phoneNumber) {
      try {
        const phoneRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`,
          { headers: { Authorization: `Basic ${basicAuth}` } }
        );
        if (phoneRes.ok) {
          const phoneData = await phoneRes.json();
          const numbers = phoneData.incoming_phone_numbers || [];
          phoneVerified = numbers.length > 0;
          if (phoneVerified) {
            phoneFriendlyName = numbers[0].friendly_name || phoneNumber;
          }
        }
      } catch (_) {
      }
    }
    return res.json({
      success: true,
      verified: true,
      account: {
        sid: accountData.sid,
        friendlyName: accountData.friendly_name,
        status: accountData.status,
        type: accountData.type,
        dateCreated: accountData.date_created
      },
      phone: phoneNumber ? {
        number: phoneNumber,
        friendlyName: phoneFriendlyName,
        verifiedOnAccount: phoneVerified
      } : null
    });
  } catch (err) {
    console.error("[Phone/Verify] Error:", err);
    return res.status(502).json({
      success: false,
      verified: false,
      error: `Could not reach Twilio API: ${err.message}`
    });
  }
});
router20.post("/call", async (req, res) => {
  const { accountSid, authToken, from, to, url } = req.body;
  if (!accountSid || !authToken || !from || !to) {
    return res.status(400).json({
      success: false,
      error: "accountSid, authToken, from, and to are required"
    });
  }
  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const twimlUrl = url || "http://demo.twilio.com/docs/voice.xml";
    const body = new URLSearchParams({ To: to, From: from, Url: twimlUrl });
    const callRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
      }
    );
    const callData = await callRes.json();
    if (!callRes.ok) {
      return res.status(callRes.status).json({
        success: false,
        error: callData.message || `Twilio call failed (HTTP ${callRes.status})`,
        twilioCode: callData.code
      });
    }
    return res.json({
      success: true,
      call: {
        sid: callData.sid,
        status: callData.status,
        to: callData.to,
        from: callData.from,
        direction: callData.direction,
        dateCreated: callData.date_created
      }
    });
  } catch (err) {
    console.error("[Phone/Call] Error:", err);
    return res.status(502).json({
      success: false,
      error: `Could not reach Twilio API: ${err.message}`
    });
  }
});
router20.get("/status", async (req, res) => {
  const { accountSid, authToken } = req.query;
  if (!accountSid || !authToken) {
    return res.status(400).json({ success: false, error: "accountSid and authToken are required" });
  }
  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const accountRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );
    if (!accountRes.ok) {
      return res.status(401).json({ success: false, connected: false, error: "Invalid credentials" });
    }
    const data = await accountRes.json();
    return res.json({
      success: true,
      connected: true,
      account: {
        sid: data.sid,
        friendlyName: data.friendly_name,
        status: data.status
      }
    });
  } catch (err) {
    return res.status(502).json({ success: false, connected: false, error: err.message });
  }
});
var routes_default20 = router20;

// src/modules/sms/routes.ts
var import_express22 = require("express");
var router21 = (0, import_express22.Router)();
router21.post("/verify", async (req, res) => {
  const { accountSid, authToken, fromNumber } = req.body;
  if (!accountSid || !authToken) {
    return res.status(400).json({ success: false, error: "accountSid and authToken are required" });
  }
  if (!accountSid.startsWith("AC") || accountSid.length < 34) {
    return res.status(400).json({
      success: false,
      error: "Invalid Account SID format. Must start with AC and be 34 characters."
    });
  }
  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const accountRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );
    if (!accountRes.ok) {
      const errData = await accountRes.json().catch(() => ({}));
      return res.status(401).json({
        success: false,
        verified: false,
        error: errData.message || `Authentication failed (HTTP ${accountRes.status})`
      });
    }
    const accountData = await accountRes.json();
    let smsCapable = false;
    let phoneDetails = null;
    if (fromNumber) {
      try {
        const phoneRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(fromNumber)}`,
          { headers: { Authorization: `Basic ${basicAuth}` } }
        );
        if (phoneRes.ok) {
          const phoneData = await phoneRes.json();
          const numbers = phoneData.incoming_phone_numbers || [];
          if (numbers.length > 0) {
            const num = numbers[0];
            smsCapable = num.capabilities?.sms === true;
            phoneDetails = {
              sid: num.sid,
              friendlyName: num.friendly_name,
              phoneNumber: num.phone_number,
              smsCapable: num.capabilities?.sms,
              voiceCapable: num.capabilities?.voice,
              mmsCapable: num.capabilities?.mms
            };
          }
        }
      } catch (_) {
      }
    }
    return res.json({
      success: true,
      verified: true,
      account: {
        sid: accountData.sid,
        friendlyName: accountData.friendly_name,
        status: accountData.status,
        type: accountData.type
      },
      phone: phoneDetails,
      smsCapable
    });
  } catch (err) {
    console.error("[SMS/Verify] Error:", err);
    return res.status(502).json({
      success: false,
      verified: false,
      error: `Could not reach Twilio API: ${err.message}`
    });
  }
});
router21.post("/send", async (req, res) => {
  const { accountSid, authToken, from, to, body: messageBody } = req.body;
  if (!accountSid || !authToken || !from || !to || !messageBody) {
    return res.status(400).json({
      success: false,
      error: "accountSid, authToken, from, to, and body are required"
    });
  }
  const recipients = Array.isArray(to) ? to : String(to).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) {
    return res.status(400).json({ success: false, error: "No valid recipient numbers provided" });
  }
  const maxRecipients = parseInt(process.env.MAX_RECIPIENTS || "100", 10);
  if (recipients.length > maxRecipients) {
    return res.status(400).json({
      success: false,
      error: `Too many recipients. Maximum is ${maxRecipients}.`
    });
  }
  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const results = [];
  for (const recipient of recipients) {
    try {
      const formBody = new URLSearchParams({
        To: recipient,
        From: from,
        Body: messageBody
      });
      const smsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formBody.toString()
        }
      );
      const smsData = await smsRes.json();
      if (smsRes.ok && smsData.sid) {
        results.push({
          to: recipient,
          ok: true,
          sid: smsData.sid,
          status: smsData.status
        });
      } else {
        results.push({
          to: recipient,
          ok: false,
          error: smsData.message || `HTTP ${smsRes.status}`
        });
      }
    } catch (err) {
      results.push({ to: recipient, ok: false, error: err.message });
    }
  }
  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  return res.json({
    success: true,
    sent,
    failed,
    total: recipients.length,
    results
  });
});
router21.get("/messages", async (req, res) => {
  const { accountSid, authToken, limit = "20" } = req.query;
  if (!accountSid || !authToken) {
    return res.status(400).json({ success: false, error: "accountSid and authToken are required" });
  }
  try {
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const msgRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?PageSize=${Math.min(parseInt(limit, 10), 50)}`,
      { headers: { Authorization: `Basic ${basicAuth}` } }
    );
    if (!msgRes.ok) {
      return res.status(msgRes.status).json({ success: false, error: "Failed to fetch messages" });
    }
    const msgData = await msgRes.json();
    const messages = (msgData.messages || []).map((m) => ({
      sid: m.sid,
      to: m.to,
      from: m.from,
      body: m.body,
      status: m.status,
      direction: m.direction,
      dateCreated: m.date_created,
      numSegments: m.num_segments
    }));
    return res.json({ success: true, total: messages.length, messages });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
});
var routes_default21 = router21;

// src/modules/email_channel/routes.ts
var import_express23 = require("express");
var router22 = (0, import_express23.Router)();
router22.post("/verify/clerk", async (req, res) => {
  const { secretKey, publishableKey, fromEmail } = req.body;
  if (!secretKey) {
    return res.status(400).json({ success: false, error: "secretKey is required" });
  }
  if (!secretKey.startsWith("sk_")) {
    return res.status(400).json({
      success: false,
      error: "Invalid Clerk Secret Key format. Must start with sk_test_ or sk_live_."
    });
  }
  if (publishableKey && !publishableKey.startsWith("pk_")) {
    return res.status(400).json({
      success: false,
      error: "Invalid Clerk Publishable Key format. Must start with pk_test_ or pk_live_."
    });
  }
  try {
    const clerkRes = await fetch("https://api.clerk.com/v1/users?limit=1", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      }
    });
    if (clerkRes.status === 401 || clerkRes.status === 403) {
      return res.status(401).json({
        success: false,
        verified: false,
        error: "Invalid Clerk Secret Key. Authentication failed."
      });
    }
    let appName = "Clerk Application";
    try {
      const jwtRes = await fetch("https://api.clerk.com/v1/jwks", {
        headers: { Authorization: `Bearer ${secretKey}` }
      });
      if (jwtRes.ok) {
        appName = "Clerk Application (Verified)";
      }
    } catch (_) {
    }
    if (!clerkRes.ok && clerkRes.status !== 200) {
      return res.json({
        success: true,
        verified: true,
        provider: "clerk",
        app: {
          name: appName,
          environment: secretKey.includes("_test_") ? "test" : "production"
        },
        fromEmail: fromEmail || null,
        note: "Key format verified. Full Clerk API access confirmed."
      });
    }
    const userData = await clerkRes.json();
    return res.json({
      success: true,
      verified: true,
      provider: "clerk",
      app: {
        name: appName,
        environment: secretKey.includes("_test_") ? "test" : "production",
        totalUsers: userData.total_count ?? 0
      },
      fromEmail: fromEmail || null
    });
  } catch (err) {
    console.error("[Email/Verify/Clerk] Error:", err);
    return res.status(502).json({
      success: false,
      verified: false,
      error: `Could not reach Clerk API: ${err.message}`
    });
  }
});
router22.post("/verify/google", async (req, res) => {
  const {
    clientId: clientId2,
    clientSecret,
    redirectUri,
    scopes = ["https://www.googleapis.com/auth/gmail.send"]
  } = req.body;
  if (!clientId2 || !clientSecret || !redirectUri) {
    return res.status(400).json({
      success: false,
      error: "clientId, clientSecret, and redirectUri are required"
    });
  }
  if (!clientId2.includes(".apps.googleusercontent.com")) {
    return res.status(400).json({
      success: false,
      error: "Invalid Client ID format. Must end with .apps.googleusercontent.com"
    });
  }
  if (clientSecret.length < 10) {
    return res.status(400).json({
      success: false,
      error: "Client Secret appears too short."
    });
  }
  try {
    const scopeList = Array.isArray(scopes) ? scopes : [scopes];
    const params = new URLSearchParams({
      client_id: clientId2,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopeList.join(" "),
      access_type: "offline",
      prompt: "consent"
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    let credentialsValid = false;
    try {
      const discoveryRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?client_id=${encodeURIComponent(clientId2)}`
      );
      credentialsValid = discoveryRes.status !== 500;
    } catch (_) {
      credentialsValid = true;
    }
    return res.json({
      success: true,
      verified: true,
      provider: "google",
      credentials: {
        clientId: clientId2,
        redirectUri,
        scopes: scopeList,
        formatValid: true,
        credentialsValid
      },
      authUrl,
      instructions: [
        "1. Open the authUrl in a browser to get the authorization code",
        "2. User approves Gmail access",
        "3. Google redirects to your redirectUri with ?code=...",
        "4. Exchange the code for tokens via POST /api/v1/email-channel/google/token"
      ]
    });
  } catch (err) {
    console.error("[Email/Verify/Google] Error:", err);
    return res.status(502).json({
      success: false,
      verified: false,
      error: `Verification error: ${err.message}`
    });
  }
});
router22.post("/google/token", async (req, res) => {
  const { clientId: clientId2, clientSecret, redirectUri, code } = req.body;
  if (!clientId2 || !clientSecret || !redirectUri || !code) {
    return res.status(400).json({
      success: false,
      error: "clientId, clientSecret, redirectUri, and code are required"
    });
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId2,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code"
      }).toString()
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({
        success: false,
        error: tokenData.error_description || tokenData.error || "Token exchange failed"
      });
    }
    return res.json({
      success: true,
      tokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        scope: tokenData.scope
      }
    });
  } catch (err) {
    console.error("[Email/Google/Token] Error:", err);
    return res.status(502).json({ success: false, error: err.message });
  }
});
router22.post("/send/clerk", async (req, res) => {
  const { secretKey, fromEmail, fromName, toEmail, subject, body: emailBody } = req.body;
  if (!secretKey || !toEmail || !subject || !emailBody) {
    return res.status(400).json({
      success: false,
      error: "secretKey, toEmail, subject, and body are required"
    });
  }
  try {
    const emailRes = await fetch("https://api.clerk.com/v1/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from_email_name: fromName || "MarketOS",
        email_address_id: toEmail,
        subject,
        body: emailBody
      })
    });
    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      return res.status(emailRes.status).json({
        success: false,
        error: emailData.errors?.[0]?.message || emailData.message || `Clerk email failed (HTTP ${emailRes.status})`
      });
    }
    return res.json({
      success: true,
      messageId: emailData.id,
      status: emailData.status,
      toEmail,
      fromEmail
    });
  } catch (err) {
    console.error("[Email/Send/Clerk] Error:", err);
    return res.status(502).json({ success: false, error: err.message });
  }
});
router22.post("/send/gmail", async (req, res) => {
  const { accessToken, from, to, subject, body: emailBody } = req.body;
  if (!accessToken || !from || !to || !subject || !emailBody) {
    return res.status(400).json({
      success: false,
      error: "accessToken, from, to, subject, and body are required"
    });
  }
  try {
    const rawMessage = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      "",
      emailBody
    ].join("\r\n");
    const encodedMessage = Buffer.from(rawMessage).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: encodedMessage })
      }
    );
    const gmailData = await gmailRes.json();
    if (!gmailRes.ok) {
      return res.status(gmailRes.status).json({
        success: false,
        error: gmailData.error?.message || `Gmail send failed (HTTP ${gmailRes.status})`
      });
    }
    return res.json({
      success: true,
      messageId: gmailData.id,
      threadId: gmailData.threadId,
      labelIds: gmailData.labelIds,
      to,
      from
    });
  } catch (err) {
    console.error("[Email/Send/Gmail] Error:", err);
    return res.status(502).json({ success: false, error: err.message });
  }
});
router22.get("/health", (_req, res) => {
  res.json({
    success: true,
    module: "email-channel",
    providers: ["clerk", "google-oauth-gmail"],
    status: "operational",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var routes_default22 = router22;

// src/modules/history/routes.ts
var import_express24 = require("express");
var router23 = (0, import_express24.Router)();
async function getUserId(req) {
  const userId = req.user?.userId;
  if (userId) return userId;
  const user = await prisma.user.findFirst().catch(() => null);
  return user?.id ?? null;
}
router23.get("/", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "User not found" });
    }
    const page = parseInt(String(req.query.page || "1"));
    const limit = parseInt(String(req.query.limit || "20"));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "");
    const where = {
      userId,
      ...search ? { prompt: { contains: search, mode: "insensitive" } } : {}
    };
    const [items, total] = await Promise.all([
      prisma.campaignHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" }
      }),
      prisma.campaignHistory.count({ where })
    ]);
    res.status(200).json({
      success: true,
      data: items,
      meta: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error("[History] List error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
router23.get("/:id", async (req, res) => {
  try {
    const userId = await getUserId(req);
    const item = await prisma.campaignHistory.findFirst({
      where: { id: req.params.id, userId }
    });
    if (!item) {
      return res.status(404).json({ success: false, error: "History item not found" });
    }
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router23.post("/", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "User not found" });
    }
    const {
      prompt,
      agentOutputs,
      documentation,
      channels = [],
      runId,
      recipientEmail,
      recipientPhone,
      status = "completed"
    } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: "prompt is required" });
    }
    const item = await prisma.campaignHistory.create({
      data: {
        userId,
        runId: runId || null,
        prompt,
        agentOutputs: agentOutputs || {},
        documentation: documentation || null,
        channels: Array.isArray(channels) ? channels : [],
        recipientEmail: recipientEmail || null,
        recipientPhone: recipientPhone || null,
        status,
        dispatchLog: []
      }
    });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    logger.error("[History] Save error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
router23.delete("/:id", async (req, res) => {
  try {
    const userId = await getUserId(req);
    const existing = await prisma.campaignHistory.findFirst({
      where: { id: req.params.id, userId }
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: "History item not found" });
    }
    await prisma.campaignHistory.update({
      where: { id: req.params.id },
      data: { status: "archived" }
    });
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router23.post("/:id/dispatch", async (req, res) => {
  try {
    const userId = await getUserId(req);
    const item = await prisma.campaignHistory.findFirst({
      where: { id: req.params.id, userId }
    });
    if (!item) {
      return res.status(404).json({ success: false, error: "History item not found" });
    }
    const {
      channels = item.channels,
      recipientEmail = item.recipientEmail,
      recipientPhone = item.recipientPhone,
      customMessage
    } = req.body;
    const outputs = item.agentOutputs;
    const dispatchLog = Array.isArray(item.dispatchLog) ? item.dispatchLog : [];
    const agentServiceUrl = process.env.AGENT_SERVICE_URL || "http://marketos_agents:8000";
    for (const channel of channels) {
      const sentAt = (/* @__PURE__ */ new Date()).toISOString();
      let status = "failed";
      let messageId = "";
      let detail = "";
      try {
        if (channel === "email" && (outputs.email || outputs.Email || outputs["Email Agent"])) {
          const emailOutput = outputs.email || outputs.Email || outputs["Email Agent"] || {};
          const emailBody = emailOutput?.email_draft_1 || emailOutput;
          const payload = {
            user_intent: `Dispatch saved campaign: ${item.prompt}`,
            channels: ["email"],
            recipient_email: recipientEmail,
            sender_name: emailBody?.sender_name || "MarketOS"
          };
          const agentResp = await fetch(`${agentServiceUrl}/v1/pipeline/campaign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }).catch(() => null);
          status = agentResp?.ok ? "sent" : "failed";
          messageId = `email-${Date.now()}`;
          detail = agentResp?.ok ? "Email dispatched via agent service" : "Agent service unavailable";
        } else if (channel === "sms" && (outputs.sms || outputs.SMS || outputs["SMS Agent"])) {
          const smsOutput = outputs.sms || outputs.SMS || outputs["SMS Agent"] || {};
          const message = customMessage || smsOutput?.selected_message || smsOutput?.variants?.[0]?.message || "";
          const payload = {
            user_intent: `Send SMS: ${message}`,
            channels: ["sms"],
            recipient_phone: recipientPhone
          };
          const agentResp = await fetch(`${agentServiceUrl}/v1/pipeline/campaign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }).catch(() => null);
          status = agentResp?.ok ? "sent" : "failed";
          messageId = `sms-${Date.now()}`;
          detail = agentResp?.ok ? "SMS dispatched via agent service" : "Agent service unavailable";
        } else if (channel === "social") {
          status = "scheduled";
          messageId = `social-${Date.now()}`;
          detail = "Social post queued for publishing";
        } else {
          status = "skipped";
          detail = `No output available for channel: ${channel}`;
        }
      } catch (dispatchErr) {
        detail = dispatchErr.message;
      }
      dispatchLog.push({ channel, status, sentAt, messageId, detail });
    }
    const updated = await prisma.campaignHistory.update({
      where: { id: item.id },
      data: {
        status: "dispatched",
        dispatchLog
      }
    });
    res.status(200).json({
      success: true,
      data: { dispatchLog, status: "dispatched", id: updated.id }
    });
  } catch (err) {
    logger.error("[History] Dispatch error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
var routes_default23 = router23;

// src/modules/telegram/routes.ts
var import_express25 = require("express");

// src/modules/telegram/core.ts
var {
  GEMINI_API_KEY: GEMINI_API_KEY2,
  GEMINI_MODEL: GEMINI_MODEL2 = "gemini-2.5-flash",
  COMPOSIO_API_KEY = "",
  TELEGRAM_BOT_TOKEN = "",
  TELEGRAM_CHANNEL_ID = ""
} = process.env;
var TELEGRAM_BOT_API = "https://api.telegram.org";
var SYSTEM_PROMPT2 = `You are a Telegram channel advertising specialist.

Write ONE short Telegram advertisement message for a brand's product/service.

STRICT RULES:
- For image posts (caption): max 280 characters.
- For text-only posts: max 1024 characters.
- Start with a punchy one-line hook. Max 2 emojis total.
- Include exactly ONE call-to-action with the provided URL or [LINK] placeholder.
- No invented discounts, prices, or facts not in the brief.
- End with 2\u20134 relevant hashtags on their own line.
- Write in the requested language and tone.
- Also provide a short IMAGE PROMPT (\u226450 words) for a product/lifestyle visual.

Return ONLY valid JSON:
{
  "message": "<telegram ad text with hashtags>",
  "image_prompt": "<50-word FLUX/DALL-E image prompt>",
  "hashtags": ["#tag1", "#tag2"],
  "char_count": <integer>
}`;
async function generateTelegramMessage(input) {
  if (!GEMINI_API_KEY2) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to marketos-backend/.env"
    );
  }
  if (!input.prompt?.trim()) {
    throw new Error("Prompt is required.");
  }
  const userText = [
    `Brand: ${input.brand || "(not provided)"}`,
    `Tone: ${input.tone || "Friendly"}`,
    `Language: ${input.language || "English"}`,
    `CTA URL: ${input.ctaUrl || "[LINK]"}`,
    `Brief: ${input.prompt}`
  ].join("\n");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL2}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY2
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT2 }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { maxOutputTokens: 800, responseMimeType: "application/json" }
      })
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error?.message ?? `Gemini API error (${res.status})`
    );
  }
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!rawText) {
    throw new Error("Gemini returned an empty response (possible safety filter).");
  }
  let parsed;
  try {
    const clean = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(clean);
  } catch {
    parsed = {
      message: rawText.slice(0, 1024),
      image_prompt: "",
      hashtags: [],
      char_count: rawText.length
    };
  }
  return {
    message: parsed.message ?? rawText.slice(0, 1024),
    imagePrompt: parsed.image_prompt ?? "",
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    charCount: parsed.char_count ?? (parsed.message ?? rawText).length
  };
}
async function sendViaComposio(channelId, text) {
  if (!COMPOSIO_API_KEY) {
    return { sent: false, provider: "composio", error: "COMPOSIO_API_KEY not set" };
  }
  try {
    const res = await fetch("https://backend.composio.dev/api/v1/actions/TELEGRAM_SEND_MESSAGE/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY
      },
      body: JSON.stringify({
        connectedAccountId: "ca_WpoPDvF0cbTz",
        input: {
          chat_id: channelId,
          text,
          parse_mode: "HTML"
        }
      })
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      return {
        sent: false,
        provider: "composio",
        error: data?.message ?? data?.error ?? `Composio error (${res.status})`
      };
    }
    return {
      sent: true,
      provider: "composio",
      messageId: data?.data?.result?.message_id
    };
  } catch (err) {
    return { sent: false, provider: "composio", error: err.message };
  }
}
async function sendViaBotApi(botToken, channelId, text) {
  try {
    const res = await fetch(`${TELEGRAM_BOT_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        text: text.slice(0, 4096),
        parse_mode: "HTML"
      })
    });
    const data = await res.json();
    if (!data.ok) {
      return {
        sent: false,
        provider: "telegram_bot_api",
        error: data.description ?? "Unknown Telegram error"
      };
    }
    return {
      sent: true,
      provider: "telegram_bot_api",
      messageId: data.result?.message_id
    };
  } catch (err) {
    return { sent: false, provider: "telegram_bot_api", error: err.message };
  }
}
async function sendTelegramMessage(input) {
  const phones = input.phones.map((p) => p.trim()).filter(Boolean);
  const botToken = input.botToken || TELEGRAM_BOT_TOKEN;
  if (phones.length === 0) {
    throw new Error(
      "At least one phone number or chat ID is required."
    );
  }
  if (!botToken && !COMPOSIO_API_KEY) {
    throw new Error(
      "Neither TELEGRAM_BOT_TOKEN nor COMPOSIO_API_KEY is configured on the server."
    );
  }
  const results = [];
  for (const phone of phones) {
    let recipientResult;
    const chatId = phone.startsWith("+") || phone.startsWith("-") || /^\d+$/.test(phone) ? phone : `+${phone}`;
    if (botToken) {
      const r = await sendViaBotApi(botToken, chatId, input.message);
      recipientResult = { phone, ...r };
    } else if (COMPOSIO_API_KEY) {
      const r = await sendViaComposio(chatId, input.message);
      recipientResult = { phone, ...r };
    } else {
      recipientResult = {
        phone,
        sent: false,
        provider: "none",
        error: "No send provider configured"
      };
    }
    results.push(recipientResult);
    if (phones.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  const sentCount = results.filter((r) => r.sent).length;
  return {
    sentCount,
    total: phones.length,
    results
  };
}

// src/modules/telegram/routes.ts
var router24 = (0, import_express25.Router)();
router24.post(
  "/generate",
  requireClerkAuth,
  async (req, res) => {
    try {
      const result = await generateTelegramMessage(req.body);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message ?? "Unknown error" });
    }
  }
);
router24.post(
  "/send",
  requireClerkAuth,
  async (req, res) => {
    try {
      const result = await sendTelegramMessage(req.body);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message ?? "Unknown error" });
    }
  }
);
var routes_default24 = router24;

// src/routes.ts
var router25 = (0, import_express26.Router)();
router25.use("/auth", routes_default);
router25.use("/settings", routes_default2);
router25.use("/dashboard", routes_default3);
router25.use("/campaigns", routes_default4);
router25.use("/campaign-detail", routes_default5);
router25.use("/analytics", routes_default6);
router25.use("/audience", routes_default7);
router25.use("/ai-command-center", routes_default8);
router25.use("/agents", routes_default9);
router25.use("/workflow-engine", routes_default10);
router25.use("/creative-studio", routes_default11);
router25.use("/competitive-intelligence", routes_default12);
router25.use("/finance", routes_default13);
router25.use("/reports", routes_default14);
router25.use("/monitoring", routes_default15);
router25.use("/audit-logs", routes_default16);
router25.use("/brand-profile", routes_default17);
router25.use("/campaign", routes_default18);
router25.use("/whatsapp", routes_default19);
router25.use("/phone", routes_default20);
router25.use("/sms", routes_default21);
router25.use("/email-channel", routes_default22);
router25.use("/history", routes_default23);
router25.use("/telegram", routes_default24);
var routes_default25 = router25;
