export declare const ROLES: {
    readonly admin: "admin";
    readonly coach: "coach";
    readonly athlete: "athlete";
};
export type UserRole = (typeof ROLES)[keyof typeof ROLES];
export declare const CAPABILITIES: {
    readonly EVENTS_VIEW_PUBLIC: "events:view_public";
    readonly EVENTS_MANAGE: "events:manage";
    readonly ATHLETES_MANAGE: "athletes:manage";
    readonly WEIGHIN_RECORD: "weighin:record";
    readonly BRACKETS_PUBLISH: "brackets:publish";
    readonly SCORING_OPERATE: "scoring:operate";
    readonly CAN_MANAGE_EVENT: "CAN_MANAGE_EVENT";
    readonly CAN_MANAGE_RULESETS: "CAN_MANAGE_RULESETS";
};
export type CapabilityCode = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];
export declare function getCapabilitiesForRole(role: UserRole): string[];
