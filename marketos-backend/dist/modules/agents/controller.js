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

// src/modules/agents/controller.ts
var controller_exports = {};
__export(controller_exports, {
  AgentsController: () => AgentsController
});
module.exports = __toCommonJS(controller_exports);

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

// src/modules/agents/controller.ts
var AgentsController = class {
  service = new AgentsService();
  getAllAgents = (req, res, next) => {
    try {
      const agents = this.service.getAllAgents();
      res.status(200).json({ success: true, data: agents });
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentsController
});
