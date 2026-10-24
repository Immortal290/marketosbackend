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

// src/modules/brand_profile/routes.ts
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

// src/modules/brand_profile/validator.ts
var import_zod2 = require("zod");
var PersonaSchema = import_zod2.z.object({
  name: import_zod2.z.string().min(1),
  demographics: import_zod2.z.string().min(1),
  painPoints: import_zod2.z.string().min(1),
  goals: import_zod2.z.string().min(1)
});
var CompetitorSchema = import_zod2.z.object({
  name: import_zod2.z.string().min(1),
  url: import_zod2.z.string().url().optional().or(import_zod2.z.literal("")),
  notes: import_zod2.z.string().optional()
});
var createBrandProfileSchema = import_zod2.z.object({
  body: import_zod2.z.object({
    workspaceId: import_zod2.z.string().uuid("workspaceId must be a valid UUID"),
    businessName: import_zod2.z.string().min(1, "Business name is required"),
    industry: import_zod2.z.string().min(1, "Industry is required"),
    websiteUrl: import_zod2.z.string().url().optional().or(import_zod2.z.literal("")),
    mission: import_zod2.z.string().optional(),
    usp: import_zod2.z.string().optional(),
    positioning: import_zod2.z.string().optional(),
    voiceAdjectives: import_zod2.z.array(import_zod2.z.string()).min(1, "At least one voice adjective is required"),
    voiceDos: import_zod2.z.array(import_zod2.z.string()),
    voiceDonts: import_zod2.z.array(import_zod2.z.string()),
    logoUrl: import_zod2.z.string().optional(),
    brandColors: import_zod2.z.array(import_zod2.z.string()),
    styleGuideUrl: import_zod2.z.string().optional(),
    personas: import_zod2.z.array(PersonaSchema).min(1).max(5),
    competitors: import_zod2.z.array(CompetitorSchema).max(5),
    complianceRegion: import_zod2.z.enum(["none", "EU-GDPR", "US-HIPAA", "US-FINRA", "other"]).optional(),
    complianceNotes: import_zod2.z.string().optional(),
    pastCampaignRefs: import_zod2.z.array(import_zod2.z.object({}).passthrough()).optional()
  })
});
var updateBrandProfileSchema = import_zod2.z.object({
  body: import_zod2.z.object({
    businessName: import_zod2.z.string().min(1).optional(),
    industry: import_zod2.z.string().min(1).optional(),
    websiteUrl: import_zod2.z.string().url().optional().or(import_zod2.z.literal("")),
    mission: import_zod2.z.string().optional(),
    usp: import_zod2.z.string().optional(),
    positioning: import_zod2.z.string().optional(),
    voiceAdjectives: import_zod2.z.array(import_zod2.z.string()).optional(),
    voiceDos: import_zod2.z.array(import_zod2.z.string()).optional(),
    voiceDonts: import_zod2.z.array(import_zod2.z.string()).optional(),
    logoUrl: import_zod2.z.string().optional(),
    brandColors: import_zod2.z.array(import_zod2.z.string()).optional(),
    styleGuideUrl: import_zod2.z.string().optional(),
    personas: import_zod2.z.array(PersonaSchema).max(5).optional(),
    competitors: import_zod2.z.array(CompetitorSchema).max(5).optional(),
    complianceRegion: import_zod2.z.enum(["none", "EU-GDPR", "US-HIPAA", "US-FINRA", "other"]).optional(),
    complianceNotes: import_zod2.z.string().optional(),
    pastCampaignRefs: import_zod2.z.array(import_zod2.z.object({}).passthrough()).optional()
  })
});
var autofillSchema = import_zod2.z.object({
  body: import_zod2.z.object({
    websiteUrl: import_zod2.z.string().url("websiteUrl must be a valid URL")
  })
});

// src/modules/brand_profile/routes.ts
var router = (0, import_express.Router)();
var controller = new BrandProfileController();
router.post("/", validate(createBrandProfileSchema), controller.create);
router.get("/", controller.listByWorkspace);
router.get("/:id", controller.getById);
router.patch("/:id", validate(updateBrandProfileSchema), controller.update);
router.post("/:id/autofill", validate(autofillSchema), controller.autofill);
var routes_default = router;
