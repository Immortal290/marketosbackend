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

// src/modules/campaigns/service.ts
var service_exports = {};
__export(service_exports, {
  CampaignsService: () => CampaignsService
});
module.exports = __toCommonJS(service_exports);

// src/lib/prisma.ts
var import_config = require("dotenv/config");
var import_client = require("@prisma/client");
var import_adapter_pg = require("@prisma/adapter-pg");
var import_pg = require("pg");
var DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set. Check your .env file.");
}
var pool = new import_pg.Pool({ connectionString: DATABASE_URL });
var adapter = new import_adapter_pg.PrismaPg(pool);
var globalForPrisma = globalThis;
var prisma = globalForPrisma.prisma ?? new import_client.PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// src/modules/campaigns/service.ts
var CampaignsService = class {
  async getAll(workspaceId) {
    return prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" }
    });
  }
  async getById(id, workspaceId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, workspaceId }
    });
    if (!campaign) throw new Error("Campaign not found");
    return campaign;
  }
  async create(data) {
    return prisma.campaign.create({
      data: {
        name: data.name,
        workspaceId: data.workspaceId
      }
    });
  }
  async update(id, workspaceId, data) {
    await this.getById(id, workspaceId);
    return prisma.campaign.update({
      where: { id },
      data
    });
  }
  async delete(id, workspaceId) {
    await this.getById(id, workspaceId);
    return prisma.campaign.delete({
      where: { id }
    });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CampaignsService
});
