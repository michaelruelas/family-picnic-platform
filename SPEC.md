# Family Picnic Platform - Technical Specification

## 1. Overview

### Purpose

A private family engagement hub for an annual picnic, designed for users across multiple generations with varying technical abilities. Combines RSVP management, potluck coordination, photo sharing, and family communication in a single platform.

### Tech Stack

| Layer          | Technology                                               |
| -------------- | -------------------------------------------------------- |
| Frontend       | Next.js 14+ (App Router), TypeScript, Tailwind CSS       |
| Backend        | tRPC v11, Prisma ORM, PostgreSQL                         |
| Auth           | NextAuth.js with Google OAuth SSO                        |
| File Storage   | PhotoPrism (Kubernetes, 50TB), S3-compatible for uploads |
| Communications | Twilio (Email + SMS)                                     |
| Infrastructure | Kubernetes, PWA with offline support                     |
| Deployment     | Self-hosted family server                                |

### Design Principles

1. **Multi-generational accessibility**: Simple UI, large touch targets, forgiving interactions
2. **Offline resilience**: Core features work without connectivity
3. **Privacy-first**: EXIF stripping, authenticated-only access, one-click unsubscribes
4. **Cumulative headcount**: Household RSVPs aggregate across all members
5. **Nested households**: Parent-child household hierarchy for growing families

---

## 2. User Types & Permissions

### 2.1 User Roles

| Role            | Login | Manage Household | RSVP           | Potluck   | Upload Photos | Admin Actions |
| --------------- | ----- | ---------------- | -------------- | --------- | ------------- | ------------- |
| **Admin Adult** | Yes   | Yes              | Yes            | Yes       | Yes           | No            |
| **Dependent**   | No    | No               | Via Admin      | Via Admin | Via Admin     | No            |
| **Admin**       | Yes   | Yes              | Yes (override) | Yes       | Yes           | Yes           |

### 2.2 User Type Definitions

#### Admin Adult

- Authenticated user who can log in via Google OAuth
- Can manage their household (add/remove dependents, manage child households)
- Can RSVP and sign up for potluck slots
- Can upload and react to photos
- Can receive broadcast messages

#### Dependent

- Non-login account attached to a household
- Managed entirely by Admin Adults in the household
- Included in RSVP headcount
- Cannot independently RSVP or upload photos

#### Admin

- Event-level administrators
- Multiple admins per event allowed
- Capabilities:
  - Invite guests from previous events
  - Override RSVPs
  - Manually add unregistered guests
  - Manage potluck categories and slots
  - Broadcast messages to recipients
  - View dashboards (headcount, pending RSVPs, food summary)
  - Bulk CSV import
  - Full audit log access

### 2.3 Communication Preferences

```
EMAIL | SMS | BOTH | NONE
```

Users configure preferred channel; all broadcasts respect this preference with one-click unsubscribe per channel.

---

## 3. Data Models

### 3.1 Entity Relationship Summary

```
Household (1) ──────< (N) User
      │
      ├────< (N) Dependent
      │
      └────< (N) Nested Household (self-reference)

User (1) ──────< (N) RSVP
      │
      ├────< (N) PotluckSignup
      │
      ├────< (N) PhotoReaction
      │
      └────< (1) CommunicationLog

Event (1) ──────< (N) Invitation
      │
      ├────< (N) RSVP
      │
      ├────< (N) PotluckSlot
      │
      ├────< (N) Photo
      │
      └────< (1) AdminAuditLog

RSVP (1) ──────< (N) PotluckSignup
```

### 3.2 Core Models

#### Household

| Field             | Type     | Description                            |
| ----------------- | -------- | -------------------------------------- |
| id                | UUID     | Primary key                            |
| name              | String   | Household name (e.g., "Ruelas Family") |
| parentHouseholdId | UUID?    | Self-reference for nested households   |
| createdAt         | DateTime | Creation timestamp                     |

#### User

| Field                   | Type     | Description            |
| ----------------------- | -------- | ---------------------- |
| id                      | UUID     | Primary key            |
| householdId             | UUID     | FK to Household        |
| googleId                | String   | Google OAuth subject   |
| email                   | String   | Unique email           |
| name                    | String   | Display name           |
| role                    | Enum     | ADMIN_ADULT, ADMIN     |
| communicationPreference | Enum     | EMAIL, SMS, BOTH, NONE |
| createdAt               | DateTime | Creation timestamp     |

