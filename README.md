# Family Picnic Platform

A private family engagement hub for an annual picnic — RSVP, potluck coordination, photo sharing, and family communication.

> **Status:** Pre-MVP / scaffold. Prisma schema, auth, and tRPC middleware are in place. See [SPEC.md](SPEC.md) for the full spec and [CHANGELOG.md](CHANGELOG.md) for progress.

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

| Command                 | Purpose                |
| ----------------------- | ---------------------- |
| `npm run dev`           | Start dev server       |
| `npm run build`         | Production build       |
| `npm test`              | Run tests (Vitest)     |
| `npm run test:watch`    | Watch mode             |
| `npm run test:coverage` | Coverage report        |
| `npm run typecheck`     | TypeScript check       |
| `npm run lint`          | Lint                   |
| `npm run format`        | Format with Prettier   |
| `npm run ci`            | Full CI suite locally  |
| `npm run db:validate`   | Validate Prisma schema |
| `npm run db:studio`     | Prisma Studio          |

## Project Structure

```
src/
├── app/               # Next.js App Router routes
├── components/        # UI components per domain
├── lib/               # Prisma, tRPC, Auth, external services
├── hooks/             # React hooks (offline, event, potluck)
├── server/routers/    # tRPC route handlers
└── types/             # TypeScript type augmentations

prisma/
├── schema.prisma      # Data model (13 models, 14 enums)
├── seed.ts            # Database seed script
└── __tests__/         # Schema integrity tests
```

## CI

Push or open a PR against `main` — GitHub Actions runs typecheck, lint, format check, tests, Prisma validation, and a build.

## License

MIT
