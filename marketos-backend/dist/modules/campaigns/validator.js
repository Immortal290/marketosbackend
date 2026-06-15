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

// src/modules/campaigns/validator.ts
var validator_exports = {};
__export(validator_exports, {
  createCampaignSchema: () => createCampaignSchema,
  updateCampaignSchema: () => updateCampaignSchema
});
module.exports = __toCommonJS(validator_exports);
var import_zod = require("zod");
var createCampaignSchema = import_zod.z.object({
  body: import_zod.z.object({
    name: import_zod.z.string().min(1, "Name is required"),
    workspaceId: import_zod.z.string().uuid()
  })
});
var updateCampaignSchema = import_zod.z.object({
  body: import_zod.z.object({
    name: import_zod.z.string().optional(),
    status: import_zod.z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).optional()
  })
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCampaignSchema,
  updateCampaignSchema
});