#### Dependent

| Field        | Type   | Description                       |
| ------------ | ------ | --------------------------------- |
| id           | UUID   | Primary key                       |
| householdId  | UUID   | FK to Household                   |
| name         | String | Dependent name                    |
| relationship | String | e.g., "son", "daughter", "mother" |

#### Event

| Field        | Type     | Description                         |
| ------------ | -------- | ----------------------------------- |
| id           | UUID     | Primary key                         |
| name         | String   | Event name                          |
| description  | String   | CMS content                         |
| date         | DateTime | Event date                          |
| location     | String   | Venue name                          |
| mapImageUrl  | String?  | Admin-uploaded static map           |
| rsvpDeadline | DateTime | RSVP cutoff                         |
| maxCapacity  | Int?     | Optional capacity limit             |
| status       | Enum     | DRAFT, PUBLISHED, CLOSED, CANCELLED |
| createdAt    | DateTime | Creation timestamp                  |

#### Invitation

| Field       | Type      | Description              |
| ----------- | --------- | ------------------------ |
| id          | UUID      | Primary key              |
| eventId     | UUID      | FK to Event              |
| householdId | UUID      | FK to Household          |
| status      | Enum      | PENDING, SENT, DELIVERED |
| sentAt      | DateTime? | Delivery timestamp       |

#### RSVP

| Field        | Type      | Description                               |
| ------------ | --------- | ----------------------------------------- |
| id           | UUID      | Primary key                               |
| eventId      | UUID      | FK to Event                               |
| userId       | UUID      | FK to User (responder)                    |
| householdId  | UUID      | FK to Household                           |
| status       | Enum      | INVITED, PENDING, CONFIRMED, DECLINED     |
| headcount    | Int       | Number of attending (includes dependents) |
| dietaryNotes | String?   | Special dietary requirements              |
| respondedAt  | DateTime? | Response timestamp                        |
| createdAt    | DateTime  | Creation timestamp                        |

**State Machine**: `INVITED → PENDING → RESPONDED (CONFIRMED | DECLINED)`

#### PotluckSlot

| Field      | Type   | Description                          |
| ---------- | ------ | ------------------------------------ |
| id         | UUID   | Primary key                          |
| eventId    | UUID   | FK to Event                          |
| category   | Enum   | MAIN, SIDE, DESSERT, DRINK, OTHER    |
| slotType   | Enum   | LIMITED, UNLIMITED                   |
| name       | String | Slot description (e.g., "Main Dish") |
| maxSignups | Int?   | Max entries for LIMITED slots        |

#### PotluckSignup

| Field         | Type     | Description                                               |
| ------------- | -------- | --------------------------------------------------------- |
| id            | UUID     | Primary key                                               |
| slotId        | UUID     | FK to PotluckSlot                                         |
| rsvpId        | UUID     | FK to RSVP                                                |
| dishName      | String   | Name of the dish                                          |
| servings      | Int      | Number of servings                                        |
| dietaryLabels | String[] | vegetarian, gluten_free, contains_nuts, dairy_free, vegan |
| createdAt     | DateTime | Creation timestamp                                        |

#### CommunicationLog

| Field           | Type     | Description                           |
| --------------- | -------- | ------------------------------------- |
| id              | UUID     | Primary key                           |
| eventId         | UUID     | FK to Event                           |
| recipientUserId | UUID     | FK to User                            |
| channel         | Enum     | EMAIL, SMS                            |
| messageId       | String   | External provider message ID          |
| status          | Enum     | SENT, DELIVERED, FAILED, UNSUBSCRIBED |
| sentAt          | DateTime | Send timestamp                        |

#### Photo

| Field        | Type     | Description         |
| ------------ | -------- | ------------------- |
| id           | UUID     | Primary key         |
| eventId      | UUID     | FK to Event         |
| uploaderId   | UUID     | FK to User          |
| photoPrismId | String   | PhotoPrism photo ID |
| caption      | String?  | Optional caption    |
| createdAt    | DateTime | Upload timestamp    |

#### PhotoReaction

| Field     | Type     | Description        |
| --------- | -------- | ------------------ |
| id        | UUID     | Primary key        |
| photoId   | UUID     | FK to Photo        |
| userId    | UUID     | FK to User         |
| reaction  | String   | Emoji reaction     |
| createdAt | DateTime | Creation timestamp |

#### AdminAuditLog

