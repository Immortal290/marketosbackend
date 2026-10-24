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

// src/modules/brand_profile/controller.ts
var controller_exports = {};
__export(controller_exports, {
  BrandProfileController: () => BrandProfileController
});
module.exports = __toCommonJS(controller_exports);

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

// src/modules/brand_profile/service.ts
var BrandProfileService = class {
  async create(data) {
    return prisma.brandProfile.create({
      data: {
        workspaceId: data.workspaceId,
        businessName: data.businessName,
        industry: data.industry,
        websiteUrl: data.websiteUrl,
        mission: data.mission,
        usp: data.usp,
        positioning: data.positioning,
        voiceAdjectives: data.voiceAdjectives,
        voiceDos: data.voiceDos,
        voiceDonts: data.voiceDonts,
        logoUrl: data.logoUrl,
        brandColors: data.brandColors,
        styleGuideUrl: data.styleGuideUrl,
        personas: data.personas,
        competitors: data.competitors,
        complianceRegion: data.complianceRegion,
        complianceNotes: data.complianceNotes,
        pastCampaignRefs: data.pastCampaignRefs
      }
    });
  }
  async findByWorkspace(workspaceId) {
    return prisma.brandProfile.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    });
  }
  async findById(id) {
    const profile = await prisma.brandProfile.findUnique({ where: { id } });
    if (!profile) throw new Error("BrandProfile not found");
    return profile;
  }
  async update(id, data) {
    await this.findById(id);
    return prisma.brandProfile.update({
      where: { id },
      data: {
        ...data,
        personas: data.personas,
        competitors: data.competitors,
        pastCampaignRefs: data.pastCampaignRefs
      }
    });
  }
  /**
   * Calls the Python agent service's brand scraper and returns
   * suggested autofill values WITHOUT persisting them.
   * The frontend shows the result for user confirmation/edit.
   */
  async autofill(websiteUrl) {
    const agentServiceUrl = process.env.AGENT_SERVICE_URL || "http://localhost:8000";
    const resp = await fetch(`${agentServiceUrl}/v1/tools/scrape-brand-site`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteUrl }),
      signal: AbortSignal.timeout(2e4)
    });
    if (!resp.ok) {
      throw new Error(`Agent service scraper returned ${resp.status}`);
    }
    return resp.json();
  }
};

// src/modules/brand_profile/controller.ts
var import_http_status_codes = require("http-status-codes");
var BrandProfileController = class {
  service = new BrandProfileService();
  /** POST /brand-profile */
  create = async (req, res, next) => {
    try {
      const profile = await this.service.create(req.body);
      res.status(import_http_status_codes.StatusCodes.CREATED).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };
  /** GET /brand-profile?workspaceId=... */
  listByWorkspace = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId)
        return res.status(import_http_status_codes.StatusCodes.BAD_REQUEST).json({ error: "workspaceId query param is required" });
      const profiles = await this.service.findByWorkspace(workspaceId);
      res.status(import_http_status_codes.StatusCodes.OK).json({ success: true, data: profiles });
    } catch (error) {
      next(error);
    }
  };
  /** GET /brand-profile/:id */
  getById = async (req, res, next) => {
    try {
      const profile = await this.service.findById(req.params.id);
      res.status(import_http_status_codes.StatusCodes.OK).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };
  /** PATCH /brand-profile/:id */
  update = async (req, res, next) => {
    try {
      const profile = await this.service.update(req.params.id, req.body);
      res.status(import_http_status_codes.StatusCodes.OK).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };
  /**
   * POST /brand-profile/:id/autofill
   * Body: { websiteUrl: string }
   * Returns suggested field values WITHOUT saving — user must confirm.
   */
  autofill = async (req, res, next) => {
    try {
      const suggestions = await this.service.autofill(req.body.websiteUrl);
      res.status(import_http_status_codes.StatusCodes.OK).json({ success: true, data: suggestions });
    } catch (error) {
      next(error);
    }
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BrandProfileController
});
