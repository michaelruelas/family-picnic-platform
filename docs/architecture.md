# Family Picnic Platform - Technical Architecture

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   RSVP Card │  │  Household  │  │   Potluck   │  │    Photo    │         │
│  │  Component  │  │  Dashboard  │  │   Planner   │  │   Gallery   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                │                │
│  ┌──────┴────────────────┴────────────────┴────────────────┴──────┐         │
│  │                    Next.js App (PWA)                          │         │
│  │  ┌─────────────────────────────────────────────────────────┐  │         │
│  │  │                   tRPC Client                          │  │         │
│  │  └─────────────────────────────────────────────────────────┘  │         │
│  └───────────────────────────────┬─────────────────────────────────┘         │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │ HTTPS
┌──────────────────────────────────┼──────────────────────────────────────────┐
│                         API LAYER (tRPC)                                     │
│  ┌───────────────────────────────┴─────────────────────────────────┐        │
│  │                     Next.js Server                                │        │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │        │
│  │  │   Auth  │ │  User   │ │Household│ │  Event  │ │   RSVP  │   │        │
│  │  │ Router  │ │ Router  │ │ Router  │ │ Router  │ │ Router  │   │        │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │        │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │        │
│  │  │ Potluck │ │   Comms │ │  Photo  │ │  Admin  │ │         │   │        │
│  │  │ Router  │ │ Router  │ │ Router  │ │ Router  │ │         │   │        │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │        │
│  │  ┌─────────────────────────────────────────────────────────┐  │        │
│  │  │              Middleware: Auth │ Admin │ Audit           │  │        │
│  │  └─────────────────────────────────────────────────────────┘  │        │
│  └───────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌──────────────────────────────────┼──────────────────────────────────────────┐
│                          DATA LAYER                                          │
│  ┌───────────────────────────────┴─────────────────────────────────┐        │
│  │                    PostgreSQL (Prisma ORM)                       │        │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │        │
│  │  │Household│ │   User  │ │Dependent│ │  Event  │ │Invitation│    │        │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     │        │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │        │
│  │  │   RSVP  │ │Potluck  │ │Potluck  │ │   Comms │ │  Photo  │     │        │
│  │  │         │ │  Slot   │ │ Signup  │ │   Log   │ │         │     │        │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     │        │
│  │  ┌─────────┐ ┌─────────┐                                           │        │
│  │  │Photo    │ │  Admin  │                                           │        │
│  │  │Reaction │ │  Audit  │                                           │        │
│  │  └─────────┘ └─────────┘                                           │        │
│  └───────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌──────────────────────────────────┼──────────────────────────────────────────┐
│                      EXTERNAL SERVICES                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │    Google   │ │   Twilio    │ │  Email      │ │  PhotoPrism │           │
│  │   OAuth    │ │    SMS      │ │ (SendGrid)  │ │   Gallery   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│                          ┌─────────────┐                                    │
│                          │  S3/R2     │                                    │
│                          │  Storage   │                                    │
│                          └─────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Component Descriptions

### 2.1 Frontend Components

| Component           | Purpose                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| RSVP Card           | Allows guests to respond to event invitations with attendee count and dietary notes |
| Household Dashboard | Manages family members, dependents, and view family RSVP history                    |
| Potluck Planner     | Displays categorized food slots, allows signup with item details                    |
| Photo Gallery       | Grid view of event photos with reactions, powered by PhotoPrism                     |
| Admin Dashboard     | Event management, broadcast messaging, user management, audit logs                  |

### 2.2 API Routers (tRPC)

| Router          | Endpoints                                            |
| --------------- | ---------------------------------------------------- |
| `auth`          | session, signIn, signOut, callback                   |
| `user`          | me, update, linkHousehold                            |
| `household`     | create, get, update, addMember, removeMember         |
| `event`         | create, list, get, update, cancel                    |
| `rsvp`          | create, update, getByEvent, getByUser                |
| `potluck`       | getSlots, signup, updateItem, removeSignup           |
| `communication` | sendInvite, sendRsvpReminder, sendBroadcast          |
| `photo`         | getUploadUrl, confirmUpload, getGallery, addReaction |
| `admin`         | getUsers, getAuditLog, manageEvent, impersonateUser  |

### 2.3 Database Models (Prisma)

```
Household ─────┬──── User (owner)
               │
               └──── Dependent
                     │
                     └──── Invitation ──── Event
                           │
                           └──── RSVP
                                 │
                                 └──── PotluckSignup ─── PotluckSlot

Event ──── Photo ─── PhotoReaction
      │
      └──── CommunicationLog

AdminAuditLog
```

