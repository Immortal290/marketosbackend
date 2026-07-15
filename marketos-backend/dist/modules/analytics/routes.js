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

// src/modules/analytics/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");
var router = (0, import_express.Router)();
router.get("/executive", (req, res) => {
  res.status(200).json({ success: true, data: { revenue: 124e4, pipeline: 56e5, cac: 124.5, ltv: 4800, roas: 4.2, conversionRate: 3.47 } });
});
router.get("/attribution", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      model: "MULTI_TOUCH",
      channels: [
        { channel: "EMAIL", contribution: 34.2, revenue: 424080 },
        { channel: "PAID_ADS", contribution: 28.7, revenue: 355880 },
        { channel: "SOCIAL", contribution: 22.1, revenue: 274040 },
        { channel: "SMS", contribution: 15, revenue: 186e3 }
      ]
    }
  });
});
router.get("/channels", (req, res) => {
  res.status(200).json({ success: true, data: { email: {}, sms: {}, social: {}, paidAds: {} } });
});
router.get("/funnel", (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { stage: "IMPRESSION", count: 164e4, convRate: 100, dropoffRate: 0 },
      { stage: "CLICK", count: 42300, convRate: 2.58, dropoffRate: 97.42 },
      { stage: "VISIT", count: 38100, convRate: 90.1, dropoffRate: 9.9 },
      { stage: "LEAD", count: 12400, convRate: 32.5, dropoffRate: 67.5 },
      { stage: "MQL", count: 1870, convRate: 15.1, dropoffRate: 84.9 },
      { stage: "SQL", count: 430, convRate: 23, dropoffRate: 77 },
      { stage: "CUSTOMER", count: 186, convRate: 43.3, dropoffRate: 56.7 }
    ]
  });
});
router.get("/journey", (req, res) => {
  res.status(200).json({ success: true, data: { topPaths: [], touchpoints: [], dropoffs: [] } });
});
router.get("/cohorts", (req, res) => {
  res.status(200).json({ success: true, data: { cohorts: [], periods: [] } });
});
router.get("/realtime", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      connected: true,
      latestSnapshot: {
        revenue: 124e4,
        pipeline: 56e5,
        cac: 124.5,
        ltv: 4800,
        roas: 4.2,
        conversionRate: 3.47,
        _ts: (/* @__PURE__ */ new Date()).toISOString()
      },
      anomalies: [],
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
});
var routes_default = router;
