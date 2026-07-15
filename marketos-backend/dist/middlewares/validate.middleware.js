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

// src/middlewares/validate.middleware.ts
var validate_middleware_exports = {};
__export(validate_middleware_exports, {
  validate: () => validate
});
module.exports = __toCommonJS(validate_middleware_exports);
var import_zod = require("zod");
var import_http_status_codes = require("http-status-codes");
var validate = (schema) => {
  return async (req, res, next) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      return next();
    } catch (error) {
      console.log("VALIDATION ERROR CAUGHT:", error);
      console.log("IS ZOD ERROR?", error instanceof import_zod.ZodError);
      if (error instanceof import_zod.ZodError) {
        return res.status(import_http_status_codes.StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Validation failed",
          errors: error.errors
        });
      }
      return next(error);
    }
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  validate
});
