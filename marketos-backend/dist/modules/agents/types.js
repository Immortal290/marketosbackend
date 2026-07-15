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

// src/modules/agents/types.ts
var types_exports = {};
__export(types_exports, {
  AgentType: () => AgentType
});
module.exports = __toCommonJS(types_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AgentType
});