## 3. Data Flow Diagrams

### 3.1 Invitation and Registration Flow

```
Admin Dashboard
      │
      ▼
┌─────────────────┐
│ Create Invitation│
│ (tRPC: admin.)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Store Invitation│────▶│  PostgreSQL │
│ in DB           │     └─────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐     ┌──────────────┐
│ Send Email via  │────▶│  SendGrid   │────▶│ Guest Email  │
│ communication.  │     └─────────────┘     └──────────────┘
└─────────────────┘
         │
         ▼ (async)
┌─────────────────┐
│ Log in CommsLog │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Record audit    │────▶│AdminAuditLog│
└─────────────────┘     └─────────────┘
```

### 3.2 RSVP Submission Flow

```
Guest clicks link
      │
      ▼
┌─────────────────┐     ┌─────────────┐
│ Google OAuth    │────▶│   Google    │────── Authenticated
│ sign-in         │     └─────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ tRPC: rsvp.     │────▶│  PostgreSQL │──── RSVP + Household
│ create          │     └─────────────┘     created/updated
└────────┬────────┘
         │
         ▼ (async)
┌─────────────────┐     ┌─────────────┐
│ Send SMS confirm│────▶│   Twilio    │────── Guest Phone
│ via coms.       │     └─────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Update CommsLog │
│ (SMS_DELIVERED) │
└─────────────────┘
```

### 3.3 Potluck Signup Flow

```
User (Authenticated)
      │
      ▼
┌─────────────────┐     ┌─────────────┐
│ tRPC: potluck.  │────▶│  PostgreSQL │
│ signup          │     └─────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Slot reserved   │
│ with item info  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Emit to guests  │────▶│ Real-time   │────── Dashboard
│ via pusher/    │     │ (optional)  │       updates
│ polling         │     └─────────────┘
└─────────────────┘
```

### 3.4 Photo Upload Flow

```
User selects photo
      │
      ▼
┌─────────────────┐     ┌─────────────┐
│ tRPC: photo.    │────▶│  PostgreSQL │──── Photo record
│ getUploadUrl    │     └─────────────┘     (pending)
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Return S3       │────▶│    S3/R2    │
│ presigned URL   │     └─────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ User uploads    │──────────────┐
│ directly to S3  │              │
└─────────────────┘              │
                                  ▼
                         ┌─────────────────┐
                         │ Trigger webhook │
                         │ or poll S3     │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐     ┌─────────────┐
                         │ PhotoPrism      │────▶│ Generate    │
                         │ processes image │     │ thumbnails  │
                         └─────────────────┘     └─────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ Update DB:      │
                         │ photo.status    │
                         │ = READY        │
                         └─────────────────┘
```

### 3.5 Broadcast Message Flow

```
Admin initiates broadcast
      │
      ▼
┌─────────────────┐     ┌─────────────┐
│ tRPC: admin.    │────▶│  Validate   │
│ sendBroadcast   │     │ recipients  │
└────────┬────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Create CommsLog │────▶│  PostgreSQL │
│ entries per     │     │  (pending)  │
│ recipient       │     └─────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Enqueue job     │────▶│   Redis     │──── Job Queue
│ (if using)      │     └─────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Send SMS via    │────▶│   Twilio    │
│ Twilio          │     └─────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Send Email via  │────▶│  SendGrid    │
│ SendGrid        │     └─────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Update CommsLog │
│ status          │
└─────────────────┘
```

## 4. Infrastructure Diagram (Kubernetes)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        family-picnic Namespace                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                     Ingress Controller                         │  │
│  │                    (nginx/traefik)                             │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                          │
│  ┌──────────────────────────┴───────────────────────────────────┐  │
│  │                                                              │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │  │
│  │  │ nextjs  │  │ nextjs  │  │ nextjs  │  │ nextjs  │  ReplicaSet │
│  │  │  pod-1  │  │  pod-2  │  │  pod-3  │  │  pod-4  │         │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │  │
│  │                          │                                    │  │
│  └──────────────────────────┼────────────────────────────────────┘  │
│                             │                                          │
│  ┌──────────────────────────┼────────────────────────────────────┐  │
│  │                          ▼                                    │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │  │
│  │  │   db    │  │  redis  │  │  minio  │  │         │         │  │
│  │  │  pod    │  │  pod    │  │  pod    │  │         │         │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │  │
│  │     │            │            │                              │  │
│  └─────┼────────────┼────────────┼──────────────────────────────┘  │
│        │            │            │                                    │
│        ▼            ▼            ▼                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────┐                      │
│  │PostgreSQL│  │  Redis  │  │ 50TB Storage    │                      │
│  │  (PVC)   │  │ (PVC)   │  │  (PVC)         │                      │
│  └─────────┘  └─────────┘  └─────────────────┘                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Kubernetes Resources

