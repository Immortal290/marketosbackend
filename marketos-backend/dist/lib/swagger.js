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

// src/lib/swagger.ts
var swagger_exports = {};
__export(swagger_exports, {
  setupSwagger: () => setupSwagger
});
module.exports = __toCommonJS(swagger_exports);
var import_swagger_ui_express = __toESM(require("swagger-ui-express"));
var swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "MarketOS API",
    version: "1.0.0",
    description: "API documentation for MarketOS Backend"
  },
  servers: [
    {
      url: "http://localhost:3000/api/v1",
      description: "Development server"
    }
  ],
  paths: {
    "/health": {
      get: {
        summary: "Check API Health",
        responses: {
          "200": {
            description: "Successful operation",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    timestamp: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
var setupSwagger = (app) => {
  app.use("/api-docs", import_swagger_ui_express.default.serve, import_swagger_ui_express.default.setup(swaggerDocument));
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  setupSwagger
});
