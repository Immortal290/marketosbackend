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

// src/modules/history/routes.ts
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

// src/modules/history/routes.ts
var router = (0, import_express.Router)();
async function getUserId(req) {
  const userId = req.user?.userId;
  if (userId) return userId;
  try {
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "dev@marketos.local",
          name: "Dev User",
          role: "admin"
        }
      });
    }
    return user.id;
  } catch (e) {
    return null;
  }
}
router.get("/", async (req, res) => {
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
router.get("/:id", async (req, res) => {
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
router.post("/", async (req, res) => {
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
router.delete("/:id", async (req, res) => {
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
router.post("/:id/dispatch", async (req, res) => {
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
var routes_default = router;
