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

// src/modules/workflow_engine/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");
var router = (0, import_express.Router)();
router.get("/graph", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      nodes: [
        { id: "supervisor", label: "SupervisorAgent", type: "SUPERVISOR", status: "RUNNING", x: 400, y: 50 },
        { id: "copy", label: "CopyAgent", type: "COPY", status: "RUNNING", x: 200, y: 200 },
        { id: "creative", label: "CreativeAgent", type: "CREATIVE", status: "WAITING", x: 400, y: 200 },
        { id: "compliance", label: "ComplianceAgent", type: "COMPLIANCE", status: "WAITING", x: 600, y: 200 },
        { id: "email", label: "EmailAgent", type: "EMAIL", status: "IDLE", x: 200, y: 350 },
        { id: "analytics", label: "AnalyticsAgent", type: "ANALYTICS", status: "IDLE", x: 600, y: 350 }
      ],
      edges: [
        { source: "supervisor", target: "copy", label: "brief" },
        { source: "supervisor", target: "creative", label: "brief" },
        { source: "supervisor", target: "compliance", label: "content" },
        { source: "copy", target: "email", label: "email_copy" },
        { source: "creative", target: "email", label: "assets" },
        { source: "compliance", target: "email", label: "approval" },
        { source: "email", target: "analytics", label: "metrics" }
      ]
    }
  });
});
router.get("/executions", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.get("/executions/:id", (req, res) => {
  res.status(200).json({ success: true, data: { execution: { id: req.params.id }, steps: [] } });
});
router.post("/executions/:id/cancel", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, status: "CANCELLED" } });
});
router.get("/dependencies", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      parallelGroups: [["CopyAgent", "CreativeAgent"], ["EmailAgent", "SmsAgent", "SocialAgent"], ["AnalyticsAgent"]],
      criticalPath: ["SupervisorAgent", "CopyAgent", "ComplianceAgent", "EmailAgent", "AnalyticsAgent"]
    }
  });
});
router.get("/automation", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "wf1", name: "Full Campaign Launch Workflow", description: "End-to-end workflow from brief to launch", steps: 8, lastRun: null, enabled: true },
    { id: "wf2", name: "Re-engagement Workflow", description: "Automated re-engagement sequence for cold leads", steps: 5, lastRun: "2026-06-01T10:00:00Z", enabled: true }
  ] });
});
router.post("/automation/:id/trigger", (req, res) => {
  res.status(200).json({ success: true, data: { executionId: "exec-uuid", status: "RUNNING" } });
});
var routes_default = router;
