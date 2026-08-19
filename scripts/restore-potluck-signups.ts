#!/usr/bin/env bun
/**
 * One-shot recovery script for a lost PotluckSignup table.
 *
 * The production `PotluckSignup` table was wiped for one event
 * (cmsyr224x000001qjoskdhbyd) on 2026-08-19 but the AuditLog rows
 * for the creates and updates survived. This script replays those
 * audit rows to recreate the missing signup rows.
 *
 * The script is idempotent (uses upsert by original subjectId)
 * and dry-runs by default — pass `--apply` to commit writes. It
 * also un-soft-deletes any row that already exists with the same
 * cuid (Postmortem 2026-08-19: the PotluckSignup table now uses a
 * soft-delete column `deletedAt`, so a "missing" row might actually
 * be present but marked deleted; the restore forces `deletedAt: null`).
 *
 * Usage:
 *   bun scripts/restore-potluck-signups.ts            # dry-run
 *   bun scripts/restore-potluck-signups.ts --apply    # write
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/lib/generated/client';

const createPayloadSchema = z.object({
  slotId: z.string().min(1),
  eventId: z.string().min(1),
  dishName: z.string(),
  servings: z.number().int().min(1),
  dietaryLabels: z.array(z.string()),
});

const updatePayloadSchema = z.object({
  slotId: z.string().min(1),
  eventId: z.string().min(1),
  before: z.object({
    dishName: z.string(),
    servings: z.number().int().min(1),
    dietaryLabels: z.array(z.string()),
  }),
  after: z.object({
    dishName: z.string(),
    servings: z.number().int().min(1),
    dietaryLabels: z.array(z.string()),
  }),
});

const auditRowSchema = z.object({
  id: z.string(),
  action: z.string(),
  actorId: z.string().nullable(),
  occurredAt: z.string(),
  payload: z.unknown(),
  subjectId: z.string(),
  subjectType: z.string(),
});

type AuditRow = z.infer<typeof auditRowSchema>;

const CSV_PATH = process.env.AUDIT_CSV ?? '/tmp/potluck-restore/public-AuditLog-selection.csv';
const apply = process.argv.includes('--apply');

function parseCsv(csv: string): AuditRow[] {
  const lines = csv.trim().split('\n');
  return lines.slice(1).map((line, idx) => {
    const m = line.match(/^([^,]+),([^,]+),([^,]*),([^,]+),(".*"),([^,]+),([^,]+)$/);
    if (!m) throw new Error(`Unparseable row ${idx + 1}: ${line.slice(0, 80)}`);
    // CSV wraps the payload column in literal " ... "; "" inside is CSV-escape for ".
    const payloadJson = m[5]!.slice(1, -1).replace(/""/g, '"');
    return auditRowSchema.parse({
      id: m[1],
      action: m[2],
      actorId: m[3] || null,
      occurredAt: m[4],
      payload: JSON.parse(payloadJson),
      subjectId: m[6],
      subjectType: m[7],
    });
  });
}

async function main(): Promise<void> {
  const csv = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(csv);

  const creates = rows.filter(
    (r) => r.subjectType === 'PotluckSignup' && r.action === 'potluck.signup.create',
  );
  const updates = rows.filter(
    (r) => r.subjectType === 'PotluckSignup' && r.action === 'potluck.signup.update',
  );
  const cancels = rows.filter(
    (r) => r.subjectType === 'PotluckSignup' && r.action === 'potluck.signup.cancel',
  );

  console.log(
    `Parsed ${rows.length} rows: ${creates.length} creates, ${updates.length} updates, ${cancels.length} cancels`,
  );
  if (cancels.length > 0) {
    console.warn(
      'WARN: cancel events found in the audit log. This script does not handle cancels; investigate manually.',
    );
  }

  // Validate payloads against their expected shapes up front, so we fail
  // loudly on a malformed CSV rather than halfway through a write.
  const createsTyped = creates.map((r) => ({
    ...r,
    payload: createPayloadSchema.parse(r.payload),
  }));
  const updatesTyped = updates.map((r) => ({
    ...r,
    payload: updatePayloadSchema.parse(r.payload),
  }));

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    // Resolve rsvpId per (actorId, eventId). Each actor has at most one
    // RSVP for an event; we treat any non-null match as the canonical one.
    const actorIds = Array.from(new Set(createsTyped.map((r) => r.actorId!)));
    const eventId = createsTyped[0]!.payload.eventId;
    const rsvps = await prisma.rSVP.findMany({
      where: {
        eventId,
        userId: { in: actorIds },
      },
      select: { id: true, userId: true, eventId: true },
    });
    const rsvpByActorEvent = new Map<string, string>();
    for (const r of rsvps) {
      rsvpByActorEvent.set(`${r.userId}|${r.eventId}`, r.id);
    }

    // Validate every create resolves. Abort loudly if anything is missing.
    const missingRsvp = createsTyped
      .map((c) => `${c.actorId}|${c.payload.eventId}`)
      .filter((key) => !rsvpByActorEvent.has(key));
    if (missingRsvp.length > 0) {
      throw new Error(
        `Missing RSVPs for ${missingRsvp.length} create(s): ${missingRsvp.join(', ')}`,
      );
    }

    // Sort by occurredAt so updates apply to the matching create.
    const sortedCreates = [...createsTyped].sort((a, b) =>
      a.occurredAt.localeCompare(b.occurredAt),
    );
    const sortedUpdates = [...updatesTyped].sort((a, b) =>
      a.occurredAt.localeCompare(b.occurredAt),
    );

    // Apply creates with the original cuid (id), original claimedAt,
    // and the resolved rsvpId. Upsert keeps this idempotent.
    let createdCount = 0;
    let updatedExistingCount = 0;
    let restoredFromSoftDeleteCount = 0;
    let updateEventsApplied = 0;

    for (const row of sortedCreates) {
      const p = row.payload;
      const rsvpId = rsvpByActorEvent.get(`${row.actorId}|${p.eventId}`)!;
      const claimedAt = new Date(row.occurredAt);
      // FPP-Postmortem: restore forces `deletedAt: null` so an
      // already-soft-deleted row with the same id is un-cancelled
      // instead of left untouched. The PotluckSignup_no_update_deleted
      // trigger allows exactly this transition (deletedAt -> null).
      const data = {
        slotId: p.slotId,
        rsvpId,
        dishName: p.dishName,
        servings: p.servings,
        dietaryLabels: p.dietaryLabels,
        claimedAt,
        deletedAt: null,
      };
      console.log(
        `${apply ? 'WRITE' : 'DRY '} create ${row.subjectId}  slot=${p.slotId.slice(-8)}  rsvp=${rsvpId.slice(-8)}  dish="${p.dishName}"`,
      );
      if (apply) {
        const before = await prisma.potluckSignup.findUnique({
          where: { id: row.subjectId },
          select: { id: true, deletedAt: true },
        });
        await prisma.potluckSignup.upsert({
          where: { id: row.subjectId },
          create: { id: row.subjectId, ...data },
          update: data,
        });
        if (before && before.deletedAt !== null) {
          restoredFromSoftDeleteCount++;
          console.log(
            `        -> was soft-deleted at ${before.deletedAt.toISOString()}, restored to live`,
          );
        } else if (before) {
          updatedExistingCount++;
        } else {
          createdCount++;
        }
      }
    }

    for (const row of sortedUpdates) {
      const p = row.payload;
      console.log(
        `${apply ? 'WRITE' : 'DRY '} update ${row.subjectId}  dish="${p.before.dishName}" -> "${p.after.dishName}"`,
      );
      if (apply) {
        await prisma.potluckSignup.update({
          where: { id: row.subjectId },
          data: {
            dishName: p.after.dishName,
            servings: p.after.servings,
            dietaryLabels: p.after.dietaryLabels,
          },
        });
        updateEventsApplied++;
      }
    }

    if (apply) {
      const finalCount = await prisma.potluckSignup.count({
        where: { id: { in: creates.map((c) => c.subjectId) } },
      });
      console.log(
        `\nDone. Created ${createdCount}, updated-existing ${updatedExistingCount}, restored-from-soft-delete ${restoredFromSoftDeleteCount}, update-events applied ${updateEventsApplied}. Total PotluckSignup rows for restored subjectIds: ${finalCount}/${creates.length}.`,
      );
    } else {
      console.log('\nDry-run. Re-run with --apply to commit.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Restore script crashed:', error);
  process.exit(1);
});
