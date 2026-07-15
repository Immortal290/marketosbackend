"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/server.ts
var import_dotenv = __toESM(require("dotenv"));
var import_http = require("http");
var import_child_process = require("child_process");
var import_util = require("util");

// src/app.ts
var import_express18 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));
var import_compression = __toESM(require("compression"));
var import_morgan = __toESM(require("morgan"));

// src/middlewares/error.middleware.ts
var import_zod = require("zod");
var import_http_status_codes = require("http-status-codes");

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

// src/middlewares/error.middleware.ts
var errorHandler = (err, req, res, next) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });
  if (err instanceof import_zod.ZodError) {
    return res.status(import_http_status_codes.StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Validation failed",
      errors: err.errors
    });
  }
  if (err.name === "UnauthorizedError") {
    return res.status(import_http_status_codes.StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Unauthorized"
    });
  }
  return res.status(err.status || import_http_status_codes.StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
};

// src/lib/swagger.ts
var import_swagger_ui_express = __toESM(require("swagger-ui-express"));
var import_swagger_jsdoc = __toESM(require("swagger-jsdoc"));
var swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MarketOS API",
      version: "1.0.0",
      description: "Enterprise-grade AI-powered marketing operations platform API. Use the Authorize button to supply a JWT Bearer token for protected endpoints.",
      contact: { name: "MarketOS Engineering" }
    },
    servers: [
      { url: "http://localhost:3000/api/v1", description: "Local Development" },
      { url: "http://localhost:3000", description: "Health / System endpoints" }
    ],
    tags: [
      { name: "System", description: "Health checks and system status" },
      { name: "Auth", description: "Authentication \u2013 register, login, token refresh" },
      { name: "Dashboard", description: "Executive KPI grid, activity feed, agent status" },
      { name: "Campaigns", description: "Campaign lifecycle management \u2013 CRUD, launch, pause" },
      { name: "Campaign Detail", description: "Per-campaign deep-dive: overview, audience, assets, channels, A/B tests, analytics, finance" },
      { name: "Analytics", description: "Executive dashboard, attribution, funnel, journey and cohort analytics" },
      { name: "Audience", description: "Contacts, segments, lead scores, personas and lifecycle stages" },
      { name: "Settings", description: "Workspace, team, integrations, compliance, billing and security settings" },
      { name: "AI Command Center", description: "Natural language commands, agent monitor, task explorer, supervisor decisions, agent memory, automation rules" },
      { name: "Creative Studio", description: "Asset library, brand kit, AI-generated creatives, templates, design editor" },
      { name: "Reports", description: "Scheduled, custom and executive reports + exports" },
      { name: "Competitive Intelligence", description: "Competitor tracking, ad monitoring, pricing changes, SEO comparison, opportunity feed" },
      { name: "Finance & ROI", description: "Spend dashboard, revenue attribution, ROAS analysis, budget controls, forecasting" },
      { name: "Monitoring & Alerts", description: "Health dashboard, alert center, incident history, auto-remediation" },
      { name: "Audit Logs", description: "Activity, agent, API, compliance logs and live event stream" },
      { name: "Agents", description: "AI agent status, memory, tasks and direct command interface" },
      { name: "Workflow Engine", description: "Agent DAG, execution flow, dependencies and automation builder" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token obtained from POST /auth/login"
        }
      },
      parameters: {
        workspaceId: {
          name: "workspaceId",
          in: "query",
          required: true,
          description: "UUID of the workspace",
          schema: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
        },
        resourceId: {
          name: "id",
          in: "path",
          required: true,
          description: "Resource UUID",
          schema: { type: "string", format: "uuid" }
        },
        page: {
          name: "page",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, default: 1 }
        },
        limit: {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }
        },
        campaignId: {
          name: "campaignId",
          in: "path",
          required: true,
          description: "Campaign UUID",
          schema: { type: "string", format: "uuid" }
        }
      },
      schemas: {
        /* ── Generic wrappers ──────────────────────────────────────── */
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { description: "Response payload (type varies per endpoint)" }
          }
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { type: "array", items: {} },
            meta: { $ref: "#/components/schemas/PaginationMeta" }
          }
        },
        PaginationMeta: {
          type: "object",
          properties: {
            total: { type: "integer", example: 150 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 20 },
            pages: { type: "integer", example: 8 }
          }
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string", example: "Resource not found" },
            code: { type: "string", example: "NOT_FOUND" }
          }
        },
        ValidationError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string", example: "Validation failed" },
            details: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" }
                }
              }
            }
          }
        },
        /* ── Auth ──────────────────────────────────────────────────── */
        RegisterRequest: {
          type: "object",
          required: ["email", "password", "firstName", "lastName", "workspaceName"],
          properties: {
            email: { type: "string", format: "email", example: "john@acme.com" },
            password: { type: "string", minLength: 8, example: "S3cur3Pass!" },
            firstName: { type: "string", example: "John" },
            lastName: { type: "string", example: "Doe" },
            workspaceName: { type: "string", example: "Acme Corp" }
          }
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "john@acme.com" },
            password: { type: "string", example: "S3cur3Pass!" }
          }
        },
        AuthTokens: {
          type: "object",
          properties: {
            accessToken: { type: "string", example: "eyJhbGci..." },
            refreshToken: { type: "string", example: "eyJhbGci..." },
            expiresIn: { type: "integer", example: 3600 }
          }
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            role: { type: "string", enum: ["OWNER", "ADMIN", "MEMBER", "VIEWER"] },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        /* ── Campaigns ─────────────────────────────────────────────── */
        Campaign: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Q4 Product Launch" },
            status: { type: "string", enum: ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] },
            workspaceId: { type: "string", format: "uuid" },
            healthScore: { type: "number", format: "float", example: 87.5 },
            roas: { type: "number", format: "float", example: 4.2 },
            budget: { type: "number", format: "float", example: 5e4 },
            spend: { type: "number", format: "float", example: 23400 },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        },
        CreateCampaignRequest: {
          type: "object",
          required: ["name", "workspaceId"],
          properties: {
            name: { type: "string", example: "Summer Sale Campaign" },
            workspaceId: { type: "string", format: "uuid" },
            budget: { type: "number", example: 1e4 },
            channels: { type: "array", items: { type: "string", enum: ["EMAIL", "SMS", "SOCIAL", "PAID_ADS"] } },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" }
          }
        },
        UpdateCampaignRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            status: { type: "string", enum: ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"] },
            budget: { type: "number" }
          }
        },
        CampaignStats: {
          type: "object",
          properties: {
            total: { type: "integer", example: 42 },
            active: { type: "integer", example: 8 },
            paused: { type: "integer", example: 3 },
            scheduled: { type: "integer", example: 5 },
            completed: { type: "integer", example: 26 }
          }
        },
        /* ── Dashboard ─────────────────────────────────────────────── */
        KpiGrid: {
          type: "object",
          properties: {
            revenueInfluenced: { type: "number", example: 12e5 },
            revenueGenerated: { type: "number", example: 34e4 },
            pipelineGenerated: { type: "number", example: 56e5 },
            leadsGenerated: { type: "integer", example: 12400 },
            mqls: { type: "integer", example: 1870 },
            sqls: { type: "integer", example: 430 },
            conversionRate: { type: "number", example: 3.47 },
            activeCampaigns: { type: "integer", example: 8 },
            activeAgents: { type: "integer", example: 11 },
            roas: { type: "number", example: 4.2 }
          }
        },
        ActivityEvent: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            type: { type: "string", enum: ["AGENT_EVENT", "CAMPAIGN_EVENT", "COMPLIANCE_EVENT", "SYSTEM_EVENT"] },
            message: { type: "string" },
            severity: { type: "string", enum: ["INFO", "WARNING", "ERROR", "CRITICAL"] },
            timestamp: { type: "string", format: "date-time" },
            metadata: { type: "object" }
          }
        },
        AlertItem: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            type: { type: "string", enum: ["CRITICAL", "WARNING", "CAMPAIGN", "INFRASTRUCTURE"] },
            title: { type: "string" },
            message: { type: "string" },
            resolved: { type: "boolean" },
            timestamp: { type: "string", format: "date-time" }
          }
        },
        /* ── Agents ────────────────────────────────────────────────── */
        Agent: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "CopyAgent" },
            type: { type: "string", enum: ["SUPERVISOR", "COPY", "CREATIVE", "ANALYTICS", "COMPLIANCE", "EMAIL", "SMS", "SOCIAL", "SEO", "COMPETITOR", "FINANCE"] },
            status: { type: "string", enum: ["IDLE", "RUNNING", "PAUSED", "ERROR", "STOPPED"] },
            currentTask: { type: "string", example: "Generating email subject lines" },
            queueLength: { type: "integer", example: 3 },
            successRate: { type: "number", example: 98.4 },
            runtimeMs: { type: "integer", example: 142e3 },
            tokenUsage: { type: "integer", example: 48300 },
            costUsd: { type: "number", example: 0.97 }
          }
        },
        /* ── Audience ──────────────────────────────────────────────── */
        Contact: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            phone: { type: "string" },
            leadScore: { type: "integer", example: 72 },
            lifecycleStage: { type: "string", enum: ["LEAD", "MQL", "SQL", "OPPORTUNITY", "CUSTOMER", "EVANGELIST"] },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        Segment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "High-Value Leads" },
            description: { type: "string" },
            size: { type: "integer", example: 3420 },
            rules: { type: "object", description: "Segment filter rules" },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        /* ── Competitive Intelligence ──────────────────────────────── */
        Competitor: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "RivalCo" },
            website: { type: "string", format: "uri" },
            adSpend: { type: "number", example: 25e4 },
            keywords: { type: "array", items: { type: "string" } }
          }
        },
        /* ── Finance ───────────────────────────────────────────────── */
        SpendSummary: {
          type: "object",
          properties: {
            totalBudget: { type: "number", example: 5e5 },
            totalSpend: { type: "number", example: 214300 },
            remainingBudget: { type: "number", example: 285700 },
            projectedSpend: { type: "number", example: 49e4 },
            roas: { type: "number", example: 4.2 },
            roi: { type: "number", example: 3.2 }
          }
        },
        /* ── Monitoring ────────────────────────────────────────────── */
        HealthStatus: {
          type: "object",
          properties: {
            overall: { type: "string", enum: ["HEALTHY", "DEGRADED", "CRITICAL"] },
            api: { type: "string", enum: ["HEALTHY", "DEGRADED", "CRITICAL"] },
            database: { type: "string", enum: ["HEALTHY", "DEGRADED", "CRITICAL"] },
            redis: { type: "string", enum: ["HEALTHY", "DEGRADED", "CRITICAL"] },
            kafka: { type: "string", enum: ["HEALTHY", "DEGRADED", "CRITICAL"] },
            agents: { type: "string", enum: ["HEALTHY", "DEGRADED", "CRITICAL"] },
            uptime: { type: "number", example: 99.97 },
            checkedAt: { type: "string", format: "date-time" }
          }
        },
        /* ── Reports ───────────────────────────────────────────────── */
        Report: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Q4 Executive Report" },
            type: { type: "string", enum: ["SCHEDULED", "CUSTOM", "EXECUTIVE"] },
            format: { type: "string", enum: ["PDF", "CSV", "EXCEL", "JSON"] },
            status: { type: "string", enum: ["PENDING", "GENERATING", "READY", "FAILED"] },
            downloadUrl: { type: "string", format: "uri" },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        /* ── Creative Studio ───────────────────────────────────────── */
        Asset: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            type: { type: "string", enum: ["IMAGE", "VIDEO", "COPY", "TEMPLATE", "LANDING_PAGE"] },
            url: { type: "string", format: "uri" },
            tags: { type: "array", items: { type: "string" } },
            createdAt: { type: "string", format: "date-time" }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  // NOTE: apis array points to source files for JSDoc scanning.
  // In production (Docker), src/ does not exist — only dist/ does.
  // We define the full OpenAPI spec inline above, so no file scanning is needed.
  apis: []
};
var swaggerSpec = (0, import_swagger_jsdoc.default)(swaggerOptions);
var setupSwagger = (app2) => {
  app2.use(
    "/api-docs",
    import_swagger_ui_express.default.serve,
    import_swagger_ui_express.default.setup(swaggerSpec, {
      explorer: true,
      customSiteTitle: "MarketOS API Docs",
      swaggerOptions: {
        docExpansion: "list",
        filter: true,
        showRequestDuration: true,
        persistAuthorization: true
      }
    })
  );
};