| Field       | Type     | Description          |
| ----------- | -------- | -------------------- |
| id          | UUID     | Primary key          |
| eventId     | UUID     | FK to Event          |
| adminUserId | UUID     | FK to User (admin)   |
| action      | String   | Action description   |
| details     | JSON     | Action-specific data |
| createdAt   | DateTime | Action timestamp     |

### 3.3 Enums

```prisma
enum UserRole {
  ADMIN_ADULT
  ADMIN
}

enum CommunicationPreference {
  EMAIL
  SMS
  BOTH
  NONE
}

enum InvitationStatus {
  PENDING
  SENT
  DELIVERED
}

enum RSVPStatus {
  INVITED
  PENDING
  CONFIRMED
  DECLINED
}

enum PotluckCategory {
  MAIN
  SIDE
  DESSERT
  DRINK
  OTHER
}

enum PotluckSlotType {
  LIMITED
  UNLIMITED
}

enum EventStatus {
  DRAFT
  PUBLISHED
  CLOSED
  CANCELLED
}

enum MessageStatus {
  SENT
  DELIVERED
  FAILED
  UNSUBSCRIBED
}
```

---

## 4. User Flows

### 4.1 Invitation Flow

```
1. Admin creates event (DRAFT)
2. Admin defines potluck slots and categories
3. Admin selects/creates households
4. Admin sends invitations (INVITED state)
5. Invitations delivered via EMAIL/SMS
6. Recipient clicks link → lands on event page
7. If new user: OAuth flow → create User → create Household membership
8. If existing user: direct to event page
```

**Edge Cases**:

- Link clicked by non-household member → prompt to create or join household
- Invitation for existing user → merge with existing household
- Max capacity reached → show waitlist option

### 4.2 RSVP Flow

```
1. User lands on event page
2. User selects household (or creates if new)
3. User confirms attendance for household
4. User specifies headcount (including dependents)
5. User adds dietary notes (optional)
6. RSVP status transitions: INVITED → PENDING → CONFIRMED/DECLINED
7. Confirmation sent via preferred channel
8. If DECLINED → block potluck signup
```

**Two-Phase RSVP**:

- Phase 1: Attendance confirmation
- Phase 2: Potluck signup (after confirmed RSVP)

**Modifications**: Allowed until `rsvpDeadline`. Auto-release potluck slots on withdrawal.

### 4.3 Potluck Signup Flow

```
1. User has CONFIRMED RSVP
2. User browses potluck categories
3. User selects slot category (MAIN/SIDE/DESSERT/DRINK/OTHER)
4. For LIMITED slots: check availability, first-come-first-served
5. User enters dish name and serving count
6. User selects dietary labels
7. Signup confirmed
```

**Slot Release**: Potluck slots auto-release when:

- RSVP is DECLINED
- RSVP is modified below required count
- RSVP deleted after deadline

### 4.4 Photo Upload Flow

```
1. Authenticated user navigates to photo gallery
2. User selects photos from device
3. EXIF data stripped (GPS removed) via middleware
4. Photos uploaded to S3, then synced to PhotoPrism
5. Thumbnail generation triggered
6. Photo appears in gallery with uploader attribution
7. Other users can add reactions
```

### 4.5 Communication Flow

```
1. Admin composes message
2. Admin selects recipients: ALL | HOUSEHOLD | INDIVIDUAL | NOT_RESPONDED
3. Admin sets send time (within reasonable hours constraint)
4. Message queued
5. At send time: delivered via EMAIL/SMS per recipient preference
6. Delivery logged (no retry logic, observability only)
7. One-click unsubscribe per channel
```

**Reasonable Hours Constraint**: Messages only sent 8 AM - 9 PM local time.

### 4.6 Day-of / Offline Flow

```
1. PWA installed on device (iOS: ~75% adoption)
2. Event details cached for offline access
3. Potluck list cached for offline access
4. Static map image cached
5. If offline: show cached data with "offline" indicator
6. Photos: view cached thumbnails, full images when online
7. Cannot RSVP or upload while offline
```

---

## 5. API Design (tRPC Router Structure)

