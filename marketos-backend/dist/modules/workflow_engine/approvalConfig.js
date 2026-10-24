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

// src/modules/workflow_engine/approvalConfig.ts
var approvalConfig_exports = {};
__export(approvalConfig_exports, {
  AGENT_APPROVAL_CONFIG: () => AGENT_APPROVAL_CONFIG,
  checkAgentRequiresApproval: () => checkAgentRequiresApproval,
  normalizeAgentName: () => normalizeAgentName
});
module.exports = __toCommonJS(approvalConfig_exports);
var AGENT_APPROVAL_CONFIG = {
  EmailAgent: {
    requiresApproval: true,
    reason: "Email dispatch to external contacts requires human review"
  },
  ComplianceAgent: {
    requiresApproval: true,
    reason: "Compliance policy & legal check requires explicit approval"
  },
  SocialMediaAgent: {
    requiresApproval: true,
    reason: "Publishing ad campaigns/posts to social platforms requires approval"
  },
  VoiceAgent: {
    requiresApproval: true,
    reason: "Outbound AI voice calls require manual authorization"
  },
  WhatsappAgent: {
    requiresApproval: true,
    reason: "Outbound WhatsApp messaging requires manual authorization"
  },
  TelegramAgent: {
    requiresApproval: true,
    reason: "Outbound Telegram messages require manual authorization"
  },
  // Auto-run agents (no approval required)
  SupervisorAgent: { requiresApproval: false },
  CopyAgent: { requiresApproval: false },
  CreativeAgent: { requiresApproval: false },
  AnalyticsAgent: { requiresApproval: false },
  FinanceAgent: { requiresApproval: false },
  LeadScoringAgent: { requiresApproval: false },
  MonitorAgent: { requiresApproval: false },
  OnboardingAgent: { requiresApproval: false },
  PersonalizationAgent: { requiresApproval: false },
  ReportingAgent: { requiresApproval: false },
  SeoAgent: { requiresApproval: false },
  CompetitorAgent: { requiresApproval: false },
  AbTestAgent: { requiresApproval: false }
};
function normalizeAgentName(name) {
  const cleaned = name.trim();
  if (cleaned.endsWith("Agent")) {
    return cleaned;
  }
  const pascal = cleaned.split(/_|\s|-/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join("");
  return `${pascal}Agent`;
}
function checkAgentRequiresApproval(agentName) {
  const normalized = normalizeAgentName(agentName);
  return AGENT_APPROVAL_CONFIG[normalized]?.requiresApproval ?? false;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AGENT_APPROVAL_CONFIG,
  checkAgentRequiresApproval,
  normalizeAgentName
});
