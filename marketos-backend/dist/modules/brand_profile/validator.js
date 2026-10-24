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

// src/modules/brand_profile/validator.ts
var validator_exports = {};
__export(validator_exports, {
  autofillSchema: () => autofillSchema,
  createBrandProfileSchema: () => createBrandProfileSchema,
  updateBrandProfileSchema: () => updateBrandProfileSchema
});
module.exports = __toCommonJS(validator_exports);
var import_zod = require("zod");
var PersonaSchema = import_zod.z.object({
  name: import_zod.z.string().min(1),
  demographics: import_zod.z.string().min(1),
  painPoints: import_zod.z.string().min(1),
  goals: import_zod.z.string().min(1)
});
var CompetitorSchema = import_zod.z.object({
  name: import_zod.z.string().min(1),
  url: import_zod.z.string().url().optional().or(import_zod.z.literal("")),
  notes: import_zod.z.string().optional()
});
var createBrandProfileSchema = import_zod.z.object({
  body: import_zod.z.object({
    workspaceId: import_zod.z.string().uuid("workspaceId must be a valid UUID"),
    businessName: import_zod.z.string().min(1, "Business name is required"),
    industry: import_zod.z.string().min(1, "Industry is required"),
    websiteUrl: import_zod.z.string().url().optional().or(import_zod.z.literal("")),
    mission: import_zod.z.string().optional(),
    usp: import_zod.z.string().optional(),
    positioning: import_zod.z.string().optional(),
    voiceAdjectives: import_zod.z.array(import_zod.z.string()).min(1, "At least one voice adjective is required"),
    voiceDos: import_zod.z.array(import_zod.z.string()),
    voiceDonts: import_zod.z.array(import_zod.z.string()),
    logoUrl: import_zod.z.string().optional(),
    brandColors: import_zod.z.array(import_zod.z.string()),
    styleGuideUrl: import_zod.z.string().optional(),
    personas: import_zod.z.array(PersonaSchema).min(1).max(5),
    competitors: import_zod.z.array(CompetitorSchema).max(5),
    complianceRegion: import_zod.z.enum(["none", "EU-GDPR", "US-HIPAA", "US-FINRA", "other"]).optional(),
    complianceNotes: import_zod.z.string().optional(),
    pastCampaignRefs: import_zod.z.array(import_zod.z.object({}).passthrough()).optional()
  })
});
var updateBrandProfileSchema = import_zod.z.object({
  body: import_zod.z.object({
    businessName: import_zod.z.string().min(1).optional(),
    industry: import_zod.z.string().min(1).optional(),
    websiteUrl: import_zod.z.string().url().optional().or(import_zod.z.literal("")),
    mission: import_zod.z.string().optional(),
    usp: import_zod.z.string().optional(),
    positioning: import_zod.z.string().optional(),
    voiceAdjectives: import_zod.z.array(import_zod.z.string()).optional(),
    voiceDos: import_zod.z.array(import_zod.z.string()).optional(),
    voiceDonts: import_zod.z.array(import_zod.z.string()).optional(),
    logoUrl: import_zod.z.string().optional(),
    brandColors: import_zod.z.array(import_zod.z.string()).optional(),
    styleGuideUrl: import_zod.z.string().optional(),
    personas: import_zod.z.array(PersonaSchema).max(5).optional(),
    competitors: import_zod.z.array(CompetitorSchema).max(5).optional(),
    complianceRegion: import_zod.z.enum(["none", "EU-GDPR", "US-HIPAA", "US-FINRA", "other"]).optional(),
    complianceNotes: import_zod.z.string().optional(),
    pastCampaignRefs: import_zod.z.array(import_zod.z.object({}).passthrough()).optional()
  })
});
var autofillSchema = import_zod.z.object({
  body: import_zod.z.object({
    websiteUrl: import_zod.z.string().url("websiteUrl must be a valid URL")
  })
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  autofillSchema,
  createBrandProfileSchema,
  updateBrandProfileSchema
});
