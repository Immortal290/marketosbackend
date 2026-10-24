"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/middlewares/auth.middleware.ts
var auth_middleware_exports = {};
__export(auth_middleware_exports, {
  requireClerkAuth: () => requireClerkAuth
});
module.exports = __toCommonJS(auth_middleware_exports);
var import_express = require("@clerk/express");

// src/lib/prisma.ts
var import_config = require("dotenv/config");
var import_client = require("@prisma/client");
var import_adapter_pg = require("@prisma/adapter-pg");
var import_pg = require("pg");
var DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "[Prisma] WARNING: DATABASE_URL environment variable is not set. Database queries will fail. Ensure DATABASE_URL is configured in Railway Variables."
  );
}
var pool = new import_pg.Pool({ connectionString: DATABASE_URL || "postgresql://localhost/marketos_placeholder" });
var adapter = new import_adapter_pg.PrismaPg(pool);
var globalForPrisma = globalThis;
var prisma = globalForPrisma.prisma ?? new import_client.PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// src/middlewares/auth.middleware.ts
var import_bcryptjs = __toESM(require("bcryptjs"));
var requireClerkAuth = async (req, res, next) => {
  const auth = (0, import_express.getAuth)(req);
  if (!auth.userId) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized - No active Clerk session",
      code: "UNAUTHORIZED"
    });
  }
  try {
    const clerkUser = await import_express.clerkClient.users.getUser(auth.userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "No email address associated with Clerk user",
        code: "BAD_REQUEST"
      });
    }
    let user = await prisma.user.findUnique({
      where: { email }
    });
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await import_bcryptjs.default.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: clerkUser.firstName || "",
          lastName: clerkUser.lastName || ""
        }
      });
      const workspaceName = clerkUser.firstName ? `${clerkUser.firstName}'s Workspace` : "Default Workspace";
      const workspace = await prisma.workspace.create({
        data: {
          name: workspaceName
        }
      });
      await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "OWNER"
        }
      });
    }
    req.user = {
      userId: user.id,
      email: user.email,
      clerkId: auth.userId
    };
    next();
  } catch (error) {
    console.error("Clerk Authentication Middleware Error:", error);
    next(error);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  requireClerkAuth
});
