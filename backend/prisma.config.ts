import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `env('DATABASE_URL')` throws when the var is missing, which breaks tools
// that load this config WITHOUT an env file (knip in CI, editor plugins).
// Fall back to a syntactically valid placeholder — every real Prisma command
// (migrate/seed/studio) runs with backend/.env loaded, so the fallback is
// never used to actually connect.
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
