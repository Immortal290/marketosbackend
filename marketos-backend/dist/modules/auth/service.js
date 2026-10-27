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

// src/modules/auth/service.ts
var service_exports = {};
__export(service_exports, {
  AuthService: () => AuthService
});
module.exports = __toCommonJS(service_exports);
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var import_crypto = require("crypto");

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

// src/modules/auth/service.ts
var import_google_auth_library = require("google-auth-library");
var AuthError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
  status;
};
var hashToken = (token) => (0, import_crypto.createHash)("sha256").update(token).digest("hex");
var AuthService = class {
  getSecrets() {
    const access = process.env.JWT_SECRET;
    const refresh = process.env.JWT_REFRESH_SECRET;
    if (!access || !refresh) {
      throw new AuthError(
        "Authentication is not configured",
        500
      );
    }
    return { access, refresh };
  }
  async register(data) {
    const email = data.email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    if (existingUser) {
      throw new AuthError("Email already registered", 409);
    }
    const hashedPassword = await import_bcryptjs.default.hash(data.password, 12);
    const emailPrefix = email.split("@")[0];
    try {
      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: data.firstName?.trim() || null,
            lastName: data.lastName?.trim() || null
          }
        });
        const workspace = await tx.workspace.create({
          data: {
            name: data.workspaceName?.trim() || `${data.firstName?.trim() || emailPrefix}'s Workspace`
          }
        });
        await tx.workspaceMember.create({
          data: {
            userId: createdUser.id,
            workspaceId: workspace.id,
            role: "OWNER"
          }
        });
        return createdUser;
      });
      return await this.createSessionTokens(user.id);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new AuthError("Email already registered", 409);
      }
      throw error;
    }
  }
  async login(data) {
    const email = data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email }
    });
    if (!user || !user.password || !user.isActive || !await import_bcryptjs.default.compare(data.password, user.password)) {
      throw new AuthError("Invalid credentials", 401);
    }
    return this.createSessionTokens(user.id);
  }
  async refresh(refreshToken) {
    const { refresh } = this.getSecrets();
    let payload;
    try {
      const verified = import_jsonwebtoken.default.verify(refreshToken, refresh);
      if (typeof verified === "string" || typeof verified.userId !== "string" || !verified.userId) {
        throw new Error("Invalid token payload");
      }
      payload = verified;
    } catch {
      throw new AuthError("Invalid or expired refresh token", 401);
    }
    const tokenHash = hashToken(refreshToken);
    const now = /* @__PURE__ */ new Date();
    const session = await prisma.authSession.findUnique({
      where: { refreshTokenHash: tokenHash }
    });
    if (!session || session.userId !== payload.userId || session.revokedAt || session.expiresAt <= now) {
      throw new AuthError("Invalid or expired refresh token", 401);
    }
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isActive: true }
    });
    if (!user?.isActive) {
      throw new AuthError("Invalid or expired refresh token", 401);
    }
    const revoked = await prisma.authSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      data: { revokedAt: now }
    });
    if (revoked.count !== 1) {
      throw new AuthError("Invalid or expired refresh token", 401);
    }
    return this.createSessionTokens(session.userId);
  }
  async logout(refreshToken) {
    await prisma.authSession.updateMany({
      where: {
        refreshTokenHash: hashToken(refreshToken),
        revokedAt: null
      },
      data: { revokedAt: /* @__PURE__ */ new Date() }
    });
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
      throw new AuthError("User not found", 404);
    }
    return user;
  }
  async createSessionTokens(userId) {
    const { access, refresh } = this.getSecrets();
    const accessToken = import_jsonwebtoken.default.sign(
      { userId },
      access,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );
    const refreshToken = import_jsonwebtoken.default.sign(
      { userId, tokenId: (0, import_crypto.randomUUID)() },
      refresh,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d"
      }
    );
    const decoded = import_jsonwebtoken.default.decode(refreshToken);
    if (!decoded?.exp) {
      throw new AuthError("Could not create session", 500);
    }
    await prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1e3)
      }
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: 86400
    };
  }
  async googleLogin(idToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new AuthError("Google sign-in is not configured", 500);
    }
    const client = new import_google_auth_library.OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId
      });
      payload = ticket.getPayload();
    } catch {
      throw new AuthError("Invalid Google ID token", 401);
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new AuthError("Google account email is not verified", 401);
    }
    const email = payload.email.trim().toLowerCase();
    const identity = await prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: "GOOGLE",
          providerUserId: payload.sub
        }
      },
      include: { user: true }
    });
    if (identity) {
      if (!identity.user.isActive) {
        throw new AuthError("This account is disabled", 403);
      }
      return this.createSessionTokens(identity.userId);
    }
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    if (existingUser) {
      throw new AuthError(
        "This email already has an account. Log in with your existing method first.",
        409
      );
    }
    const firstName = payload.given_name?.trim() || null;
    const lastName = payload.family_name?.trim() || null;
    const workspaceName = firstName ? `${firstName}'s Workspace` : `${email.split("@")[0]}'s Workspace`;
    try {
      const user = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            password: null,
            firstName,
            lastName
          }
        });
        const workspace = await tx.workspace.create({
          data: { name: workspaceName }
        });
        await tx.workspaceMember.create({
          data: {
            userId: createdUser.id,
            workspaceId: workspace.id,
            role: "OWNER"
          }
        });
        await tx.authIdentity.create({
          data: {
            userId: createdUser.id,
            provider: "GOOGLE",
            providerUserId: payload.sub
          }
        });
        return createdUser;
      });
      return this.createSessionTokens(user.id);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new AuthError(
          "This account may already exist. Please try signing in again.",
          409
        );
      }
      throw error;
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthService
});
