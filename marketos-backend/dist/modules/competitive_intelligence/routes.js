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

// src/modules/competitive_intelligence/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");
var router = (0, import_express.Router)();
router.get("/competitors", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "c1", name: "RivalCo", website: "https://rivalco.com", adSpend: 25e4, keywords: ["crm", "marketing automation"] }
  ] });
});
router.post("/competitors", (req, res) => {
  res.status(201).json({ success: true, data: { id: "new-uuid", ...req.body } });
});
router.delete("/competitors/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
router.get("/ad-monitoring", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.get("/pricing", (req, res) => {
  res.status(200).json({ success: true, data: [] });
});
router.get("/seo", (req, res) => {
  res.status(200).json({ success: true, data: { yourDomain: { domainAuthority: 48, organicKeywords: 3200, backlinks: 12400 }, competitors: [], keywordGaps: [] } });
});
router.get("/opportunities", (req, res) => {
  res.status(200).json({ success: true, data: [
    { id: "o1", type: "PRICING_GAP", title: "RivalCo raised starter plan price by 25%", description: "Their starter plan now costs $149/mo vs your $99/mo \u2014 opportunity to capture price-sensitive segment", impact: "HIGH", detectedAt: (/* @__PURE__ */ new Date()).toISOString() }
  ] });
});
var routes_default = router;
