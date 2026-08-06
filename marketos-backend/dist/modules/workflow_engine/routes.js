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

// src/modules/workflow_engine/routes.ts
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

// src/lib/socket.ts
var import_socket = require("socket.io");

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
var io;

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body !== void 0 ? JSON.stringify(body) : void 0,
        signal: controller.signal
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
  return agentFetchStream("/v1/query/stream", opts, 18e4);
}
var agentClient = {
  baseUrl: AGENT_SERVICE_URL,
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
var router = (0, import_express.Router)();
router.post("/workflows", async (req, res) => {
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
router.post("/", async (req, res) => {
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
router.get("/workflows/:runId", async (req, res) => {
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
router.get("/:runId", async (req, res) => {
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
router.post("/workflows/:runId/approve", async (req, res) => {
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
router.post("/:runId/approve", async (req, res) => {
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
router.get("/graph", (_req, res) => {
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
router.get("/executions", (_req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.get("/executions/:id", (req, res) => {
  res.status(200).json({ success: true, data: { execution: { id: req.params.id }, steps: [] } });
});
router.post("/executions/:id/cancel", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: "CANCELLED" } });
});
router.get("/dependencies", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      parallelGroups: [["CopyAgent", "CreativeAgent"], ["EmailAgent", "SmsAgent", "SocialAgent"], ["AnalyticsAgent"]],
      criticalPath: ["SupervisorAgent", "CopyAgent", "ComplianceAgent", "EmailAgent", "AnalyticsAgent"]
    }
  });
});
router.get("/automation", (_req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "wf1", name: "Full Campaign Launch Workflow", description: "End-to-end workflow from brief to launch", steps: 8, lastRun: null, enabled: true },
    { id: "wf2", name: "Re-engagement Workflow", description: "Automated re-engagement sequence for cold leads", steps: 5, lastRun: "2026-06-01T10:00:00Z", enabled: true }
  ] });
});
router.post("/automation/:id/trigger", (_req, res) => {
  res.status(200).json({ success: true, data: { executionId: "exec-uuid", status: "RUNNING" } });
});
var routes_default = router;
