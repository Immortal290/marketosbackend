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

// src/modules/audience/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");

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

// src/lib/kafka.ts
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

// src/modules/audience/routes.ts
var router = (0, import_express.Router)();
router.get("/contacts", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.get("/contacts/:id", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, email: "contact@example.com", firstName: "Jane", lastName: "Smith", leadScore: 72, lifecycleStage: "MQL" } });
});
router.post("/contacts", (req, res) => {
  res.status(201).json({ success: true, data: { id: "new-uuid", ...req.body, leadScore: 0, createdAt: (/* @__PURE__ */ new Date()).toISOString() } });
});
router.patch("/contacts/:id", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, ...req.body } });
});
router.delete("/contacts/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
router.get("/segments", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.post("/segments", (req, res) => {
  res.status(201).json({ success: true, data: { id: "new-uuid", ...req.body, size: 0, createdAt: (/* @__PURE__ */ new Date()).toISOString() } });
});
router.delete("/segments/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
router.get("/lead-scores", (req, res) => {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
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
router.get("/personas", (req, res) => {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
  const activeAgents = agents.filter((a) => a.status === "RUNNING");
  const mult = activeAgents.length / agents.length || 0.5;
  res.status(200).json({ success: true, data: [
    { id: "p1", name: "Enterprise CTO", description: "Technical leader at 500+ employee companies", size: Math.round(2840 * mult), traits: ["technical", "risk-averse", "ROI-focused"] },
    { id: "p2", name: "SMB Founder", description: "Owner of 10-50 employee companies", size: Math.round(5120 * mult), traits: ["budget-conscious", "growth-driven", "hands-on"] }
  ] });
});
router.get("/lifecycle", (req, res) => {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
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
var routes_default = router;
