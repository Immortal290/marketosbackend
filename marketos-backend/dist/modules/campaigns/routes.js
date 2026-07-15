"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/modules/campaigns/routes.ts
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
var import_http_status_codes = require("http-status-codes");
var CampaignsController = class {
  service = new CampaignsService();
  // Assuming workspaceId is passed either in body, query, or via a middleware that extracts it from user tokens
  // For simplicity, let's extract it from query or body for now.
  getAll = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const campaigns = await this.service.getAll(workspaceId);
      res.status(import_http_status_codes.StatusCodes.OK).json({ success: true, data: campaigns });
    } catch (error) {
      next(error);
    }
  };
  getById = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const campaign = await this.service.getById(req.params.id, workspaceId);
      res.status(import_http_status_codes.StatusCodes.OK).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };
  create = async (req, res, next) => {
    try {
      const campaign = await this.service.create(req.body);
      res.status(import_http_status_codes.StatusCodes.CREATED).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };
  update = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const campaign = await this.service.update(req.params.id, workspaceId, req.body);
      res.status(import_http_status_codes.StatusCodes.OK).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  };
  delete = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      await this.service.delete(req.params.id, workspaceId);
      res.status(import_http_status_codes.StatusCodes.OK).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  };
};

// src/middlewares/validate.middleware.ts
var import_zod = require("zod");
var import_http_status_codes2 = require("http-status-codes");
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
      console.log("IS ZOD ERROR?", error instanceof import_zod.ZodError);
      if (error instanceof import_zod.ZodError) {
        return res.status(import_http_status_codes2.StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Validation failed",
          errors: error.errors
        });
      }
      return next(error);
    }
  };
};

// src/modules/campaigns/validator.ts
var import_zod2 = require("zod");
var createCampaignSchema = import_zod2.z.object({
  body: import_zod2.z.object({
    name: import_zod2.z.string().min(1, "Name is required"),
    workspaceId: import_zod2.z.string().uuid()
  })
});
var updateCampaignSchema = import_zod2.z.object({
  body: import_zod2.z.object({
    name: import_zod2.z.string().optional(),
    status: import_zod2.z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).optional()
  })
});

// src/modules/campaigns/routes.ts
var router = (0, import_express.Router)();
var controller = new CampaignsController();
router.get("/", controller.getAll);
router.get("/stats", (req, res) => {
  res.status(200).json({
    success: true,
    data: { total: 42, active: 8, paused: 3, scheduled: 5, completed: 26 }
  });
});
router.get("/:id", controller.getById);
router.post("/", validate(createCampaignSchema), controller.create);
router.patch("/:id", validate(updateCampaignSchema), controller.update);
router.delete("/:id", controller.delete);
router.post("/:id/launch", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: "ACTIVE" } });
});
router.post("/:id/pause", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: "PAUSED" } });
});
var routes_default = router;
