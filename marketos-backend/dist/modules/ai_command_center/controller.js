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

// src/modules/ai_command_center/controller.ts
var controller_exports = {};
__export(controller_exports, {
  AiCommandCenterController: () => AiCommandCenterController
});
module.exports = __toCommonJS(controller_exports);

// src/modules/ai_command_center/repository.ts
var AiCommandCenterRepository = class {
};

// src/modules/ai_command_center/service.ts
var AiCommandCenterService = class {
  repository = new AiCommandCenterRepository();
};

// src/modules/ai_command_center/controller.ts
var AiCommandCenterController = class {
  service = new AiCommandCenterService();
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AiCommandCenterController
});
