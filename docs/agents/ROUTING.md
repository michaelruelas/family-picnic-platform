# Route Structure

Next.js App Router pages and API endpoints.

## Public Routes

| Route              | File                               | Description                      |
| ------------------ | ---------------------------------- | -------------------------------- |
| `/`                | `src/app/page.tsx`                 | Home page                        |
| `/login`           | `src/app/login/page.tsx`           | Login page                       |
| `/events`          | `src/app/events/page.tsx`          | Events list                      |
| `/events/[id]`     | `src/app/events/[id]/page.tsx`     | Event detail with RSVP & potluck |
| `/events/calendar` | `src/app/events/calendar/page.tsx` | Calendar view                    |
| `/potluck`         | `src/app/potluck/page.tsx`         | Potluck overview                 |
| `/photos`          | `src/app/photos/page.tsx`          | Photo gallery                    |
| `/my-events`       | `src/app/my-events/page.tsx`       | User's RSVP history              |

## Authenticated Routes

| Route             | File                              | Description                  |
| ----------------- | --------------------------------- | ---------------------------- |
| `/profile`        | `src/app/profile/page.tsx`        | User profile & preferences   |
| `/household`      | `src/app/household/page.tsx`      | Household dashboard          |
| `/household/tree` | `src/app/household/tree/page.tsx` | Family tree visualization    |
| `/onboarding`     | `src/app/onboarding/page.tsx`     | First-time onboarding wizard |

## Admin Routes

| Route                            | File                                             | Description                        |
| -------------------------------- | ------------------------------------------------ | ---------------------------------- |
| `/admin/dashboard`               | `src/app/admin/dashboard/page.tsx`               | Admin overview metrics             |
| `/admin/events`                  | `src/app/admin/events/page.tsx`                  | Event management list              |
| `/admin/events/new`              | `src/app/admin/events/new/page.tsx`              | Create event                       |
| `/admin/events/[id]/edit`        | `src/app/admin/events/[id]/edit/page.tsx`        | Edit event & potluck slots         |
| `/admin/events/[id]/edit/admins` | `src/app/admin/events/[id]/edit/admins/page.tsx` | Event admin management             |
| `/admin/invitations`             | `src/app/admin/invitations/page.tsx`             | Invitation management + CSV import |
| `/admin/communications`          | `src/app/admin/communications/page.tsx`          | Broadcast composer                 |
| `/admin/audit-log`               | `src/app/admin/audit-log/page.tsx`               | Audit log viewer                   |

## API Routes (REST)

### Auth

| Route                     | File                                      | Description      |
| ------------------------- | ----------------------------------------- | ---------------- |
| `/api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handler |

### User-Facing

| Route                   | File                                    | Description                 |
| ----------------------- | --------------------------------------- | --------------------------- |
| `/api/rsvp`             | `src/app/api/rsvp/route.ts`             | RSVP create/update/decline  |
| `/api/potluck-signup`   | `src/app/api/potluck-signup/route.ts`   | Potluck slot signup         |
| `/api/dependents`       | `src/app/api/dependents/route.ts`       | Dependent CRUD              |
| `/api/profile`          | `src/app/api/profile/route.ts`          | Profile preferences         |
| `/api/photo-reaction`   | `src/app/api/photo-reaction/route.ts`   | Photo reactions             |
| `/api/photo-upload-url` | `src/app/api/photo-upload-url/route.ts` | S3 presigned URL generation |
| `/api/photos`           | `src/app/api/photos/route.ts`           | Photo record CRUD           |

### Admin

| Route                              | File                                               | Description                 |
| ---------------------------------- | -------------------------------------------------- | --------------------------- |
| `/api/admin/events`                | `src/app/api/admin/events/route.ts`                | Admin event CRUD            |
| `/api/admin/events/[id]`           | `src/app/api/admin/events/[id]/route.ts`           | Admin single event          |
| `/api/admin/events/[id]/publish`   | `src/app/api/admin/events/[id]/publish/route.ts`   | Publish event               |
| `/api/admin/events/[id]/close`     | `src/app/api/admin/events/[id]/close/route.ts`     | Close RSVPs                 |
| `/api/admin/events/[id]/cancel`    | `src/app/api/admin/events/[id]/cancel/route.ts`    | Cancel event                |
| `/api/admin/events/[id]/admins`    | `src/app/api/admin/events/[id]/admins/route.ts`    | Event admin management      |
| `/api/admin/potluck-slots`         | `src/app/api/admin/potluck-slots/route.ts`         | Create potluck slots        |
| `/api/admin/potluck-slots/[id]`    | `src/app/api/admin/potluck-slots/[id]/route.ts`    | Update/delete potluck slots |
| `/api/admin/invitations/send`      | `src/app/api/admin/invitations/send/route.ts`      | Send invitations            |
| `/api/admin/invitations/resend`    | `src/app/api/admin/invitations/resend/route.ts`    | Resend invitations          |
| `/api/admin/invitations/track`     | `src/app/api/admin/invitations/track/route.ts`     | Track invitation delivery   |
| `/api/admin/communications/send`   | `src/app/api/admin/communications/send/route.ts`   | Send broadcast              |
| `/api/admin/communications/status` | `src/app/api/admin/communications/status/route.ts` | Broadcast status            |
| `/api/admin/audit-log`             | `src/app/api/admin/audit-log/route.ts`             | Audit log queries           |
| `/api/admin/csv-import`            | `src/app/api/admin/csv-import/route.ts`            | Bulk CSV import             |
| `/api/admin/users/search`          | `src/app/api/admin/users/search/route.ts`          | Search users by email       |

### Onboarding

| Route                       | File                                        | Description                   |
| --------------------------- | ------------------------------------------- | ----------------------------- |
| `/api/onboarding/household` | `src/app/api/onboarding/household/route.ts` | Onboarding household setup    |
| `/api/onboarding/dependent` | `src/app/api/onboarding/dependent/route.ts` | Onboarding dependent creation |
| `/api/onboarding/complete`  | `src/app/api/onboarding/complete/route.ts`  | Complete onboarding           |

### tRPC

| Route              | File                               | Description      |
| ------------------ | ---------------------------------- | ---------------- |
| `/api/trpc/[trpc]` | `src/app/api/trpc/[trpc]/route.ts` | tRPC API handler |