// src/routes.ts
var import_express17 = require("express");

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
var import_http_status_codes2 = require("http-status-codes");
var AuthController = class {
  service = new AuthService();
  register = async (req, res, next) => {
    try {
      const tokens = await this.service.register(req.body);
      res.status(import_http_status_codes2.StatusCodes.CREATED).json({
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
      res.status(import_http_status_codes2.StatusCodes.OK).json({
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
        return res.status(import_http_status_codes2.StatusCodes.BAD_REQUEST).json({
          success: false,
          error: "refreshToken is required"
        });
      }
      const tokens = await this.service.refresh(refreshToken);
      res.status(import_http_status_codes2.StatusCodes.OK).json({
        success: true,
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  };
  logout = async (req, res, next) => {
    try {
      res.status(import_http_status_codes2.StatusCodes.OK).json({
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
      res.status(import_http_status_codes2.StatusCodes.OK).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  };
};

// src/middlewares/validate.middleware.ts
var import_zod2 = require("zod");
var import_http_status_codes3 = require("http-status-codes");
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
      console.log("IS ZOD ERROR?", error instanceof import_zod2.ZodError);
      if (error instanceof import_zod2.ZodError) {
        return res.status(import_http_status_codes3.StatusCodes.BAD_REQUEST).json({
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
var import_zod3 = require("zod");
var registerSchema = import_zod3.z.object({
  body: import_zod3.z.object({
    email: import_zod3.z.string().email(),
    password: import_zod3.z.string().min(8),
    firstName: import_zod3.z.string().optional(),
    lastName: import_zod3.z.string().optional(),
    workspaceName: import_zod3.z.string().optional()
  })
});
var loginSchema = import_zod3.z.object({
  body: import_zod3.z.object({
    email: import_zod3.z.string().email(),
    password: import_zod3.z.string()
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
var import_http_status_codes4 = require("http-status-codes");
var DashboardController = class {
  service = new DashboardService();
  getKpis = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes4.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const kpis = await this.service.getKpis(workspaceId);
      res.status(import_http_status_codes4.StatusCodes.OK).json({ success: true, data: kpis });
    } catch (error) {
      next(error);
    }
  };
  getActivityFeed = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes4.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const feed = await this.service.getActivityFeed(workspaceId);
      res.status(import_http_status_codes4.StatusCodes.OK).json({ success: true, data: feed });
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

// src/lib/socket.ts
var import_socket = require("socket.io");
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
var initSocket = (server2) => {
  const corsOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : "*";
  io = new import_socket.Server(server2, {
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
var connectKafka = async () => {
  if (!process.env.KAFKA_BROKER) {
    logger.warn("[Kafka] KAFKA_BROKER env not set \u2014 skipping Kafka connection. Real-time agent events disabled.");
    return;
  }
  try {
    await producer.connect();
    logger.info("[Kafka] Producer connected");
    await consumer.connect();
    logger.info("[Kafka] Consumer connected");
    const topics = Object.values(AgentType).map((type) => [
      `agent.${type.toLowerCase()}.responses`,
      `agent.${type.toLowerCase()}.events`
    ]).flat();
    await consumer.subscribe({ topics, fromBeginning: false });
    logger.info(`[Kafka] Subscribed to ${topics.length} agent topics`);
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (message.value) {
          const payload = message.value.toString();
          logger.info(`[Kafka] Message from ${topic}: ${payload}`);
          if (io) {
            io.emit("agentEvent", { topic, payload: JSON.parse(payload) });
          }
        }
      }
    });
  } catch (error) {
    logger.error("[Kafka] Connection failed (non-fatal). Kafka-dependent features (agent event streaming) will be unavailable:", error);
  }
};

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

// src/modules/dashboard/routes.ts
var router3 = (0, import_express3.Router)();
var controller2 = new DashboardController();
router3.get("/kpis", controller2.getKpis);
router3.get("/activity", controller2.getActivityFeed);
router3.get("/agents", (req, res) => {
  const agentsService = new AgentsService();
  res.status(200).json({
    success: true,
    data: agentsService.getAllAgents()
  });
});
router3.get("/alerts", (req, res) => {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
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
router3.get("/campaign-health", (req, res) => {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
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
var import_http_status_codes5 = require("http-status-codes");
var CampaignsController = class {
  service = new CampaignsService();
  // Assuming workspaceId is passed either in body, query, or via a middleware that extracts it from user tokens
  // For simplicity, let's extract it from query or body for now.
  getAll = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes5.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const campaigns = await this.service.getAll(workspaceId);
      res.status(import_http_status_codes5.StatusCodes.OK).json({ success: true, data: campaigns });
    } catch (error) {
      next(error);
    }
  };
  getById = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes5.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const campaign = await this.service.getById(req.params.id, workspaceId);
      res.status(import_http_status_codes5.StatusCodes.OK).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };
  create = async (req, res, next) => {
    try {
      const campaign = await this.service.create(req.body);
      res.status(import_http_status_codes5.StatusCodes.CREATED).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };
  update = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes5.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const campaign = await this.service.update(req.params.id, workspaceId, req.body);
      res.status(import_http_status_codes5.StatusCodes.OK).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };
  delete = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes5.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      await this.service.delete(req.params.id, workspaceId);
      res.status(import_http_status_codes5.StatusCodes.OK).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  };
};

// src/modules/campaigns/validator.ts
var import_zod4 = require("zod");
var createCampaignSchema = import_zod4.z.object({
  body: import_zod4.z.object({
    name: import_zod4.z.string().min(1, "Name is required"),
    workspaceId: import_zod4.z.string().uuid()
  })
});
var updateCampaignSchema = import_zod4.z.object({
  body: import_zod4.z.object({
    name: import_zod4.z.string().optional(),
    status: import_zod4.z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).optional()
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
router7.get("/lead-scores", (req, res) => {
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
router7.get("/personas", (req, res) => {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
  const activeAgents = agents.filter((a) => a.status === "RUNNING");
  const mult = activeAgents.length / agents.length || 0.5;
  res.status(200).json({ success: true, data: [
    { id: "p1", name: "Enterprise CTO", description: "Technical leader at 500+ employee companies", size: Math.round(2840 * mult), traits: ["technical", "risk-averse", "ROI-focused"] },
    { id: "p2", name: "SMB Founder", description: "Owner of 10-50 employee companies", size: Math.round(5120 * mult), traits: ["budget-conscious", "growth-driven", "hands-on"] }
  ] });
});
router7.get("/lifecycle", (req, res) => {
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
router8.get("/agents", (req, res) => {
  const agents = ["SUPERVISOR", "COPY", "CREATIVE", "ANALYTICS", "COMPLIANCE", "EMAIL", "SMS", "SOCIAL", "SEO", "COMPETITOR", "FINANCE"];
  res.status(200).json({ success: true, data: agents.map((type, i) => ({ id: `agent-${i}`, name: `${type.charAt(0)}${type.slice(1).toLowerCase()}Agent`, type, status: i < 3 ? "RUNNING" : "IDLE", queueLength: i < 3 ? 2 : 0, successRate: 97 + Math.random() * 2 })) });
});
router8.get("/tasks", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router8.get("/decisions", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "d1", decision: "Pause underperforming ad set B", reasoning: "CTR dropped 40% over 3 days with no conversions", confidence: 0.91, outcome: "EXECUTED", timestamp: (/* @__PURE__ */ new Date()).toISOString() }
  ] });
});
router8.get("/memory", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
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
var routes_default8 = router8;

// src/modules/agents/routes.ts
var import_express9 = require("express");

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

// src/modules/agents/routes.ts
var router9 = (0, import_express9.Router)();
var controller4 = new AgentsController();
router9.get("/", controller4.getAllAgents);
router9.get("/:agentType", controller4.getAgentByType);
router9.get("/:agentType/tasks", controller4.getAgentTasks);
router9.get("/:agentType/memory", controller4.getAgentMemory);
router9.post("/:agentType/command", controller4.executeCommand);
var routes_default9 = router9;

// src/modules/workflow_engine/routes.ts
var import_express10 = require("express");
var router10 = (0, import_express10.Router)();
router10.get("/graph", (req, res) => {
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
router10.get("/executions", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router10.get("/executions/:id", (req, res) => {
  res.status(200).json({ success: true, data: { execution: { id: req.params.id }, steps: [] } });
});
router10.post("/executions/:id/cancel", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: "CANCELLED" } });
});
router10.get("/dependencies", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      parallelGroups: [["CopyAgent", "CreativeAgent"], ["EmailAgent", "SmsAgent", "SocialAgent"], ["AnalyticsAgent"]],
      criticalPath: ["SupervisorAgent", "CopyAgent", "ComplianceAgent", "EmailAgent", "AnalyticsAgent"]
    }
  });
});
router10.get("/automation", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "wf1", name: "Full Campaign Launch Workflow", description: "End-to-end workflow from brief to launch", steps: 8, lastRun: null, enabled: true },
    { id: "wf2", name: "Re-engagement Workflow", description: "Automated re-engagement sequence for cold leads", steps: 5, lastRun: "2026-06-01T10:00:00Z", enabled: true }
  ] });
});
router10.post("/automation/:id/trigger", (req, res) => {
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
router14.get("/executive", (req, res) => {
  const agentsService = new AgentsService();
  const agents = agentsService.getAllAgents();
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

// src/routes.ts
var router17 = (0, import_express17.Router)();
router17.use("/auth", routes_default);
router17.use("/settings", routes_default2);
router17.use("/dashboard", routes_default3);
router17.use("/campaigns", routes_default4);
router17.use("/campaign-detail", routes_default5);
router17.use("/analytics", routes_default6);
router17.use("/audience", routes_default7);
router17.use("/ai-command-center", routes_default8);
router17.use("/agents", routes_default9);
router17.use("/workflow-engine", routes_default10);
router17.use("/creative-studio", routes_default11);
router17.use("/competitive-intelligence", routes_default12);
router17.use("/finance", routes_default13);
router17.use("/reports", routes_default14);
router17.use("/monitoring", routes_default15);
router17.use("/audit-logs", routes_default16);
var routes_default17 = router17;

// src/app.ts
var app = (0, import_express18.default)();
var allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()) : ["*"];
app.use(
  (0, import_cors.default)({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin) || origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1") || origin.includes("railway.app") || origin.includes("vercel.app")) {
        return callback(null, true);
      }
      console.warn(`[CORS Warning] Permitting origin for compatibility: ${origin}`);
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-workspace-id", "Accept", "X-Requested-With"]
  })
);
app.use((0, import_compression.default)());
app.use(import_express18.default.json());
app.use(import_express18.default.urlencoded({ extended: true }));
app.use((0, import_morgan.default)("dev"));
setupSwagger(app);
var FRONTEND_URL = (process.env.FRONTEND_URL || "https://digitalmarketingagent-production.up.railway.app").replace(/\/$/, "");
app.get("/", (_req, res) => res.redirect(302, FRONTEND_URL));
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.use("/api/v1", routes_default17);
app.use(errorHandler);
var app_default = app;

// src/server.ts
import_dotenv.default.config();
var execAsync = (0, import_util.promisify)(import_child_process.exec);
var PORT = process.env.PORT || 3e3;
var server = (0, import_http.createServer)(app_default);
var startServer = async () => {
  await new Promise((resolve) => {
    server.listen(PORT, () => {
      logger.info(`[Server] Listening on port ${PORT}`);
      resolve();
    });
  });
  initSocket(server);
  try {
    logger.info("[DB] Running prisma migrate deploy\u2026");
    const { stdout, stderr } = await execAsync("node node_modules/.bin/prisma migrate deploy");
    if (stdout) logger.info("[DB] Migrations:", stdout.trim());
    if (stderr) logger.warn("[DB] Migration stderr:", stderr.trim());
    logger.info("[DB] Migrations applied successfully");
  } catch (err) {
    logger.error("[DB] Migration failed (continuing \u2014 DB may already be up to date):", err);
  }
  try {
    await prisma.$connect();
    logger.info("[DB] Connected to PostgreSQL via Prisma");
  } catch (error) {
    logger.error("[DB] Failed to connect to PostgreSQL:", error);
  }
  connectKafka().catch((err) => {
    logger.error("[Kafka] Unexpected error during connection:", err);
  });
  logger.info("[Server] MarketOS backend fully initialised.");
};
process.on("SIGTERM", async () => {
  logger.info("[Shutdown] SIGTERM received \u2014 closing server\u2026");
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("[Shutdown] Server closed. Goodbye.");
    process.exit(0);
  });
});
process.on("unhandledRejection", (reason) => {
  logger.error("[UnhandledRejection]", reason);
});
startServer().catch((err) => {
  logger.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
