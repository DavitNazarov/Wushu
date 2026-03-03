"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RulesetsModule = void 0;
const common_1 = require("@nestjs/common");
const rulesets_service_1 = require("./rulesets.service");
const rulesets_controller_1 = require("./rulesets.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const auth_module_1 = require("../auth/auth.module");
let RulesetsModule = class RulesetsModule {
};
exports.RulesetsModule = RulesetsModule;
exports.RulesetsModule = RulesetsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, auth_module_1.AuthModule],
        controllers: [rulesets_controller_1.RulesetsController],
        providers: [rulesets_service_1.RulesetsService],
    })
], RulesetsModule);
//# sourceMappingURL=rulesets.module.js.map