# Family Picnic Platform

A private family engagement hub for an annual picnic — RSVP, potluck coordination, photo sharing, and family communication.

See [SPEC.md](SPEC.md) for the full technical specification, [CHANGELOG.md](CHANGELOG.md) for progress, and [AGENTS.md](AGENTS.md) for developer conventions.

## Stack

| Layer    | Choice                                              |
| -------- | --------------------------------------------------- |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 |
| Backend  | tRPC v11, Prisma 7, PostgreSQL                      |
| Auth     | NextAuth v4 + Google OAuth                          |
| Storage  | S3-compatible (MinIO / R2), PhotoPrism              |
| Comms    | Twilio (SMS), SendGrid (Email)                      |
| Infra    | Kubernetes, PWA                                     |

## Quickstart

```bash
cp .env.example .env      # fill in secrets
npm install               # installs deps + generates Prisma client
npm run db:push           # push schema to local Postgres
npm run db:seed           # seed with sample data
npm run dev               # http://localhost:3000
```

## Scripts

| Command                 | Purpose                 |
| ----------------------- | ----------------------- |
| `npm run dev`           | Start dev server        |
| `npm run build`         | Production build        |
| `npm run start`         | Start production server |
| `npm test`              | Run tests (Vitest)      |
| `npm run test:watch`    | Watch mode              |
| `npm run test:coverage` | Coverage report         |
| `npm run typecheck`     | TypeScript check        |
| `npm run lint`          | Lint                    |
| `npm run format`        | Format with Prettier    |
| `npm run ci`            | Full CI suite locally   |
| `npm run db:generate`   | Generate Prisma client  |
| `npm run db:push`       | Push schema to database |
| `npm run db:seed`       | Seed with sample data   |
| `npm run db:studio`     | Prisma Studio           |
| `npm run db:validate`   | Validate Prisma schema  |

## Project Structure

```
src/
├── app/               # Next.js App Router pages and API routes
├── components/        # UI components per domain
├── lib/               # tRPC, Prisma, Auth, external services, utilities
├── hooks/             # React hooks (offline, event, potluck, household)
└── server/routers/    # tRPC route handlers

prisma/
├── schema.prisma      # Data model (13 models, 14 enums)
├── seed.ts            # Database seed script
└── __tests__/         # Schema integrity tests
```

## CI

Push or open a PR against `main` — GitHub Actions runs typecheck, lint, format check, tests, Prisma validation, and a build.

## License

MIT
