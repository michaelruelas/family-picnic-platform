# Troubleshooting

Common issues and solutions for the Family Picnic Platform.

## Development Setup

### "Docker is required but not installed"

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for your platform.

### "PostgreSQL connection refused"

1. Ensure Docker is running: `docker ps`
2. Start the postgres container: `docker compose up -d postgres`
3. Wait 5 seconds for PostgreSQL to initialize
4. Check `.env` has the correct `DATABASE_URL`

### ".env file not found"

Run `cp .env.example .env` and fill in your secrets, particularly:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Random string for session encryption
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` - Google OAuth credentials

## Database Issues

### "Prisma client is out of sync"

Run `npm run db:generate` after modifying the schema.

### "Database tables not found"

Run `npm run db:push` to sync the schema with your database.

### "Seed script fails"

Ensure PostgreSQL is running and `DATABASE_URL` is correctly set in `.env`.

## Authentication Issues

### "OAuth callback error"

1. Verify `NEXTAUTH_URL` in `.env` matches your environment
2. For local development: `NEXTAUTH_URL=http://localhost:3000`
3. Check Google OAuth credentials are correct in `.env`

### "Session expired on every page load"

1. Check `NEXTAUTH_SECRET` is set in `.env`
2. The secret should be at least 32 characters

## Build & TypeScript

### "TypeScript errors about missing types"

Run `npm run db:generate` to regenerate Prisma types.

### "Cannot find module 'next'"

Run `npm install` to ensure all dependencies are installed.

### "Build fails"

1. Run `npm run typecheck` to identify type errors
2. Run `npm run lint` to check for lint errors
3. Try clearing `.next` cache: `rm -rf .next`

## Service Worker (PWA)

### "Offline support not working"

1. Ensure `public/sw.js` exists
2. Check browser console for service worker errors
3. Try unregistering and re-registering the service worker in browser devtools

## External Services

### "Photo upload fails"

1. Check S3-compatible storage is configured (`S3_*` vars in `.env`)
2. Verify `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`

### "PhotoPrism integration not working"

1. Ensure PhotoPrism is running and accessible at `PHOTOPRISM_URL`
2. Check `PHOTOPRISM_API_KEY` is configured

### "SMS/Email not sending"

1. Verify Twilio credentials (`TWILIO_*` vars)
2. Verify SendGrid credentials (`SENDGRID_*` vars)
3. Check service is not in sandbox mode (Twilio)

## Getting Help

- Check [AGENTS.md](AGENTS.md) for developer conventions
- Check [SPEC.md](SPEC.md) for technical specification
- Check [docs/decisions/](docs/decisions/) for architectural decisions
