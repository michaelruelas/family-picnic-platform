# Project Context

Family Picnic Platform is a private family engagement hub for an annual picnic event.

## Domain Model

### Core Entities

- **Household** - A family unit (e.g., "The Garcia Family"). Contains one or more Users and their Dependents.
- **User** - An adult member of a household. Authenticated via Google OAuth or dev credentials.
- **Dependent** - A child or other family member with dietary restrictions, managed by a User.
- **Event** - The annual picnic. Has a date, location, RSVP deadline, and max capacity.
- **Invitation** - Links a Household to an Event. Single-use token sent via email.
- **RSVP** - A Household's response to an Event (CONFIRMED/DECLINED/WAITLISTED).
- **PotluckSlot** - A food category for an Event (MAIN, SIDE, DESSERT, DRINK).
- **PotluckSignup** - A User's commitment to bring a specific dish to a PotluckSlot.
- **Photo** - Event photo stored in S3, processed by PhotoPrism for thumbnails.
- **PhotoReaction** - A User's reaction to a Photo (emoji).
- **CommunicationLog** - Tracks sent SMS/email notifications.

### User Roles

| Role          | Description                                |
| ------------- | ------------------------------------------ |
| `GUEST`       | Limited to RSVP for own invitation         |
| `MEMBER`      | Full household access, potluck signup      |
| `ADMIN_ADULT` | Admin of own household, can manage events  |
| `ADMIN`       | Full system access, broadcasts, audit logs |

### External Services

| Service      | Purpose                         |
| ------------ | ------------------------------- |
| Google OAuth | User authentication             |
| Twilio       | SMS notifications               |
| SendGrid     | Transactional email             |
| PhotoPrism   | Photo processing and thumbnails |
| S3/R2        | Raw photo storage               |
| PostgreSQL   | Primary data store              |
| Prisma       | ORM                             |

## Key Concepts

### RSVP Flow

1. Admin creates Event and sends Invitations to Households
2. Invitation contains a single-use token
3. User clicks link, authenticates, and submits RSVP
4. RSVP includes headcount and dietary notes
5. If event is at capacity, user is placed on waitlist

### Potluck Coordination

1. Admin creates PotluckSlots for an Event (MAIN, SIDE, etc.)
2. Each slot has a `currentSignups` counter and optional `maxSignups`
3. Users sign up for slots with a specific dish
4. Slot updates use `$transaction` with Serializable isolation to prevent race conditions
5. Declining an RSVP automatically releases potluck signups

### Dev Auth

For local development without OAuth:

1. Set `DEV_AUTH_ENABLED=true` in `.env`
2. Use any seeded user's email as username and `password123` as password
3. Seeded users: admin@family-picnic.example.com, maria.garcia@example.com, etc.

### Waitlist Logic

When an RSVP is confirmed but event is at capacity:

- RSVP status becomes `WAITLISTED` with a `waitlistPosition`
- First waitlisted user is promoted when a confirmed RSVP is declined
- Waitlist positions are shifted after promotion

## Tech Stack

| Layer    | Technology                                                    |
| -------- | ------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, React 19 |
| Backend  | tRPC v11, Prisma 7, PostgreSQL                                |
| Auth     | NextAuth v4 + Google OAuth + dev credentials                  |
| Storage  | S3-compatible (MinIO/R2), PhotoPrism                          |
| Comms    | Twilio (SMS), SendGrid (Email)                                |
| Testing  | Vitest (unit), Playwright (e2e)                               |
| Infra    | Kubernetes (pending)                                          |
