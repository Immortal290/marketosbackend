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

// src/modules/campaign_brief/validator.ts
var validator_exports = {};
__export(validator_exports, {
  createCampaignBriefSchema: () => createCampaignBriefSchema
});
module.exports = __toCommonJS(validator_exports);
var import_zod = require("zod");
var createCampaignBriefSchema = import_zod.z.object({
  body: import_zod.z.object({
    workspaceId: import_zod.z.string().uuid("workspaceId must be a valid UUID"),
    brandProfileId: import_zod.z.string().uuid("brandProfileId must be a valid UUID"),
    goal: import_zod.z.enum(["awareness", "leads", "sales", "retention"], {
      errorMap: () => ({
        message: "goal must be one of: awareness, leads, sales, retention"
      })
    }),
    channels: import_zod.z.array(import_zod.z.enum(["email", "sms", "voice", "whatsapp", "social"])).min(1, "At least one channel is required"),
    budget: import_zod.z.number().positive().optional(),
    timelineStart: import_zod.z.string().datetime({ offset: true }).optional(),
    timelineEnd: import_zod.z.string().datetime({ offset: true }).optional(),
    keyMessage: import_zod.z.string().min(1).optional(),
    offerDetails: import_zod.z.string().optional(),
    kpiTarget: import_zod.z.string().optional(),
    freeTextContext: import_zod.z.string().optional(),
    rawPromptFallback: import_zod.z.string().optional(),
    // Optional send context
    recipientEmail: import_zod.z.string().email().optional(),
    recipientPhone: import_zod.z.string().optional(),
    senderName: import_zod.z.string().optional(),
    companyName: import_zod.z.string().optional(),
    companyAddress: import_zod.z.string().optional(),
    unsubscribeUrl: import_zod.z.string().url().optional()
  })
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCampaignBriefSchema
});
