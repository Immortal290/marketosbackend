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

// src/modules/campaigns/controller.ts
var controller_exports = {};
__export(controller_exports, {
  CampaignsController: () => CampaignsController
});
module.exports = __toCommonJS(controller_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CampaignsController
});
