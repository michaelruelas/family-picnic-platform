# ADR-011: Workflow Orchestration with OpenWorkflow

## Status

Proposed

## Context

The Family Picnic Platform has several asynchronous, multi-step processes that are currently handled with varying levels of sophistication:

1. **Scheduled broadcasts** — A cron-based `GET` endpoint polls `ScheduledBroadcast` records every minute
2. **RSVP registration** — Confirm, decline, waitlist promotion, and potluck slot release happen synchronously in HTTP request handlers
3. **Message delivery** — `CommunicationLog` records are created with `QUEUED` status but never actually sent via SendGrid/Twilio (no worker exists)
4. **Waitlist promotion** — Only one user promoted per decline, no batch promotion, no notification to promoted users
5. **Event lifecycle** — No auto-transition of events (PUBLISHED → CLOSED after event date, RSVP deadline enforcement)

These issues share a common root cause: the lack of a **durable execution runtime** that can pause, resume, retry, and orchestrate multi-step processes without blocking HTTP request handlers.

## Decision

We will integrate **OpenWorkflow** (https://openworkflow.dev) as the workflow orchestration layer, replacing:

| Current mechanism                                                    | OpenWorkflow replacement                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| System crontab polling `/api/admin/communications/process-scheduled` | `ScheduledBroadcastDelivery` workflow with `step.sleep`       |
| Synchronous waitlist promotion in decline handler                    | `PromoteWaitlist` child workflow triggered by decline         |
| Missing message delivery worker                                      | `DeliverCommunication` worker polling `QUEUED` logs           |
| Synchronous RSVP confirm/decline (in HTTP handler)                   | `RsvpConfirm` / `RsvpDecline` workflows for durable execution |
| Missing event lifecycle management                                   | `EventLifecycle` recurring workflow                           |

### Why OpenWorkflow over alternatives

| Factor               | OpenWorkflow                | BullMQ (Redis)       | Inngest        | Custom (pg_queue) |
| -------------------- | --------------------------- | -------------------- | -------------- | ----------------- |
| Backend              | PostgreSQL-only             | Requires Redis       | Cloud-managed  | Manual            |
| Durable sleep        | Native (`step.sleep`)       | Must re-enqueue      | Native         | Manual polling    |
| Step memoization     | Built-in (replay safety)    | N/A                  | Built-in       | N/A               |
| Child workflows      | Native (`step.runWorkflow`) | Manual orchestration | Native         | Manual            |
| Infrastructure cost  | $0 (shared PG)              | +Redis cluster       | Per-invocation | $0                |
| Type safety          | Full TS generics            | Basic                | Zod schemas    | Manual            |
| Production readiness | v0.9.0 (active dev)         | Mature               | Mature         | N/A               |

The decision to prefer OpenWorkflow over BullMQ is driven by:

- **Zero additional infrastructure** — We already have PostgreSQL, no Redis cluster to maintain
- **Durable sleep** — `step.sleep("wait-until-broadcast", "2h")` is a first-class primitive; BullMQ requires manual re-enqueue logic
- **Replay safety** — OpenWorkflow's memoization guarantees deterministic re-execution after crashes/deploys
- **Child workflows** — `step.runWorkflow` enables clean separation of concerns (e.g., RSVP decline triggers waitlist promotion as a child workflow)

## Workflow Design

### 1. `ScheduledBroadcastDelivery` (replaces cron-based process-scheduled)

```typescript
// Triggered when admin creates a scheduled broadcast.
// Sleeps until scheduledAt, then delivers to all recipients.
export const scheduledBroadcastDelivery = ow.defineWorkflow<
  {
    broadcastId: string;
    eventId: string;
    message: string;
    channel: 'EMAIL' | 'SMS';
    recipientType: string;
    recipientIds?: string[];
    sentByUserId: string;
    scheduledAt: string;
  },
  { deliveredCount: number }
>({ name: 'scheduled-broadcast-delivery', schema: broadcastSchema }, async ({ input, step }) => {
  // 1. Sleep until the scheduled time
  await step.sleep('wait-until-broadcast', input.scheduledAt);

  // 2. Compute recipient list (same logic as current REST handler)
  const recipients = await step.run({ name: 'resolve-recipients' }, () =>
    resolveRecipients(input.eventId, input.recipientType, input.recipientIds),
  );

  // 3. Create CommunicationLog entries (batched)
  const logs = await step.run({ name: 'create-communication-logs' }, () =>
    createLogs(input, recipients),
  );

  // 4. Mark ScheduledBroadcast as SENT
  await step.run({ name: 'mark-broadcast-sent' }, () =>
    markBroadcastSent(input.broadcastId, logs.length),
  );

  return { deliveredCount: logs.length };
});
```

### 2. `RsvpConfirm` (durable confirm with waitlist check)

```typescript
// Triggered when a user confirms their RSVP.
// Checks capacity, waitlists if over capacity, auto-promotes from waitlist if under.
export const rsvpConfirm = ow.defineWorkflow<
  {
    eventId: string;
    userId: string;
    householdId: string;
    headcount: number;
    dietaryNotes?: string;
  },
  { status: 'CONFIRMED' | 'WAITLISTED'; waitlistPosition?: number }
>({ name: 'rsvp-confirm', schema: rsvpConfirmSchema }, async ({ input, step }) => {
  // 1. Validate event is PUBLISHED and RSVP deadline hasn't passed
  const event = await step.run({ name: 'validate-event' }, () =>
    validateEventForRsvp(input.eventId),
  );

  // 2. Check capacity and determine status
  const { status, waitlistPosition } = await step.run({ name: 'check-capacity' }, () =>
    checkCapacity(event, input.eventId, input.householdId, input.headcount),
  );

  // 3. Upsert RSVP
  await step.run({ name: 'upsert-rsvp' }, () => upsertRsvp(input, status, waitlistPosition));

  // 4. If CONFIRMED, mark invitations as USED
  if (status === 'CONFIRMED') {
    await step.run({ name: 'mark-invitations' }, () =>
      markInvitationsUsed(input.eventId, input.userId, input.householdId),
    );
  }

  return { status, waitlistPosition };
});
```

### 3. `RsvpDecline` (decline + potluck release + waitlist promotion)

```typescript
// Triggered when a user declines their RSVP.
// Releases potluck slots, then promotes waitlisted users to fill capacity.
export const rsvpDecline = ow.defineWorkflow<
  {
    rsvpId: string;
    eventId: string;
    userId: string;
    householdId: string;
  },
  { releasedSlots: number; promotedUsers: number }
>({ name: 'rsvp-decline', schema: rsvpDeclineSchema }, async ({ input, step }) => {
  // 1. Release potluck slots
  const releasedSlots = await step.run({ name: 'release-potluck-slots' }, () =>
    releasePotluckSlots(input.rsvpId),
  );

  // 2. Promote waitlisted users to fill freed capacity
  const promotedCount = await step.run({ name: 'promote-waitlisted' }, () =>
    promoteWaitlisted(input.eventId, releasedSlots),
  );

  // 3. If users were promoted, send them notifications
  if (promotedCount > 0) {
    await step.run({ name: 'send-waitlist-notifications' }, () =>
      sendPromotionNotifications(input.eventId),
    );
  }

  // 4. Write audit log
  await step.run({ name: 'write-audit-log' }, () => writeAuditLog('rsvp.decline', input));

  return { releasedSlots, promotedUsers: promotedCount };
});
```

### 4. `DeliverCommunications` (worker that sends queued messages)

```typescript
// Recurring workflow that polls for QUEUED CommunicationLog entries
// and dispatches them via SendGrid/Twilio.
export const deliverCommunications = ow.defineWorkflow<void, { delivered: number }>(
  { name: 'deliver-communications' },
  async ({ step }) => {
    const queued = await step.run({ name: 'fetch-queued' }, () =>
      prisma.communicationLog.findMany({
        where: { status: 'QUEUED' },
        take: 20,
      }),
    );

    if (queued.length === 0) return { delivered: 0 };

    const results = await Promise.all(
      queued.map((log) => step.run({ name: `deliver-${log.id}` }, () => deliverOne(log))),
    );

    const delivered = results.filter((r) => r.success).length;
    return { delivered };
  },
);
```

### 5. `EventLifecycle` (recurring state machine)

```typescript
// Runs periodically to advance event states:
// - Close RSVPs after deadline
// - Transition events to CLOSED after event date
// - Send reminder emails
// - Clean up stale data
export const eventLifecycle = ow.defineWorkflow<void, { eventsProcessed: number }>(
  { name: 'event-lifecycle' },
  async ({ step }) => {
    const now = new Date();

    // Close RSVPs past deadline
    await step.run({ name: 'close-expired-rsvps' }, () =>
      prisma.event.updateMany({
        where: { status: 'PUBLISHED', rsvpDeadline: { lte: now } },
        data: { status: 'CLOSED' },
      }),
    );

    // Close events past their date
    await step.run({ name: 'close-past-events' }, () =>
      prisma.event.updateMany({
        where: { status: 'PUBLISHED', date: { lte: now } },
        data: { status: 'CLOSED' },
      }),
    );

    return { eventsProcessed: 0 };
  },
);
```

## Integration Plan

### Phase 1: Foundation (this PR)

1. **Install dependencies**

   ```bash
   npm install openworkflow @openworkflow/cli
   ```

2. **Create shared client** `src/openworkflow/client.ts`

   ```typescript
   import { OpenWorkflow } from 'openworkflow';
   import { BackendPostgres } from 'openworkflow/postgres';

   export const backend = await BackendPostgres.connect(process.env.DATABASE_URL!, {
     namespaceId: 'family-picnic',
   });
   export const ow = new OpenWorkflow({ backend });
   ```

3. **Define config** `openworkflow.config.ts`

   ```typescript
   import { backend } from './src/openworkflow/client';
   import { defineConfig } from '@openworkflow/cli';

   export default defineConfig({
     backend,
     dirs: './src/openworkflow',
     ignorePatterns: ['**/*.test.*'],
   });
   ```

4. **Create first workflow: `ScheduledBroadcastDelivery`** in `src/openworkflow/`
5. **Add worker startup script** `scripts/worker.sh`
6. **Add worker to docker-compose and K8s manifests**

### Phase 2: RSVP Workflows (next PR)

7. **Create `RsvpConfirm`** workflow
8. **Create `RsvpDecline`** workflow with batch waitlist promotion and notifications
9. **Update tRPC `rsvp.confirm`** and **`rsvp.decline`** to call workflows instead of synchronous logic
10. **Add `DeliverCommunications`** worker workflow
11. **Update REST `POST /api/rsvp`** to call workflows

### Phase 3: Lifecycle & Cleanup (final PR)

12. **Create `EventLifecycle`** recurring workflow
13. **Remove system crontab** entries for `process-scheduled`
14. **Remove `ScheduledBroadcast` process-scheduled endpoint** (no longer needed)
15. **Add `npm run worker`** script to package.json
16. **Update deployment docs** and K8s manifests

## Migration Safety

- **No breaking changes**: Existing REST and tRPC endpoints continue to work during migration
- **Dual writes**: Phase 1 adds workflow-based processing alongside existing cron; cron can be removed after validation
- **Rollback**: If workflow fails, fall back to synchronous execution for RSVPs by catching workflow errors and falling through to the current handler

## Open Questions

1. **Worker process management**: Should the worker run as a sidecar in the same K8s pod, or as a separate Deployment?
   → Decision: Separate Deployment (same image, different command), with 1-2 replicas.

2. **Recurring workflows**: How to trigger `deliverCommunications` and `eventLifecycle` on a schedule?
   → Option A: A lightweight poll loop within the worker that starts a new run every N seconds.
   → Option B: A cron job (system or K8s CronJob) that calls a Next.js API route to trigger workflows.
   → Decision: Option A (self-contained in worker) for simplicity.

3. **Idempotency for RSVP**: How to prevent duplicate workflow runs if the HTTP client retries?
   → Use OpenWorkflow's `idempotencyKey` with a key derived from `eventId + userId + action`.

## Consequences

- **Positive**: Durable, crash-resilient orchestration for all async processes
- **Positive**: Waitlist promotion fills all available capacity (not just one user)
- **Positive**: Promoted users receive notifications automatically
- **Positive**: Messages actually get sent via SendGrid/Twilio (fixes current gap)
- **Positive**: Event lifecycle is automated (no manual CLOSED transitions)
- **Positive**: No Redis dependency; shares existing PostgreSQL
- **Negative**: Additional runtime dependency (`openworkflow` npm package)
- **Negative**: Worker process must be deployed and monitored
- **Negative**: Learning curve for team on OpenWorkflow concepts
- **Negative**: OpenWorkflow is v0.9.0 (pre-1.0); API may change