| Resource   | Type        | Replicas | Storage |
| ---------- | ----------- | -------- | ------- |
| nextjs-app | Deployment  | 3+       | -       |
| postgresql | StatefulSet | 1        | 100GB   |
| redis      | StatefulSet | 1        | 10GB    |
| minio      | StatefulSet | 1        | 50TB    |

## 5. Security Model

### 5.1 Authentication (NextAuth.js + Google OAuth)

```
┌──────────────────────────────────────────────────────┐
│                   Auth Flow                          │
├──────────────────────────────────────────────────────┤
│                                                      │
│   User ──▶ Click "Sign in" ──▶ NextAuth.js         │
│              │                    │                  │
│              │                    ▼                  │
│              │              Google OAuth 2.0        │
│              │                    │                  │
│              │                    ▼                  │
│              │              OAuth Callback           │
│              │                    │                  │
│              │                    ▼                  │
│              │              Session + JWT created    │
│              │                    │                  │
│              └──────────────────◀─┘                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 5.2 Authorization Model

```
┌─────────────────────────────────────────────────────┐
│                Role-Based Access Control             │
├─────────────────────────────────────────────────────┤
│                                                      │
│   Roles:                                            │
│   ├── GUEST: Limited to RSVP for own invitation     │
│   ├── MEMBER: Full household access, potluck signup  │
│   ├── ADMIN: Full system access, broadcasts, audit   │
│   └── SUPER_ADMIN: User management, impersonation    │
│                                                      │
│   Middleware Chain:                                 │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐         │
│   │   Auth  │──▶│  Admin  │──▶│  Audit  │         │
│   │ Check   │   │  Check  │   │  Log    │         │
│   └─────────┘   └─────────┘   └─────────┘         │
│                                                      │
│   Household Data Isolation:                         │
│   - All queries scoped by householdId from session  │
│   - Admin queries can override with explicit param  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 5.3 Data Isolation

| Data Type          | Isolation Strategy                                                |
| ------------------ | ----------------------------------------------------------------- |
| Household members  | `householdId` foreign key, queries filtered by session            |
| RSVP               | Linked to household + invitation, not visible to other households |
| Photos             | Per-event visibility, reactions scoped to user                    |
| Communication logs | Admin-only access                                                 |
| Audit logs         | Immutable, admin-only                                             |

## 6. External Service Integration Points

### 6.1 Service Connection Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                                                │
│  │   Google    │◀── OAuth 2.0 ─────────────────────────────    │
│  │   OAuth     │      Endpoints: /auth/signin, /api/auth/callback│
│  └──────┬──────┘                                                │
│         │ NEXTAUTH_SECRET                                       │
│         ▼                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │   Twilio    │◀───│  API Keys   │────▶│ Outbound SMS│        │
│  │   SMS       │     │ (TWILIO_*)  │     │ (comm_logs) │        │
│  └──────┬──────┘     └─────────────┘     └─────────────┘        │
│         │                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │  SendGrid   │◀───│  API Key    │────▶│ Transactional│        │
│  │   Email     │     │ (SENDGRID) │     │ Email        │        │
│  └──────┬──────┘     └─────────────┘     └─────────────┘        │
│         │                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │ PhotoPrism  │◀───│ HTTP API    │────▶│ Thumbnail    │        │
│  │   Gallery   │     │ (internal) │     │ generation   │        │
│  └──────┬──────┘     └─────────────┘     └─────────────┘        │
│         │                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │    S3/R2   │◀────│  Presigned  │────▶│ Raw image    │        │
│  │   Storage  │     │    URLs     │     │ storage      │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Integration Configuration

```typescript
// Environment variables for external services
const externalServices = {
  google: {
    GOOGLE_CLIENT_ID: string,
    GOOGLE_CLIENT_SECRET: string,
  },
  twilio: {
    TWILIO_ACCOUNT_SID: string,
    TWILIO_AUTH_TOKEN: string,
    TWILIO_PHONE_NUMBER: string,
  },
  sendgrid: {
    SENDGRID_API_KEY: string,
    SENDGRID_FROM_EMAIL: string,
  },
  storage: {
    S3_ENDPOINT: string, // MinIO endpoint or R2 endpoint
    S3_BUCKET: string,
    S3_ACCESS_KEY: string,
    S3_SECRET_KEY: string,
    S3_PUBLIC_URL: string, // Public CDN URL for images
  },
  photoprism: {
    PHOTOPRISM_URL: string, // Internal service URL
    PHOTOPRISM_API_KEY: string,
  },
};
```

