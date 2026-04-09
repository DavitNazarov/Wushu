import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    // On Neon: DATABASE_URL = pooled (pgBouncer), DIRECT_URL = direct connection.
    // Prisma uses directUrl for migrations and prisma db execute (DDL requires it).
    url: env('DATABASE_URL'),
    directUrl: env('DIRECT_URL'),
  },
});
