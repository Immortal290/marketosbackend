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

// src/modules/finance/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");
var router = (0, import_express.Router)();
router.get("/spend", (req, res) => {
  res.status(200).json({ success: true, data: { totalBudget: 5e5, totalSpend: 214300, remainingBudget: 285700, projectedSpend: 49e4, roas: 4.2, roi: 3.2 } });
});
router.get("/revenue", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      totalRevenue: 124e4,
      byChannel: [
        { channel: "EMAIL", revenue: 424080, pct: 34.2 },
        { channel: "PAID_ADS", revenue: 355880, pct: 28.7 },
        { channel: "SOCIAL", revenue: 274040, pct: 22.1 },
        { channel: "SMS", revenue: 186e3, pct: 15 }
      ],
      byCampaign: []
    }
  });
});
router.get("/roas", (req, res) => {
  res.status(200).json({ success: true, data: { overallRoas: 4.2, benchmark: 3.5, breakdown: [], trend: [] } });
});
router.get("/budget", (req, res) => {
  res.status(200).json({ success: true, data: [] });
});
router.patch("/budget/:campaignId", (req, res) => {
  res.status(200).json({ success: true, data: { campaignId: req.params.campaignId, ...req.body } });
});
router.get("/forecast", (req, res) => {
  res.status(200).json({ success: true, data: { projectedRevenue: 148e4, projectedSpend: 49e4, projectedRoas: 3.9, confidence: 0.84, timeline: [] } });
});
var routes_default = router;
