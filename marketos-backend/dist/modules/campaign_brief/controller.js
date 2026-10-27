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

// src/modules/campaign_brief/controller.ts
var controller_exports = {};
__export(controller_exports, {
  CampaignBriefController: () => CampaignBriefController
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

// src/modules/campaign_brief/service.ts
var CampaignBriefService = class {
  /**
   * Creates a CampaignBrief linked to a BrandProfile, then assembles the full
   * structured payload and forwards it to the agent service's streaming pipeline.
   * Returns { brief, campaign, agentResponse } so the caller can stream SSE.
   */
  async createAndLaunch(data) {
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: data.brandProfileId }
    });
    if (!brandProfile) throw new Error("BrandProfile not found");
    const user = await prisma.user.findFirst();
    const apiKeys = user?.apiKeys;
    const llmApiKey = apiKeys?.gemini;
    const brief = await prisma.campaignBrief.create({
      data: {
        workspaceId: data.workspaceId,
        brandProfileId: data.brandProfileId,
        goal: data.goal,
        channels: data.channels,
        budget: data.budget,
        timelineStart: data.timelineStart ? new Date(data.timelineStart) : void 0,
        timelineEnd: data.timelineEnd ? new Date(data.timelineEnd) : void 0,
        keyMessage: data.keyMessage,
        offerDetails: data.offerDetails,
        kpiTarget: data.kpiTarget,
        freeTextContext: data.freeTextContext,
        rawPromptFallback: data.rawPromptFallback
      }
    });
    const campaign = await prisma.campaign.create({
      data: {
        name: `${brandProfile.businessName} \u2014 ${data.goal} campaign`,
        workspaceId: data.workspaceId,
        status: "ACTIVE",
        campaignBriefId: brief.id
      }
    });
    const agentPayload = {
      brand_profile: {
        id: brandProfile.id,
        business_name: brandProfile.businessName,
        industry: brandProfile.industry,
        website_url: brandProfile.websiteUrl,
        mission: brandProfile.mission,
        usp: brandProfile.usp,
        positioning: brandProfile.positioning,
        voice_adjectives: brandProfile.voiceAdjectives,
        voice_dos: brandProfile.voiceDos,
        voice_donts: brandProfile.voiceDonts,
        logo_url: brandProfile.logoUrl,
        brand_colors: brandProfile.brandColors,
        personas: brandProfile.personas,
        competitors: brandProfile.competitors,
        compliance_region: brandProfile.complianceRegion,
        compliance_notes: brandProfile.complianceNotes,
        past_campaign_refs: brandProfile.pastCampaignRefs
      },
      campaign_brief: {
        id: brief.id,
        goal: brief.goal,
        channels: brief.channels,
        budget: brief.budget,
        timeline_start: brief.timelineStart?.toISOString(),
        timeline_end: brief.timelineEnd?.toISOString(),
        key_message: brief.keyMessage,
        offer_details: brief.offerDetails,
        kpi_target: brief.kpiTarget,
        free_text_context: brief.freeTextContext
      },
      // Raw prompt fallback for legacy path inside agent
      user_intent: brief.rawPromptFallback ?? brief.keyMessage ?? `${brief.goal} campaign for ${brandProfile.businessName}`,
      channels: brief.channels,
      workspace_id: data.workspaceId,
      recipient_email: data.recipientEmail,
      recipient_phone: data.recipientPhone,
      sender_name: data.senderName ?? brandProfile.businessName,
      company_name: data.companyName ?? brandProfile.businessName,
      company_address: data.companyAddress ?? "",
      unsubscribe_url: data.unsubscribeUrl ?? "https://example.com/unsubscribe",
      llm_api_key: llmApiKey,
      image_model: data.imageModel,
      image_api_key: data.imageApiKey
    };
    return { brief, campaign, agentPayload };
  }
};

// src/modules/campaign_brief/controller.ts
var CampaignBriefController = class {
  service = new CampaignBriefService();
  /**
   * POST /campaign/brief
   * Creates the brief and forwards the request to the agent service.
   * Streams the agent response back to the client using SSE.
   */
  createAndLaunch = async (req, res, next) => {
    try {
      const { brief, campaign, agentPayload } = await this.service.createAndLaunch(req.body);
      const agentServiceUrl = process.env.AGENT_SERVICE_URL || "http://localhost:8000";
      const agentRes = await fetch(`${agentServiceUrl}/v1/pipeline/campaign/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentPayload)
      });
      if (!agentRes.ok) {
        throw new Error(`Agent service returned ${agentRes.status}`);
      }
      if (!agentRes.body) {
        throw new Error("Agent service returned no body");
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const reader = agentRes.body.getReader();
      const decoder = new TextDecoder("utf-8");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value));
      }
      res.end();
    } catch (error) {
      next(error);
    }
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CampaignBriefController
});
