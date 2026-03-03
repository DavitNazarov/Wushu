"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPABILITIES = exports.ROLES = void 0;
exports.getCapabilitiesForRole = getCapabilitiesForRole;
exports.ROLES = {
    admin: 'admin',
    coach: 'coach',
    athlete: 'athlete',
};
exports.CAPABILITIES = {
    EVENTS_VIEW_PUBLIC: 'events:view_public',
    EVENTS_MANAGE: 'events:manage',
    ATHLETES_MANAGE: 'athletes:manage',
    WEIGHIN_RECORD: 'weighin:record',
    BRACKETS_PUBLISH: 'brackets:publish',
    SCORING_OPERATE: 'scoring:operate',
    CAN_MANAGE_EVENT: 'CAN_MANAGE_EVENT',
    CAN_MANAGE_RULESETS: 'CAN_MANAGE_RULESETS',
};
const ADMIN_CAPABILITIES = [
    exports.CAPABILITIES.EVENTS_VIEW_PUBLIC,
    exports.CAPABILITIES.EVENTS_MANAGE,
    exports.CAPABILITIES.ATHLETES_MANAGE,
    exports.CAPABILITIES.WEIGHIN_RECORD,
    exports.CAPABILITIES.BRACKETS_PUBLISH,
    exports.CAPABILITIES.SCORING_OPERATE,
    exports.CAPABILITIES.CAN_MANAGE_EVENT,
    exports.CAPABILITIES.CAN_MANAGE_RULESETS,
];
function getCapabilitiesForRole(role) {
    if (role === 'admin')
        return [...ADMIN_CAPABILITIES];
    if (role === 'coach')
        return [exports.CAPABILITIES.EVENTS_VIEW_PUBLIC, exports.CAPABILITIES.ATHLETES_MANAGE];
    if (role === 'athlete')
        return [exports.CAPABILITIES.EVENTS_VIEW_PUBLIC];
    return [];
}
//# sourceMappingURL=capabilities.js.map