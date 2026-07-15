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

// src/modules/campaign_detail/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");
var router = (0, import_express.Router)();
router.get("/:campaignId/overview", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      campaign: { id: req.params.campaignId, name: "Q4 Product Launch", status: "ACTIVE", healthScore: 87.5 },
      goalProgress: { target: 1e3, current: 642, pct: 64.2 },
      timeline: { startDate: "2026-10-01T00:00:00Z", endDate: "2026-12-31T23:59:59Z", daysLeft: 14 },
      budget: { total: 5e4, spent: 23400, remaining: 26600 }
    }
  });
});
router.get("/:campaignId/audience", (req, res) => {
  res.status(200).json({ success: true, data: { total: 48200, reachable: 44100, suppressed: 4100, segments: [] } });
});
router.get("/:campaignId/assets", (req, res) => {
  res.status(200).json({ success: true, data: [] });
});
router.get("/:campaignId/channels", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      email: { sent: 24e3, openRate: 28.4, clickRate: 4.2, unsubRate: 0.3, revenue: 48200 },
      sms: { sent: 8e3, deliveryRate: 97.8, clickRate: 6.1 },
      social: { impressions: 42e4, engagement: 3.7, clicks: 15540 },
      paidAds: { impressions: 12e5, cpc: 1.24, roas: 4.8 }
    }
  });
});
router.get("/:campaignId/timeline", (req, res) => {
  res.status(200).json({ success: true, data: [
    { stage: "CREATION", timestamp: "2026-10-01T10:00:00Z", actor: "John Doe", note: "Campaign created" },
    { stage: "LAUNCH", timestamp: "2026-10-05T09:00:00Z", actor: "SupervisorAgent", note: "Campaign launched" }
  ] });
});
router.get("/:campaignId/ab-tests", (req, res) => {
  res.status(200).json({ success: true, data: [] });
});
router.get("/:campaignId/analytics", (req, res) => {
  res.status(200).json({ success: true, data: { impressions: 164e4, clicks: 42300, leads: 2810, mqls: 410, revenue: 96400 } });
});
router.get("/:campaignId/finance", (req, res) => {
  res.status(200).json({ success: true, data: { budget: 5e4, spend: 23400, revenue: 96400, roi: 3.12, roas: 4.12, projectedRevenue: 19e4 } });
});
router.get("/:campaignId/activity-log", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
var routes_default = router;
