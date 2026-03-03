"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireCapability = void 0;
const common_1 = require("@nestjs/common");
const capability_guard_1 = require("./capability.guard");
const RequireCapability = (capability) => (0, common_1.SetMetadata)(capability_guard_1.REQUIRE_CAPABILITY, capability);
exports.RequireCapability = RequireCapability;
//# sourceMappingURL=capability.decorator.js.map