```
├── auth.router
│   ├── getSession
│   ├── signIn (Google OAuth)
│   └── signOut
├── household.router
│   ├── create
│   ├── getById
│   ├── getTree (nested household visualization)
│   ├── addMember
│   └── removeMember
├── user.router
│   ├── getProfile
│   ├── updatePreferences
│   └── getByHousehold
├── event.router
│   ├── create
│   ├── update
│   ├── getById
│   ├── list (with status filter)
│   ├── publish
│   └── close
├── invitation.router
│   ├── send
│   ├── resend
│   └── trackDelivery
├── rsvp.router
│   ├── create
│   ├── update
│   ├── confirm
│   ├── decline
│   ├── adminOverride
│   ├── bulkImport (CSV)
│   └── getHeadcount (aggregate)
├── potluck.router
│   ├── createSlot
│   ├── updateSlot
│   ├── deleteSlot
│   ├── listSlots
│   ├── signup
│   ├── updateSignup
│   ├── cancelSignup
│   └── getFoodSummary
├── photo.router
│   ├── list (by event)
│   ├── getUploadUrl (S3 presigned)
│   ├── addReaction
│   └── removeReaction
├── communication.router
│   ├── sendBroadcast
│   ├── scheduleMessage
│   ├── getDeliveryStatus
│   └── unsubscribe
└── admin.router
    ├── auditLog
    ├── dashboard (headcount, pending, food)
    ├── inviteFromPrevious
    └── csvImport
```

---

## 6. Component Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Auth routes
│   │   ├── login/
│   │   └── callback/
│   ├── (event)/                # Event routes
│   │   ├── [eventId]/
│   │   │   ├── page.tsx        # Event details
│   │   │   ├── rsvp/
│   │   │   ├── potluck/
│   │   │   └── photos/
│   ├── household/
│   │   ├── page.tsx            # Household dashboard
│   │   └── tree/
│   └── admin/
│       ├── dashboard/
│       ├── invitations/
│       ├── communications/
│       └── audit-log/
├── components/
│   ├── ui/                      # Base UI primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── ...
│   ├── household/
│   │   ├── HouseholdCard.tsx
│   │   ├── FamilyTree.tsx
│   │   └── MemberList.tsx
│   ├── event/
│   │   ├── EventCard.tsx
│   │   ├── EventDetails.tsx
│   │   └── StaticMap.tsx
│   ├── rsvp/
│   │   ├── RSVPForm.tsx
│   │   ├── HeadcountSelector.tsx
│   │   └── RSVPStatus.tsx
│   ├── potluck/
│   │   ├── SlotGrid.tsx
│   │   ├── SlotCard.tsx
│   │   ├── DishSignupForm.tsx
│   │   └── DietaryLabels.tsx
│   ├── photos/
│   │   ├── PhotoGrid.tsx
│   │   ├── PhotoCard.tsx
│   │   ├── ReactionBar.tsx
│   │   └── UploadButton.tsx
│   └── communication/
│       ├── BroadcastComposer.tsx
│       ├── RecipientSelector.tsx
│       └── DeliveryStatus.tsx
├── lib/
│   ├── prisma.ts
│   ├── trpc.ts
│   ├── auth.ts
│   ├── twilio.ts
│   ├── photo-prism.ts
│   └── exif-stripper.ts
└── hooks/
    ├── useOffline.ts
    ├── useEvent.ts
    └── usePotluck.ts
```

---

## 7. Infrastructure

### 7.1 Kubernetes Deployment

```
┌─────────────────────────────────────────────┐
│                Kubernetes Cluster           │
│                                             │
│  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Next.js   │  │     PostgreSQL      │  │
│  │   (PWA)     │  │                     │  │
│  └─────────────┘  └─────────────────────┘  │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │           PhotoPrism (50TB)         │   │
│  │  - Sync from S3                     │   │
│  │  - Thumbnail generation             │   │
│  │  - EXIF processing                  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │           Twilio Integration        │   │
│  │  - Email (SendGrid)                 │   │
│  │  - SMS                              │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 7.2 External Services

| Service         | Purpose                    |
| --------------- | -------------------------- |
| Google OAuth    | Authentication             |
| Twilio SendGrid | Transactional email        |
| Twilio SMS      | SMS notifications          |
| PhotoPrism      | Photo storage & management |
| S3-compatible   | Photo backup               |

### 7.3 PWA Configuration

- Service worker for static asset caching
- IndexedDB for offline event/potluck data
- Background sync for uploads when online
- Install prompt for iOS and Android

---

## 8. Edge Cases

### 8.1 RSVP Headcount Aggregation

**Scenario**: Nancy RSVPs for 4 people in Household A. Emily (separate account, same household) later RSVPs for 2.

