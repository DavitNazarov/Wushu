-- Move user email uniqueness from global to per-organisation
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_organisationId_email_key" ON "User"("organisationId", "email");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- Move news slug uniqueness from global to per-organisation
DROP INDEX IF EXISTS "NewsPost_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "NewsPost_organisationId_slug_key" ON "NewsPost"("organisationId", "slug");
