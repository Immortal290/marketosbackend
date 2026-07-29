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

// src/modules/ai_command_center/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");

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

// src/lib/agentClient.ts
var AGENT_SERVICE_URL = (process.env.AGENT_SERVICE_URL || "http://localhost:8000").replace(/\/$/, "");
logger.info(`[AgentClient] Agent service URL: ${AGENT_SERVICE_URL}`);
async function agentFetch(path, opts = {}) {
  const { method = "GET", body, timeoutMs = 3e4 } = opts;
  const url = `${AGENT_SERVICE_URL}${path}`;
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
    return response.json();
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Agent service request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  }
}
async function agentFetchStream(path, body, timeoutMs = 12e4) {
  const url = `${AGENT_SERVICE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Agent service streaming returned ${response.status}: ${text.slice(0, 200)}`
      );
    }
    return response.body;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Agent service stream timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
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

// src/modules/ai_command_center/routes.ts
var router = (0, import_express.Router)();
router.post("/command", (req, res) => {
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
router.get("/suggestions", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "s1", label: "Boost Q4 campaign budget", description: "ROAS is 5.1x \u2014 increasing budget could yield 40% more revenue", impact: "HIGH", prompt: "Increase budget for Q4 Product Launch campaign by 20%" },
    { id: "s2", label: "Re-engage cold leads", description: "4,200 leads haven't opened an email in 30 days", impact: "MEDIUM", prompt: "Create a re-engagement sequence for cold leads" }
  ] });
});
router.get("/agents", (req, res) => {
  const agents = ["SUPERVISOR", "COPY", "CREATIVE", "ANALYTICS", "COMPLIANCE", "EMAIL", "SMS", "SOCIAL", "SEO", "COMPETITOR", "FINANCE"];
  res.status(200).json({ success: true, data: agents.map((type, i) => ({ id: `agent-${i}`, name: `${type.charAt(0)}${type.slice(1).toLowerCase()}Agent`, type, status: i < 3 ? "RUNNING" : "IDLE", queueLength: i < 3 ? 2 : 0, successRate: 97 + Math.random() * 2 })) });
});
router.get("/tasks", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.get("/decisions", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "d1", decision: "Pause underperforming ad set B", reasoning: "CTR dropped 40% over 3 days with no conversions", confidence: 0.91, outcome: "EXECUTED", timestamp: (/* @__PURE__ */ new Date()).toISOString() }
  ] });
});
router.get("/memory", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.get("/automation-rules", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "r1", name: "Pause ad if ROAS < 2x", type: "BUDGET", enabled: true, trigger: { metric: "roas", operator: "lt", value: 2 }, action: { type: "PAUSE_AD" }, lastFired: null },
    { id: "r2", name: "Alert on budget threshold", type: "ALERT", enabled: true, trigger: { metric: "budgetUsed", operator: "gte", value: 80 }, action: { type: "SEND_ALERT" }, lastFired: "2026-06-14T08:00:00Z" }
  ] });
});
router.post("/automation-rules", (req, res) => {
  res.status(201).json({ success: true, data: { id: "new-uuid", ...req.body, lastFired: null } });
});
router.delete("/automation-rules/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
router.post("/pipeline/campaign", async (req, res) => {
  try {
    const result = await agentClient_default.runCampaignSync(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[AI CC] Campaign pipeline error:", message);
    res.status(502).json({ success: false, error: "Agent service unavailable", detail: message });
  }
});
router.post("/pipeline/campaign/async", async (req, res) => {
  try {
    const result = await agentClient_default.runCampaignAsync(req.body);
    res.status(202).json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[AI CC] Async campaign error:", message);
    res.status(502).json({ success: false, error: "Agent service unavailable", detail: message });
  }
});
router.get("/pipeline/:campaignId/status", async (req, res) => {
  try {
    const result = await agentClient_default.getCampaignStatus(req.params.campaignId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[AI CC] Campaign status error:", message);
    res.status(502).json({ success: false, error: "Agent service unavailable", detail: message });
  }
});
router.post("/pipeline/campaign/stream", async (req, res) => {
  try {
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
router.post("/query/stream", async (req, res) => {
  try {
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
router.get("/agent-service/health", async (_req, res) => {
  try {
    const health = await agentClient_default.getHealth();
    res.status(health.data?.status === "healthy" ? 200 : 207).json({ success: true, data: health });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[AI CC] Agent service health check failed:", message);
    res.status(502).json({ success: false, error: "Agent service unreachable", detail: message });
  }
});
var routes_default = router;
