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

// src/modules/monitoring/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");
var router = (0, import_express.Router)();
router.get("/health", (req, res) => {
  res.status(200).json({ success: true, data: { overall: "HEALTHY", api: "HEALTHY", database: "HEALTHY", redis: "HEALTHY", kafka: "HEALTHY", agents: "HEALTHY", uptime: 99.97, checkedAt: (/* @__PURE__ */ new Date()).toISOString() } });
});
router.get("/alerts", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "a1", type: "WARNING", title: "Redis memory at 85%", message: "Redis is approaching memory limits", resolved: false, timestamp: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "a2", type: "CRITICAL", title: "EmailAgent failure", message: "EmailAgent has crashed \u2014 auto-restart in progress", resolved: false, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
  ], meta: { total: 2, page: 1, limit: 20, pages: 1 } });
});
router.post("/alerts/:id/resolve", (req, res) => {
  res.status(200).json({ success: true, data: { id: req.params.id, resolved: true } });
});
router.get("/incidents", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.get("/remediation", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "rem1", alertId: "a2", action: "Restarted EmailAgent", outcome: "SUCCESS", timestamp: (/* @__PURE__ */ new Date()).toISOString() }
  ], meta: { total: 1, page: 1, limit: 20, pages: 1 } });
});
var routes_default = router;