### 6.3 PhotoPrism Integration

```
Upload Flow with PhotoPrism:
┌──────────┐     ┌─────────┐     ┌───────────┐     ┌───────────┐
│  User    │────▶│  S3/R2  │────▶│ PhotoPrism│────▶│ Generate  │
│ uploads  │     │  (raw)  │     │  (watch)  │     │ thumbnails│
└──────────┘     └─────────┘     └───────────┘     └───────────┘
                                            │
                                            ▼
                                    ┌───────────┐
                                    │ Webhook   │
                                    │ (optional)│
                                    └─────┬─────┘
                                          │
                                          ▼
                                    ┌───────────┐
                                    │ Update    │
                                    │ DB status │
                                    └───────────┘
```

## 7. Prisma Schema Summary

```prisma
// Core Models
model Household { id, name, createdAt, updatedAt }
model User      { id, email, name, image, householdId, role }
model Dependent { id, name, relationship, householdId }

// Event & Invitation
model Event      { id, title, date, location, description, createdAt }
model Invitation { id, eventId, householdId, token, expiresAt }

// Response & Potluck
model RSVP           { id, invitationId, attendeeCount, dietaryNotes, createdAt }
model PotluckSlot    { id, eventId, category, description }
model PotluckSignup  { id, slotId, rsvpId, itemName, bringing }

/ Communication
model CommunicationLog { id, eventId, householdId, type, channel, status, sentAt }

// Photos
model Photo       { id, eventId, s3Key, thumbnailKey, uploadedBy, status }
model PhotoReaction { id, photoId, userId, type }

// Admin
model AdminAuditLog { id, userId, action, details, createdAt }
```

## 8. Route Structure

The application uses flat route organization under `src/app/` without route groups.

### Route Groups Considered But Not Used

Route groups `(auth)` and `(event)` were evaluated for shared layouts but were not adopted:

- `(auth)/login/` — redundant with `/login/`, OAuth callbacks handled via `/api/auth/[...nextauth]`
- `(event)/[eventId]/rsvp/`, `(event)/[eventId]/potluck/`, `(event)/[eventId]/photos/` — inline on event detail page `/events/[id]`

### Chosen Route Layout

Flat routes under `/events/[id]/*` for event sub-pages:

- `/events/[id]` — event detail with RSVP and potluck inline
- `/events/[id]/edit` — admin event editing
- `/events/[id]/edit/admins` — event admin management

No nested route groups; each page is a standalone route directory with its own `page.tsx`.

### Public Routes

| Route              | Description                      |
| ------------------ | -------------------------------- |
| `/`                | Home page                        |
| `/login`           | Login page                       |
| `/events`          | Events list                      |
| `/events/[id]`     | Event detail with RSVP & potluck |
| `/events/calendar` | Calendar view                    |
| `/potluck`         | Potluck overview                 |
| `/photos`          | Photo gallery                    |
| `/my-events`       | User's RSVP history              |

### Authenticated Routes

| Route             | Description                  |
| ----------------- | ---------------------------- |
| `/profile`        | User profile & preferences   |
| `/household`      | Household dashboard          |
| `/household/tree` | Family tree visualization    |
| `/onboarding`     | First-time onboarding wizard |

### Admin Routes

| Route                            | Description                        |
| -------------------------------- | ---------------------------------- |
| `/admin/dashboard`               | Admin overview metrics             |
| `/admin/events`                  | Event management list              |
| `/admin/events/new`              | Create event                       |
| `/admin/events/[id]/edit`        | Edit event & potluck slots         |
| `/admin/events/[id]/edit/admins` | Event admin management             |
| `/admin/invitations`             | Invitation management + CSV import |
| `/admin/communications`          | Broadcast composer                 |
| `/admin/audit-log`               | Audit log viewer                   |

## 9. API Route Protection

```typescript
// Middleware stack order
const middlewareStack = [
  // 1. Validate session exists
  { name: 'auth', handler: authMiddleware },

  // 2. Check role permissions (if required)
  { name: 'admin', handler: requireAdmin },

  // 3. Log all mutations for audit
  { name: 'audit', handler: auditLogger },
];
```

---

_Document Version: 1.0_  
_Last Updated: 2026-07-02_
