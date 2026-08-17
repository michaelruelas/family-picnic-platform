import { describe, it, expect, vi, beforeEach } from 'vitest';

type Tx = Parameters<Parameters<typeof import('~/lib/prisma').prisma.$transaction>[0]>[0];

vi.mock('~/lib/prisma', () => ({ prisma: prismaMock }));

const prismaMock = vi.hoisted(() => ({
  householdMember: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  rsvpMemberAttendance: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

import { TRPCError } from '@trpc/server';
import {
  resolveAttendancesForHousehold,
  persistResolvedAttendances,
  resolveAndPersistAttendances,
  buildRosterAsNo,
  markAllAttendanceNo,
  attendanceFingerprint,
  deriveHeadcount,
} from '~/server/rsvp-attendance';
import { RsvpAttending } from '~/lib/generated/enums';
import { ATTENDEE_NAME_MAX } from '~/lib/schemas/attendee-name';

beforeEach(() => {
  for (const model of Object.values(prismaMock)) {
    for (const fn of Object.values(model)) {
      const mock = fn as ReturnType<typeof vi.fn>;
      if (typeof mock?.mockReset === 'function') mock.mockReset();
    }
  }
});

describe('rsvp-attendance service', () => {
  describe('deriveHeadcount', () => {
    it('counts YES rows when an attendance list is provided', () => {
      expect(
        deriveHeadcount(
          [
            { householdMemberId: 'a', memberName: 'A', attending: RsvpAttending.YES },
            { householdMemberId: 'b', memberName: 'B', attending: RsvpAttending.NO },
            { householdMemberId: 'c', memberName: 'C', attending: RsvpAttending.MAYBE },
          ],
          undefined,
        ),
      ).toBe(1);
    });

    it('falls back to the legacy headcount when no attendance is provided', () => {
      expect(deriveHeadcount(undefined, 4)).toBe(4);
    });

    it('defaults to 1 when neither value is provided', () => {
      expect(deriveHeadcount(undefined, undefined)).toBe(1);
    });

    it('treats 0 attendance with 0 fallback as at least 1 (legacy safety)', () => {
      expect(deriveHeadcount(undefined, 0)).toBe(1);
    });
  });

  describe('attendanceFingerprint', () => {
    it('returns the same fingerprint for the same attendances in any order', () => {
      const a = attendanceFingerprint([
        { householdMemberId: 'a', memberName: 'A', memberAge: 30, attending: RsvpAttending.YES },
        { householdMemberId: 'b', memberName: 'B', memberAge: null, attending: RsvpAttending.NO },
      ]);
      const b = attendanceFingerprint([
        { householdMemberId: 'b', memberName: 'B', memberAge: null, attending: RsvpAttending.NO },
        { householdMemberId: 'a', memberName: 'A', memberAge: 30, attending: RsvpAttending.YES },
      ]);
      expect(a).toBe(b);
    });

    it('detects a same-headcount swap', () => {
      const before = attendanceFingerprint([
        { householdMemberId: 'a', memberName: 'A', memberAge: 30, attending: RsvpAttending.YES },
        { householdMemberId: 'b', memberName: 'B', memberAge: 30, attending: RsvpAttending.NO },
      ]);
      const after = attendanceFingerprint([
        { householdMemberId: 'a', memberName: 'A', memberAge: 30, attending: RsvpAttending.NO },
        { householdMemberId: 'b', memberName: 'B', memberAge: 30, attending: RsvpAttending.YES },
      ]);
      expect(before).not.toBe(after);
    });

    it('accepts raw Prisma rows with memberNameSnapshot', () => {
      const fp = attendanceFingerprint([
        {
          householdMemberId: 'a',
          memberNameSnapshot: 'A',
          memberAgeSnapshot: 30,
          attending: RsvpAttending.YES,
        } as unknown as Parameters<typeof attendanceFingerprint>[0] extends Array<infer T>
          ? T
          : never,
      ]);
      expect(fp).toContain('a:A:30:YES');
    });

    it('returns empty string for null/undefined', () => {
      expect(attendanceFingerprint(undefined)).toBe('');
      expect(attendanceFingerprint(null)).toBe('');
    });
  });

  describe('resolveAttendancesForHousehold', () => {
    it('rejects an empty attendance list', async () => {
      await expect(
        resolveAttendancesForHousehold(prismaMock as unknown as Tx, 'h-1', []),
      ).rejects.toBeInstanceOf(TRPCError);
    });

    it('rejects duplicate householdMemberIds in the same list', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([
        { id: 'a', name: 'A', age: 30, deletedAt: null },
      ]);
      await expect(
        resolveAttendancesForHousehold(prismaMock as unknown as Tx, 'h-1', [
          { householdMemberId: 'a', memberName: 'ignored', attending: RsvpAttending.YES },
          { householdMemberId: 'a', memberName: 'ignored', attending: RsvpAttending.NO },
        ]),
      ).rejects.toBeInstanceOf(TRPCError);
    });

    it('rejects a householdMemberId that does not belong to the household', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([]);
      await expect(
        resolveAttendancesForHousehold(prismaMock as unknown as Tx, 'h-1', [
          { householdMemberId: 'foreign', memberName: 'Intruder', attending: RsvpAttending.YES },
        ]),
      ).rejects.toBeInstanceOf(TRPCError);
    });

    it('rejects a householdMemberId that has been soft-deleted', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([
        { id: 'a', name: 'Removed', age: 30, deletedAt: new Date() },
      ]);
      await expect(
        resolveAttendancesForHousehold(prismaMock as unknown as Tx, 'h-1', [
          { householdMemberId: 'a', memberName: 'Removed', attending: RsvpAttending.YES },
        ]),
      ).rejects.toBeInstanceOf(TRPCError);
    });

    it('sources the snapshot name and age from the database, not the client', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([
        { id: 'a', name: 'Real Name', age: 42, deletedAt: null },
      ]);
      const { rows } = await resolveAttendancesForHousehold(prismaMock as unknown as Tx, 'h-1', [
        {
          householdMemberId: 'a',
          memberName: 'Tampered Name',
          memberAge: 999,
          attending: RsvpAttending.YES,
        },
      ]);
      expect(rows[0]).toMatchObject({
        householdMemberId: 'a',
        memberName: 'Real Name',
        memberAge: 42,
      });
    });

    it('trusts the client name and age for ad-hoc guests (id = null)', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([]);
      const { rows } = await resolveAttendancesForHousehold(prismaMock as unknown as Tx, 'h-1', [
        {
          householdMemberId: null,
          memberName: '  Plus One  ',
          memberAge: 7,
          attending: RsvpAttending.MAYBE,
        },
      ]);
      expect(rows[0]).toMatchObject({
        householdMemberId: null,
        memberName: 'Plus One',
        memberAge: 7,
        attending: RsvpAttending.MAYBE,
      });
    });

    it('allows multiple ad-hoc guests in the same list', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([]);
      const { rows } = await resolveAttendancesForHousehold(prismaMock as unknown as Tx, 'h-1', [
        {
          householdMemberId: null,
          memberName: 'Guest A',
          memberAge: 30,
          attending: RsvpAttending.YES,
        },
        {
          householdMemberId: null,
          memberName: 'Guest B',
          memberAge: null,
          attending: RsvpAttending.NO,
        },
        {
          householdMemberId: null,
          memberName: 'Guest C',
          memberAge: 10,
          attending: RsvpAttending.MAYBE,
        },
      ]);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({
        householdMemberId: null,
        memberName: 'Guest A',
        memberAge: 30,
        attending: RsvpAttending.YES,
      });
      expect(rows[1]).toMatchObject({
        householdMemberId: null,
        memberName: 'Guest B',
        memberAge: null,
        attending: RsvpAttending.NO,
      });
      expect(rows[2]).toMatchObject({
        householdMemberId: null,
        memberName: 'Guest C',
        memberAge: 10,
        attending: RsvpAttending.MAYBE,
      });
    });

    // FPP-36 review finding 1: the ad-hoc clamp must use the
    // shared `ATTENDEE_NAME_MAX` constant so the cap and the
    // schema stay in sync when the limit is bumped.
    it('clamps an oversized ad-hoc name to ATTENDEE_NAME_MAX', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([]);
      const oversized = 'a'.repeat(ATTENDEE_NAME_MAX + 25);
      const { rows } = await resolveAttendancesForHousehold(prismaMock as unknown as Tx, 'h-1', [
        {
          householdMemberId: null,
          memberName: oversized,
          memberAge: null,
          attending: RsvpAttending.YES,
        },
      ]);
      expect(rows[0]?.memberName).toHaveLength(ATTENDEE_NAME_MAX);
    });
  });

  describe('persistResolvedAttendances', () => {
    it('creates a new row when no matching (rsvpId, memberId) exists', async () => {
      prismaMock.rsvpMemberAttendance.findUnique.mockResolvedValue(null);
      prismaMock.rsvpMemberAttendance.findFirst.mockResolvedValue(null);
      await persistResolvedAttendances(prismaMock as unknown as Tx, 'r-1', [
        {
          householdMemberId: 'a',
          memberName: 'A',
          memberAge: 30,
          attending: RsvpAttending.YES,
        },
      ]);
      expect(prismaMock.rsvpMemberAttendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rsvpId: 'r-1',
            householdMemberId: 'a',
            memberNameSnapshot: 'A',
            memberAgeSnapshot: 30,
            attending: RsvpAttending.YES,
          }),
        }),
      );
    });

    it('updates an existing roster-member row in place', async () => {
      prismaMock.rsvpMemberAttendance.findUnique.mockResolvedValue({ id: 'att-1' });
      await persistResolvedAttendances(prismaMock as unknown as Tx, 'r-1', [
        {
          householdMemberId: 'a',
          memberName: 'A',
          memberAge: 30,
          attending: RsvpAttending.NO,
        },
      ]);
      expect(prismaMock.rsvpMemberAttendance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-1' },
          data: expect.objectContaining({ attending: RsvpAttending.NO }),
        }),
      );
      expect(prismaMock.rsvpMemberAttendance.create).not.toHaveBeenCalled();
    });

    it('matches ad-hoc guests by (name, age) so re-submits update the same row', async () => {
      prismaMock.rsvpMemberAttendance.findFirst.mockResolvedValue({ id: 'att-guest' });
      await persistResolvedAttendances(prismaMock as unknown as Tx, 'r-1', [
        {
          householdMemberId: null,
          memberName: 'Guest',
          memberAge: 30,
          attending: RsvpAttending.NO,
        },
      ]);
      expect(prismaMock.rsvpMemberAttendance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-guest' },
        }),
      );
    });

    it('FPP-111: deletes existing rows and recreates when replace: true is set', async () => {
      prismaMock.rsvpMemberAttendance.deleteMany.mockResolvedValue({ count: 2 });
      prismaMock.rsvpMemberAttendance.findUnique.mockResolvedValue(null);
      await persistResolvedAttendances(
        prismaMock as unknown as Tx,
        'r-1',
        [
          {
            householdMemberId: 'a',
            memberName: 'A',
            memberAge: 30,
            attending: RsvpAttending.YES,
          },
        ],
        { replace: true },
      );
      expect(prismaMock.rsvpMemberAttendance.deleteMany).toHaveBeenCalledWith({
        where: { rsvpId: 'r-1' },
      });
      expect(prismaMock.rsvpMemberAttendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rsvpId: 'r-1',
            householdMemberId: 'a',
            attending: RsvpAttending.YES,
          }),
        }),
      );
    });

    it('FPP-111: cleans up removed ad-hoc guests when replace: true is set with fewer rows', async () => {
      prismaMock.rsvpMemberAttendance.deleteMany.mockResolvedValue({ count: 3 });
      prismaMock.rsvpMemberAttendance.findFirst.mockResolvedValue(null);
      await persistResolvedAttendances(
        prismaMock as unknown as Tx,
        'r-1',
        [
          {
            householdMemberId: null,
            memberName: 'Remaining Guest',
            memberAge: 25,
            attending: RsvpAttending.YES,
          },
        ],
        { replace: true },
      );
      expect(prismaMock.rsvpMemberAttendance.deleteMany).toHaveBeenCalledWith({
        where: { rsvpId: 'r-1' },
      });
      expect(prismaMock.rsvpMemberAttendance.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.rsvpMemberAttendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rsvpId: 'r-1',
            householdMemberId: null,
            memberNameSnapshot: 'Remaining Guest',
          }),
        }),
      );
    });
  });

  describe('resolveAndPersistAttendances', () => {
    it('resolves and persists in one call', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([
        { id: 'a', name: 'A', age: 30, deletedAt: null },
      ]);
      prismaMock.rsvpMemberAttendance.findUnique.mockResolvedValue(null);
      prismaMock.rsvpMemberAttendance.findFirst.mockResolvedValue(null);
      const result = await resolveAndPersistAttendances(prismaMock as unknown as Tx, {
        rsvpId: 'r-1',
        householdId: 'h-1',
        attendances: [{ householdMemberId: 'a', memberName: 'A', attending: RsvpAttending.YES }],
      });
      expect(result.rows).toHaveLength(1);
      expect(prismaMock.rsvpMemberAttendance.create).toHaveBeenCalled();
    });

    it('FPP-111: forwards replace: true to persistResolvedAttendances', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([
        { id: 'a', name: 'A', age: 30, deletedAt: null },
      ]);
      prismaMock.rsvpMemberAttendance.deleteMany.mockResolvedValue({ count: 2 });
      prismaMock.rsvpMemberAttendance.findUnique.mockResolvedValue(null);
      const result = await resolveAndPersistAttendances(
        prismaMock as unknown as Tx,
        {
          rsvpId: 'r-1',
          householdId: 'h-1',
          attendances: [{ householdMemberId: 'a', memberName: 'A', attending: RsvpAttending.YES }],
        },
        { replace: true },
      );
      expect(result.rows).toHaveLength(1);
      expect(prismaMock.rsvpMemberAttendance.deleteMany).toHaveBeenCalledWith({
        where: { rsvpId: 'r-1' },
      });
      expect(prismaMock.rsvpMemberAttendance.create).toHaveBeenCalled();
    });

    it('round-trips multiple ad-hoc guests through the full pipeline', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([]);
      prismaMock.rsvpMemberAttendance.findFirst.mockResolvedValue(null);
      const result = await resolveAndPersistAttendances(prismaMock as unknown as Tx, {
        rsvpId: 'r-1',
        householdId: 'h-1',
        attendances: [
          {
            householdMemberId: null,
            memberName: 'Guest A',
            memberAge: 30,
            attending: RsvpAttending.YES,
          },
          {
            householdMemberId: null,
            memberName: 'Guest B',
            memberAge: null,
            attending: RsvpAttending.NO,
          },
        ],
      });
      expect(result.rows).toHaveLength(2);
      expect(prismaMock.rsvpMemberAttendance.create).toHaveBeenCalledTimes(2);
      const [first, second] = prismaMock.rsvpMemberAttendance.create.mock.calls.map(
        (c) => c[0].data,
      );
      expect(first).toMatchObject({
        rsvpId: 'r-1',
        householdMemberId: null,
        memberNameSnapshot: 'Guest A',
        memberAgeSnapshot: 30,
        attending: RsvpAttending.YES,
      });
      expect(second).toMatchObject({
        rsvpId: 'r-1',
        householdMemberId: null,
        memberNameSnapshot: 'Guest B',
        memberAgeSnapshot: null,
        attending: RsvpAttending.NO,
      });
    });
  });

  describe('buildRosterAsNo', () => {
    it('returns the household roster with every attending set to NO', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([
        { id: 'a', name: 'A', age: 30 },
        { id: 'b', name: 'B', age: null },
      ]);
      const roster = await buildRosterAsNo(prismaMock as unknown as Tx, 'h-1');
      expect(roster).toHaveLength(2);
      expect(roster.every((r) => r.attending === RsvpAttending.NO)).toBe(true);
      expect(roster.find((r) => r.householdMemberId === 'a')?.memberName).toBe('A');
      expect(roster.find((r) => r.householdMemberId === 'b')?.memberAge).toBe(null);
    });

    it('returns an empty array for an empty household', async () => {
      prismaMock.householdMember.findMany.mockResolvedValue([]);
      const roster = await buildRosterAsNo(prismaMock as unknown as Tx, 'h-1');
      expect(roster).toEqual([]);
    });
  });

  describe('markAllAttendanceNo', () => {
    it('flips every row on the RSVP to NO', async () => {
      await markAllAttendanceNo(prismaMock as unknown as Tx, 'r-1');
      expect(prismaMock.rsvpMemberAttendance.updateMany).toHaveBeenCalledWith({
        where: { rsvpId: 'r-1' },
        data: { attending: RsvpAttending.NO },
      });
    });
  });
});