**Handling**:

- Headcount is CUMULATIVE across household members
- System sums all CONFIRMED RSVP headcounts for the household
- UI shows "Your household has 6 attendees"
- Duplicate detection flag if same person RSVPs twice

### 8.2 Nested Households

**Scenario**: Parent household "Ruelas" has child household "Mike's Family" via `parentHouseholdId`.

**Handling**:

- Tree visualization shows relationship
- Each household has independent RSVP capability
- Invitations can be sent to parent OR child households
- Photo access: all authenticated users can view all photos

### 8.3 Potluck Slot Collision

**Scenario**: Two users try to claim the last LIMITED slot simultaneously.

**Handling**:

- Database transaction with row-level locking
- First successful transaction wins
- Second user sees "Slot already taken" error
- Suggested alternatives shown

### 8.4 Offline RSVP Attempt

**Handling**:

- Detect offline state via navigator.onLine
- Disable RSVP form submission
- Show cached data with offline indicator
- Queue action for retry if supported

### 8.5 Invitation Link Reuse

**Scenario**: User A clicks invitation, completes OAuth, creates account. User B tries to use same link.

**Handling**:

- Invitation is single-use per person
- Link invalid after successful RSVP creation
- Error message: "This invitation has already been used"

### 8.6 Photo Upload Failures

**Handling**:

- Chunked uploads with resume capability
- Local storage of pending uploads
- Retry on connectivity restore
- User notification on permanent failure

---

## 9. MVP Scope vs Post-MVP

### MVP (Phase 1)

| Feature                        | Status   |
| ------------------------------ | -------- |
| Google OAuth SSO               | Required |
| Household management (basic)   | Required |
| Event CRUD                     | Required |
| RSVP state machine             | Required |
| Potluck slot categories        | Required |
| First-come-first-served signup | Required |
| PhotoPrism integration (basic) | Required |
| Email notifications            | Required |
| PWA offline caching            | Required |
| Admin dashboard                | Required |
| Single admin per event         | Required |

### Post-MVP (Phase 2+)

| Feature                             | Priority |
| ----------------------------------- | -------- |
| SMS notifications                   | High     |
| Nested household tree visualization | High     |
| Admin bulk CSV import               | High     |
| Photo reactions                     | Medium   |
| Admin audit log                     | Medium   |
| Multiple admins per event           | Medium   |
| Scheduled broadcasts                | Medium   |
| Dietary label filtering             | Medium   |
| Photo gallery search                | Low      |
| Video support                       | Low      |
| Family relationship graph           | Low      |

---

## 10. Open Questions

### Authentication

1. **Account recovery**: What happens when a user forgets Google account? Should we support email/password fallback?
2. **Dependent accounts**: Should dependents have limited login capability (e.g., magic link to household)?

### Household Model

3. **Household naming**: Who can rename a household? What if family members disagree on name?
4. **Household merging**: Should we support merging two households if families combine?
5. **Child aging out**: At what point should dependents become separate households?

### RSVP System

6. **Headcount validation**: Is there a minimum headcount (e.g., 1 for self)?
7. **Waitlist**: When max capacity is reached, should we offer a waitlist?
8. **RSVP closing**: Should we auto-close RSVPs after deadline or allow admin extension?

### Potluck Management

9. **Slot conflicts**: Should we allow duplicate dishes (e.g., two families bring potato salad)?
10. **Serving estimation**: Auto-calculate suggested servings based on headcount?

### Photos

11. **EXIF stripping**: Confirm exact fields to remove (GPS is required, but what about other metadata)?
12. **Storage limits**: Per-household or per-event storage quotas?
13. **Photo deletion**: Who can delete uploaded photos?

### Communication

14. **Message templating**: Should we support templates for broadcast messages?
15. **Opt-out defaults**: New users opt-in or opt-out by default?
16. **Spam prevention**: Rate limiting on admin broadcasts?

### Infrastructure

17. **PhotoPrism sync**: Real-time sync or batch sync?
18. **Backup strategy**: PostgreSQL backup frequency?
19. **Monitoring**: What alerts are required for production?

---

## Appendix: File Structure Summary

```
family-picnic-platform/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── hooks/
│   └── server/
│       ├── routers/
│       └── trpc.ts
├── kubernetes/
│   ├── nextjs.yaml
│   ├── postgres.yaml
│   └── photoprism.yaml
├── public/
│   └── sw.js
└── package.json
```
