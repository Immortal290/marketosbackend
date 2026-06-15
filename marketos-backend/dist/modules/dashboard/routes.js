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

// src/modules/dashboard/routes.ts
var routes_exports = {};
__export(routes_exports, {
  default: () => routes_default
});
module.exports = __toCommonJS(routes_exports);
var import_express = require("express");

// src/lib/prisma.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();

// src/modules/dashboard/service.ts
var DashboardService = class {
  async getKpis(workspaceId) {
    const totalCampaigns = await prisma.campaign.count({
      where: { workspaceId }
    });
    const activeCampaigns = await prisma.campaign.count({
      where: { workspaceId, status: "ACTIVE" }
    });
    return {
      totalCampaigns,
      activeCampaigns
      // more KPIs can be added here
    };
  }
  async getActivityFeed(workspaceId) {
    const recentCampaigns = await prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    return recentCampaigns.map((c) => ({
      type: "CAMPAIGN_CREATED",
      title: `Campaign "${c.name}" was created`,
      timestamp: c.createdAt
    }));
  }
};

// src/modules/dashboard/controller.ts
var import_http_status_codes = require("http-status-codes");
var DashboardController = class {
  service = new DashboardService();
  getKpis = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const kpis = await this.service.getKpis(workspaceId);
      res.status(import_http_status_codes.StatusCodes.OK).json({ success: true, data: kpis });
    } catch (error) {
      next(error);
    }
  };
  getActivityFeed = async (req, res, next) => {
    try {
      const workspaceId = req.query.workspaceId;
      if (!workspaceId) return res.status(import_http_status_codes.StatusCodes.BAD_REQUEST).json({ error: "workspaceId required" });
      const feed = await this.service.getActivityFeed(workspaceId);
      res.status(import_http_status_codes.StatusCodes.OK).json({ success: true, data: feed });
    } catch (error) {
      next(error);
    }
  };
};

// src/modules/dashboard/routes.ts
var router = (0, import_express.Router)();
var controller = new DashboardController();
router.get("/kpis", controller.getKpis);
router.get("/activity", controller.getActivityFeed);
var routes_default = router;
