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

// src/modules/auth/controller.ts
var controller_exports = {};
__export(controller_exports, {
  AuthController: () => AuthController
});
module.exports = __toCommonJS(controller_exports);

// src/modules/auth/service.ts
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));

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

// src/modules/auth/service.ts
var JWT_SECRET = process.env.JWT_SECRET || "secret";
var JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";
var JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh_secret";
var JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
var AuthService = class {
  async register(data) {
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new Error("User already exists");
    }
    const hashedPassword = await import_bcryptjs.default.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName
      }
    });
    return this.generateTokens(user.id);
  }
  async login(data) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new Error("Invalid credentials");
    }
    const isMatch = await import_bcryptjs.default.compare(data.password, user.password);
    if (!isMatch) {
      throw new Error("Invalid credentials");
    }
    return this.generateTokens(user.id);
  }
  async refresh(refreshToken) {
    try {
      const payload = import_jsonwebtoken.default.verify(refreshToken, JWT_REFRESH_SECRET);
      return this.generateTokens(payload.userId);
    } catch {
      throw new Error("Invalid or expired refresh token");
    }
  }
  async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true
      }
    });
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }
  generateTokens(userId) {
    const accessToken = import_jsonwebtoken.default.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = import_jsonwebtoken.default.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
    return { accessToken, refreshToken, expiresIn: 86400 };
  }
};

// src/modules/auth/controller.ts
var import_http_status_codes = require("http-status-codes");
var AuthController = class {
  service = new AuthService();
  register = async (req, res, next) => {
    try {
      const tokens = await this.service.register(req.body);
      res.status(import_http_status_codes.StatusCodes.CREATED).json({
        success: true,
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  };
  login = async (req, res, next) => {
    try {
      const tokens = await this.service.login(req.body);
      res.status(import_http_status_codes.StatusCodes.OK).json({
        success: true,
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  };
  refresh = async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(import_http_status_codes.StatusCodes.BAD_REQUEST).json({
          success: false,
          error: "refreshToken is required"
        });
      }
      const tokens = await this.service.refresh(refreshToken);
      res.status(import_http_status_codes.StatusCodes.OK).json({
        success: true,
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  };
  logout = async (req, res, next) => {
    try {
      res.status(import_http_status_codes.StatusCodes.OK).json({
        success: true,
        data: null,
        message: "Logged out successfully"
      });
    } catch (error) {
      next(error);
    }
  };
  me = async (req, res, next) => {
    try {
      const userId = req.user?.userId ?? "unknown";
      const user = await this.service.getMe(userId);
      res.status(import_http_status_codes.StatusCodes.OK).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthController
});
