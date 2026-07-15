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

// src/modules/creative_studio/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");
var router = (0, import_express.Router)();
router.get("/assets", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.delete("/assets/:id", (req, res) => {
  res.status(200).json({ success: true, data: null });
});
router.get("/brand-kit", (req, res) => {
  res.status(200).json({ success: true, data: { colors: { primary: "#6C63FF", secondary: "#FF6584", background: "#0F0F1A" }, fonts: { heading: "Inter", body: "Inter" }, logos: [], toneOfVoice: "Professional, confident, data-driven" } });
});
router.patch("/brand-kit", (req, res) => {
  res.status(200).json({ success: true, data: req.body });
});
router.post("/generate", (req, res) => {
  res.status(200).json({ success: true, data: { taskId: "gen-task-uuid", status: "QUEUED", estimatedMs: 8e3 } });
});
router.get("/generated", (req, res) => {
  res.status(200).json({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
});
router.get("/templates", (req, res) => {
  res.status(200).json({ success: true, data: [] });
});
var routes_default = router;
