import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
    // Optional. Prisma only consults `shadowDatabaseUrl` when running
    // `migrate dev` or `migrate diff` (which need a throwaway shadow
    // schema); `migrate deploy`, `db push`, `db validate`, and
    // `prisma generate` all ignore it. Reading via `process.env` and
    // passing `undefined` when unset keeps `prisma generate` (the
    // postinstall hook) green in environments that don't have a
    // shadow database — including CI. Set SHADOW_DATABASE_URL in
    // `.env` when you need to author or diff a new migration; the
    // `.env.example` documents the recipe.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
  migrations: {
    seed: 'bun run prisma/seed.ts',
  },
});
