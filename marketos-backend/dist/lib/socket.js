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

// src/lib/socket.ts
var socket_exports = {};
__export(socket_exports, {
  initSocket: () => initSocket,
  io: () => io
});
module.exports = __toCommonJS(socket_exports);
var import_socket2 = require("socket.io");

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
var kafkaBroker = process.env.KAFKA_BROKER || "localhost:9092";
var clientId = process.env.KAFKA_CLIENT_ID || "marketos-backend";
var kafka = new import_kafkajs.Kafka({
  clientId,
  brokers: [kafkaBroker],
  // Reduce retry aggressiveness so startup isn't blocked for minutes
  retry: {
    retries: 3,
    initialRetryTime: 300,
    maxRetryTime: 3e3
  }
});
var producer = kafka.producer();
var consumer = kafka.consumer({ groupId: "marketos-group" });

// src/modules/agents/service.ts
var AgentsService = class {
  repository = new AgentsRepository();
  getAllAgents() {
    return this.repository.getAllAgents();
  }
  getAgentByType(type) {
    return this.repository.getAgentByType(type);
  }
  getAgentTasks(type, status, page = 1, limit = 20) {
    return this.repository.getAgentTasks(type, status, page, limit);
  }
  getAgentMemory(type, memType, search, page = 1, limit = 20) {
    return this.repository.getAgentMemory(type, memType, search, page, limit);
  }
  async executeCommand(type, payload) {
    try {
      const topic = `agent.${type.toLowerCase()}.commands`;
      await producer.send({
        topic,
        messages: [
          { value: JSON.stringify(payload) }
        ]
      });
      logger.info(`Successfully dispatched command to topic ${topic}`);
      return true;
    } catch (error) {
      logger.error("Failed to dispatch command to Kafka:", error);
      return false;
    }
  }
};

// src/lib/socket.ts
var io;
function jitter(base, pct = 0.05) {
  return parseFloat((base * (1 + (Math.random() * 2 - 1) * pct)).toFixed(2));
}
function buildAnalyticsSnapshot() {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
  const activeAgents = agents.filter((a) => a.status === "RUNNING");
  const avgSuccessRate = activeAgents.length > 0 ? activeAgents.reduce((acc, a) => acc + a.successRate, 0) / activeAgents.length : 90;
  const totalTokens = agents.reduce((acc, a) => acc + a.tokenUsage, 0);
  const totalCost = agents.reduce((acc, a) => acc + a.costUsd, 0);
  const performanceMultiplier = activeAgents.length / agents.length * (avgSuccessRate / 100);
  const baseRevenue = 124e4;
  const currentRevenue = baseRevenue * (0.5 + performanceMultiplier * 0.8);
  return {
    executive: {
      revenue: jitter(currentRevenue, 0.02),
      pipeline: jitter(currentRevenue * 4.5, 0.02),
      cac: jitter(124.5 + totalCost / 10, 0.04),
      // AI costs increase CAC slightly
      ltv: jitter(4800 * (avgSuccessRate / 100), 0.02),
      roas: jitter(4.2 * (avgSuccessRate / 100), 0.05),
      // Better agent success = better ROAS
      conversionRate: jitter(3.47 * (avgSuccessRate / 100), 0.06)
    },
    funnel: [
      { stage: "IMPRESSION", count: Math.round(jitter(164e4, 0.01)), convRate: 100, dropoffRate: 0 },
      { stage: "CLICK", count: Math.round(jitter(42300, 0.04)), convRate: jitter(2.58, 0.05), dropoffRate: jitter(97.42, 0.01) },
      { stage: "VISIT", count: Math.round(jitter(38100, 0.04)), convRate: jitter(90.1, 0.02), dropoffRate: jitter(9.9, 0.05) },
      { stage: "LEAD", count: Math.round(jitter(12400, 0.05)), convRate: jitter(32.5, 0.04), dropoffRate: jitter(67.5, 0.02) },
      { stage: "MQL", count: Math.round(jitter(1870, 0.06)), convRate: jitter(15.1, 0.05), dropoffRate: jitter(84.9, 0.02) },
      { stage: "SQL", count: Math.round(jitter(430, 0.08)), convRate: jitter(23, 0.06), dropoffRate: jitter(77, 0.03) },
      { stage: "CUSTOMER", count: Math.round(jitter(186, 0.1)), convRate: jitter(43.3, 0.07), dropoffRate: jitter(56.7, 0.04) }
    ],
    attribution: [
      { channel: "EMAIL", contribution: jitter(34.2, 0.03), revenue: jitter(424080, 0.03) },
      { channel: "PAID_ADS", contribution: jitter(28.7, 0.03), revenue: jitter(355880, 0.03) },
      { channel: "SOCIAL", contribution: jitter(22.1, 0.04), revenue: jitter(274040, 0.04) },
      { channel: "SMS", contribution: jitter(15, 0.05), revenue: jitter(186e3, 0.05) }
    ],
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function buildDashboardSnapshot() {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
  const activeAgents = agents.filter((a) => a.status === "RUNNING");
  const performanceMultiplier = agents.length > 0 ? activeAgents.length / agents.length : 1;
  const avgSuccessRate = activeAgents.length > 0 ? activeAgents.reduce((acc, a) => acc + a.successRate, 0) / activeAgents.length : 90;
  const baseRevenue = 124e4;
  const currentRevenue = baseRevenue * (0.5 + performanceMultiplier * 0.8);
  return {
    kpis: {
      totalCampaigns: 12,
      activeCampaigns: Math.round(jitter(12 * performanceMultiplier, 0.1)),
      // More active agents = more active campaigns
      totalLeads: Math.round(jitter(12400 * (avgSuccessRate / 100), 0.03)),
      revenue: jitter(currentRevenue, 0.02),
      roas: jitter(4.2 * (avgSuccessRate / 100), 0.05)
    },
    agents,
    campaignHealth: [
      { campaignId: "c1", campaignName: "Q4 Product Launch", healthScore: jitter(91.2 * performanceMultiplier, 0.03), roas: jitter(5.1 * performanceMultiplier, 0.04), ctr: jitter(3.2, 0.05), conversionRate: jitter(4.1, 0.04), budgetStatus: "ON_TRACK" },
      { campaignId: "c2", campaignName: "Summer Sale", healthScore: jitter(74.3 * performanceMultiplier, 0.04), roas: jitter(2.8 * performanceMultiplier, 0.05), ctr: jitter(1.9, 0.06), conversionRate: jitter(2.3, 0.05), budgetStatus: "AT_RISK" }
    ],
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var initSocket = (server) => {
  const corsOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : "*";
  io = new import_socket2.Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id}`);
    socket.emit("analytics:update", buildAnalyticsSnapshot());
    socket.emit("dashboard:update", buildDashboardSnapshot());
    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
  setInterval(() => {
    if (io.engine.clientsCount > 0) {
      io.emit("analytics:update", buildAnalyticsSnapshot());
      io.emit("dashboard:update", buildDashboardSnapshot());
    }
  }, 5e3);
  return io;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  initSocket,
  io
});
