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

// src/modules/ai_command_center/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");
var router = (0, import_express.Router)();
router.post("/command", (req, res) => {
  const prompt = req.body.prompt?.toLowerCase() || "";
  let intent = "UNKNOWN_INTENT";
  let agentsSpawned = ["GeneralAgent"];
  let routeTo = "/dashboard";
  if (prompt.includes("campaign")) {
    intent = "CREATE_CAMPAIGN";
    agentsSpawned = ["CopyAgent", "CreativeAgent", "EmailAgent"];
    routeTo = "/campaigns";
  } else if (prompt.includes("content") || prompt.includes("post") || prompt.includes("email") || prompt.includes("generation")) {
    intent = "GENERATE_CONTENT";
    agentsSpawned = ["CreativeAgent", "CopyAgent"];
    routeTo = "/creative-studio";
  } else if (prompt.includes("analy") || prompt.includes("report") || prompt.includes("performance")) {
    intent = "ANALYZE_PERFORMANCE";
    agentsSpawned = ["AnalyticsAgent"];
    routeTo = "/reports";
  } else {
    intent = "GENERAL_QUERY";
  }
  res.status(200).json({
    success: true,
    data: {
      taskId: `task-${Date.now()}`,
      intent,
      confidence: 0.94,
      agentsSpawned,
      estimatedMs: 12e3,
      routeTo
    }
  });
});
router.get("/suggestions", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "s1", label: "Boost Q4 campaign budget", description: "ROAS is 5.1x \u2014 increasing budget could yield 40% more revenue", impact: "HIGH", prompt: "Increase budget for Q4 Product Launch campaign by 20%" },
    { id: "s2", label: "Re-engage cold leads", description: "4,200 leads haven't opened an email in 30 days", impact: "MEDIUM", prompt: "Create a re-engagement sequence for cold leads" }
  ] });
});
router.get("/agents", (req, res) => {
  const agents = ["SUPERVISOR", "COPY", "CREATIVE", "ANALYTICS", "COMPLIANCE", "EMAIL", "SMS", "SOCIAL", "SEO", "COMPETITOR", "FINANCE"];
  res.status(200).json({ success: true, data: agents.map((type, i) => ({ id: `agent-${i}`, name: `${type.charAt(0)}${type.slice(1).toLowerCase()}Agent`, type, status: i < 3 ? "RUNNING" : "IDLE", queueLength: i < 3 ? 2 : 0, successRate: 97 + Math.random() * 2 })) });
});
router.get("/tasks", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.get("/decisions", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "d1", decision: "Pause underperforming ad set B", reasoning: "CTR dropped 40% over 3 days with no conversions", confidence: 0.91, outcome: "EXECUTED", timestamp: (/* @__PURE__ */ new Date()).toISOString() }
  ] });
});
router.get("/memory", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.get("/automation-rules", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "r1", name: "Pause ad if ROAS < 2x", type: "BUDGET", enabled: true, trigger: { metric: "roas", operator: "lt", value: 2 }, action: { type: "PAUSE_AD" }, lastFired: null },
    { id: "r2", name: "Alert on budget threshold", type: "ALERT", enabled: true, trigger: { metric: "budgetUsed", operator: "gte", value: 80 }, action: { type: "SEND_ALERT" }, lastFired: "2026-06-14T08:00:00Z" }
  ] });
});
router.post("/automation-rules", (req, res) => {
  res.status(201).json({ success: true, data: { id: "new-uuid", ...req.body, lastFired: null } });
});
router.delete("/automation-rules/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
var routes_default = router;
