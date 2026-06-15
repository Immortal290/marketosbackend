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

// src/app.ts
var app_exports = {};
__export(app_exports, {
  default: () => app_default
});
module.exports = __toCommonJS(app_exports);
var import_express18 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));
var import_helmet = __toESM(require("helmet"));
var import_compression = __toESM(require("compression"));
var import_morgan = __toESM(require("morgan"));

// src/middlewares/error.middleware.ts
var import_zod = require("zod");
var import_http_status_codes = require("http-status-codes");

// src/lib/logger.ts
var import_winston = __toESM(require("winston"));
var { combine, timestamp, printf, colorize } = import_winston.default.format;
var customFormat = printf(({ level, message, timestamp: timestamp2, ...metadata }) => {
  let msg = `${timestamp2} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});
var logger = import_winston.default.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    import_winston.default.format.json()
  ),
  transports: [
    new import_winston.default.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        customFormat
      )
    }),
    new import_winston.default.transports.File({ filename: "logs/error.log", level: "error" }),
    new import_winston.default.transports.File({ filename: "logs/combined.log" })
  ]
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
var swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "MarketOS API",
    version: "1.0.0",
    description: "API documentation for MarketOS Backend"
  },
  servers: [
    {
      url: "http://localhost:3000/api/v1",
      description: "Development server"
    }
  ],
  paths: {
    "/health": {
      get: {
        summary: "Check API Health",
        responses: {
          "200": {
            description: "Successful operation",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    timestamp: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
var setupSwagger = (app2) => {
  app2.use("/api-docs", import_swagger_ui_express.default.serve, import_swagger_ui_express.default.setup(swaggerDocument));
};

// src/routes.ts
var import_express17 = require("express");

// src/modules/auth/routes.ts
var import_express = require("express");

// src/modules/auth/service.ts
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));

// src/lib/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();

// src/modules/auth/service.ts
var JWT_SECRET = process.env.JWT_SECRET || "secret";
var JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
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
  generateTokens(userId) {
    const accessToken = import_jsonwebtoken.default.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return { accessToken };
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
    lastName: import_zod3.z.string().optional()
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
var routes_default = router;

// src/modules/settings/routes.ts
var import_express2 = require("express");
var router2 = (0, import_express2.Router)();
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

// src/modules/dashboard/routes.ts
var router3 = (0, import_express3.Router)();
var controller2 = new DashboardController();
router3.get("/kpis", controller2.getKpis);
router3.get("/activity", controller2.getActivityFeed);
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
router4.get("/:id", controller3.getById);
router4.post("/", validate(createCampaignSchema), controller3.create);
router4.patch("/:id", validate(updateCampaignSchema), controller3.update);
router4.delete("/:id", controller3.delete);
var routes_default4 = router4;

// src/modules/campaign_detail/routes.ts
var import_express5 = require("express");
var router5 = (0, import_express5.Router)();
var routes_default5 = router5;

// src/modules/analytics/routes.ts
var import_express6 = require("express");
var router6 = (0, import_express6.Router)();
var routes_default6 = router6;

// src/modules/audience/routes.ts
var import_express7 = require("express");
var router7 = (0, import_express7.Router)();
var routes_default7 = router7;

// src/modules/ai_command_center/routes.ts
var import_express8 = require("express");
var router8 = (0, import_express8.Router)();
var routes_default8 = router8;

// src/modules/agents/routes.ts
var import_express9 = require("express");
var router9 = (0, import_express9.Router)();
var routes_default9 = router9;

// src/modules/workflow_engine/routes.ts
var import_express10 = require("express");
var router10 = (0, import_express10.Router)();
var routes_default10 = router10;

// src/modules/creative_studio/routes.ts
var import_express11 = require("express");
var router11 = (0, import_express11.Router)();
var routes_default11 = router11;

// src/modules/competitive_intelligence/routes.ts
var import_express12 = require("express");
var router12 = (0, import_express12.Router)();
var routes_default12 = router12;

// src/modules/finance/routes.ts
var import_express13 = require("express");
var router13 = (0, import_express13.Router)();
var routes_default13 = router13;

// src/modules/reports/routes.ts
var import_express14 = require("express");
var router14 = (0, import_express14.Router)();
var routes_default14 = router14;

// src/modules/monitoring/routes.ts
var import_express15 = require("express");
var router15 = (0, import_express15.Router)();
var routes_default15 = router15;

// src/modules/audit_logs/routes.ts
var import_express16 = require("express");
var router16 = (0, import_express16.Router)();
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
app.use((0, import_helmet.default)());
app.use((0, import_cors.default)());
app.use((0, import_compression.default)());
app.use(import_express18.default.json());
app.use(import_express18.default.urlencoded({ extended: true }));
app.use((0, import_morgan.default)("dev"));
setupSwagger(app);
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.use("/api/v1", routes_default17);
app.use(errorHandler);
var app_default = app;
