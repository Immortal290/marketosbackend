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

// src/modules/audit_logs/controller.ts
var controller_exports = {};
__export(controller_exports, {
  AuditLogsController: () => AuditLogsController
});
module.exports = __toCommonJS(controller_exports);

// src/modules/audit_logs/repository.ts
var AuditLogsRepository = class {
};

// src/modules/audit_logs/service.ts
var AuditLogsService = class {
  repository = new AuditLogsRepository();
};

// src/modules/audit_logs/controller.ts
var AuditLogsController = class {
  service = new AuditLogsService();
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuditLogsController
});
