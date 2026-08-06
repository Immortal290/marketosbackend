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

// src/lib/kafka.ts
var kafka_exports = {};
__export(kafka_exports, {
  connectKafka: () => connectKafka,
  kafka: () => kafka,
  producer: () => producer,
  resultConsumer: () => resultConsumer
});
module.exports = __toCommonJS(kafka_exports);
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
var RESULT_TOPICS = [
  "campaign.events",
  // Worker publishes campaign_completed / campaign_failed here
  "agent.supervisor.results",
  // Supervisor agent result events
  "agent.dlq"
  // Dead-letter queue (failed tasks)
];
var connectKafka = async () => {
  if (!process.env.KAFKA_BROKER) {
    logger.warn("[Kafka] KAFKA_BROKER env not set \u2014 skipping Kafka connection. Real-time agent events disabled.");
    return;
  }
  try {
    await producer.connect();
    logger.info(`[Kafka] Producer connected to ${kafkaBroker}`);
    await resultConsumer.connect();
    logger.info("[Kafka] Result consumer connected");
    await resultConsumer.subscribe({
      topics: RESULT_TOPICS,
      fromBeginning: false
    });
    logger.info(`[Kafka] Result consumer subscribed to: ${RESULT_TOPICS.join(", ")}`);
    await resultConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const raw = message.value.toString();
        let envelope;
        try {
          envelope = JSON.parse(raw);
        } catch (parseErr) {
          logger.error(`[Kafka] JSON parse error on ${topic}: ${parseErr}`);
          return;
        }
        const payload = envelope?.payload || envelope;
        const campaignId = payload?.campaign_id || payload?.campaignId || "unknown";
        const event = payload?.event || "unknown";
        const status = event === "campaign_completed" ? "completed" : event === "campaign_failed" ? "failed" : "processing";
        logger.info(`[Kafka][RESULT CONSUMED] job_id=${campaignId} event=${event} topic=${topic} partition=${partition}`);
        try {
          const cachePayload = JSON.stringify({
            campaign_id: campaignId,
            status,
            event,
            payload,
            received_at: (/* @__PURE__ */ new Date()).toISOString()
          });
          await redisClient.set(`job:${campaignId}:result`, cachePayload, "EX", 3600);
          logger.info(`[Kafka][REDIS WRITTEN] job_id=${campaignId} status=${status}`);
        } catch (redisErr) {
          logger.error(`[Kafka][REDIS WRITE FAILED] job_id=${campaignId}: ${redisErr}`);
        }
        if (io) {
          try {
            io.emit("agentEvent", { topic, campaignId, event, payload });
            logger.info(`[Kafka][SOCKET EMITTED] job_id=${campaignId} event=${event}`);
          } catch (socketErr) {
            logger.warn(`[Kafka][SOCKET EMIT FAILED] ${socketErr}`);
          }
        }
      }
    });
    logger.info("[Kafka] Result consumer running persistently \u2014 listening for campaign events...");
  } catch (error) {
    logger.error("[Kafka] Connection failed (non-fatal). Kafka-dependent features will be unavailable:", error);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  connectKafka,
  kafka,
  producer,
  resultConsumer
});
