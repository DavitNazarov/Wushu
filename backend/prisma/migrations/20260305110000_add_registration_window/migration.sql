-- Add online registration window fields to Event.
-- registrationOpensAt: when coaches can start registering athletes (may pre-date competition).
-- registrationClosesAt: when registration closes (auto-computed from first weigh-in day if NULL).

ALTER TABLE "Event" ADD COLUMN "registrationOpensAt" TIMESTAMP(3);
ALTER TABLE "Event" ADD COLUMN "registrationClosesAt" TIMESTAMP(3);
