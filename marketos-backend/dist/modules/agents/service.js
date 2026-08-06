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

// src/modules/agents/service.ts
var service_exports = {};
__export(service_exports, {
  AgentsService: () => AgentsService
});
module.exports = __toCommonJS(service_exports);

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

// src/lib/redis.ts
var import_ioredis = __toESM(require("ioredis"));
var redisClient = new import_ioredis.default({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null
});
redisClient.on("connect", () => {
  logger.info("Connected to Redis");
});
redisClient.on("error", (err) => {
  logger.error("Redis connection error:", err);
});

// src/lib/kafka.ts
var kafkaBroker = process.env.KAFKA_BROKER || "localhost:9092";
var clientId = process.env.KAFKA_CLIENT_ID || "marketos-backend";
var kafka = new import_kafkajs.Kafka({
  clientId,
  brokers: [kafkaBroker],
  retry: {
    retries: 5,
    initialRetryTime: 1e3,
    maxRetryTime: 1e4
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentsService
});
