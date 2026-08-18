import { describe, it, expect } from 'vitest';
import { RsvpAttending } from '~/lib/generated/enums';
import { calculateFee, calculateFeeFromEvent } from '../fee';

function yes(age: number | null) {
  return { attending: RsvpAttending.YES, memberAge: age };
}
function no(age: number | null) {
  return { attending: RsvpAttending.NO, memberAge: age };
}
function maybe(age: number | null) {
  return { attending: RsvpAttending.MAYBE, memberAge: age };
}

describe('calculateFee', () => {
  describe('zero-fee and missing-config paths', () => {
    it('returns zero when the config is null', () => {
      const result = calculateFee([yes(35), yes(40)], null);
      expect(result).toEqual({ amountCents: 0, qualifyingAttendees: 0, totalAttendees: 2 });
    });

    it('returns zero when the amount is 0', () => {
      const result = calculateFee([yes(35)], { amountCents: 0, minAge: 0 });
      expect(result).toEqual({ amountCents: 0, qualifyingAttendees: 0, totalAttendees: 1 });
    });

    it('returns zero when the amount is negative (defensive)', () => {
      const result = calculateFee([yes(35)], { amountCents: -100, minAge: 0 });
      expect(result).toEqual({ amountCents: 0, qualifyingAttendees: 0, totalAttendees: 1 });
    });

    it('returns zero for an empty attendee list', () => {
      const result = calculateFee([], { amountCents: 2500, minAge: 13 });
      expect(result).toEqual({ amountCents: 0, qualifyingAttendees: 0, totalAttendees: 0 });
    });
  });

  describe('attendance filter', () => {
    it('only counts YES attendees', () => {
      const result = calculateFee([yes(35), no(35), maybe(35)], { amountCents: 1000, minAge: 0 });
      expect(result.amountCents).toBe(1000);
      expect(result.qualifyingAttendees).toBe(1);
      expect(result.totalAttendees).toBe(3);
    });

    it('does not count MAYBE attendees toward the fee', () => {
      const result = calculateFee([maybe(40), maybe(40)], { amountCents: 1000, minAge: 0 });
      expect(result.amountCents).toBe(0);
      expect(result.qualifyingAttendees).toBe(0);
    });
  });

  describe('age filter', () => {
    it('treats null age as qualifying (assumed above threshold)', () => {
      const result = calculateFee([yes(null), yes(40)], { amountCents: 1000, minAge: 13 });
      expect(result.qualifyingAttendees).toBe(2);
      expect(result.amountCents).toBe(2000);
    });

    it('treats age equal to minAge as qualifying (inclusive boundary)', () => {
      const result = calculateFee([yes(13)], { amountCents: 1000, minAge: 13 });
      expect(result.qualifyingAttendees).toBe(1);
      expect(result.amountCents).toBe(1000);
    });

    it('treats age below minAge as not qualifying', () => {
      const result = calculateFee([yes(12)], { amountCents: 1000, minAge: 13 });
      expect(result.qualifyingAttendees).toBe(0);
      expect(result.amountCents).toBe(0);
    });

    it('treats age 0 as qualifying when minAge is 0', () => {
      const result = calculateFee([yes(0)], { amountCents: 500, minAge: 0 });
      expect(result.qualifyingAttendees).toBe(1);
      expect(result.amountCents).toBe(500);
    });

    it('treats age 0 as qualifying even when minAge is greater than 0', () => {
      const result = calculateFee([yes(0)], { amountCents: 500, minAge: 1 });
      expect(result.qualifyingAttendees).toBe(1);
      expect(result.amountCents).toBe(500);
    });
  });

  describe('multiplication', () => {
    it('multiplies qualifying attendees by the per-attendee amount', () => {
      const result = calculateFee([yes(35), yes(40), yes(45)], { amountCents: 2500, minAge: 13 });
      expect(result.qualifyingAttendees).toBe(3);
      expect(result.amountCents).toBe(7500);
    });

    it('mixes qualifying and non-qualifying attendees correctly', () => {
      const result = calculateFee([yes(35), yes(8), yes(40), no(20), maybe(50)], {
        amountCents: 1000,
        minAge: 13,
      });
      expect(result.qualifyingAttendees).toBe(2);
      expect(result.totalAttendees).toBe(5);
      expect(result.amountCents).toBe(2000);
    });
  });
});

describe('calculateFeeFromEvent', () => {
  it('returns zero when the event has no fee configured', () => {
    const result = calculateFeeFromEvent([yes(35)], {
      registrationFeeCents: null,
      registrationFeeMinAge: 0,
    });
    expect(result).toEqual({ amountCents: 0, qualifyingAttendees: 0, totalAttendees: 1 });
  });

  it('returns zero when the event fee is 0', () => {
    const result = calculateFeeFromEvent([yes(35)], {
      registrationFeeCents: 0,
      registrationFeeMinAge: 13,
    });
    expect(result).toEqual({ amountCents: 0, qualifyingAttendees: 0, totalAttendees: 1 });
  });

  it('computes the fee from a populated event row', () => {
    const result = calculateFeeFromEvent([yes(35), yes(8), yes(40)], {
      registrationFeeCents: 1500,
      registrationFeeMinAge: 13,
    });
    expect(result.amountCents).toBe(3000);
    expect(result.qualifyingAttendees).toBe(2);
    expect(result.totalAttendees).toBe(3);
  });

  it('returns zero when the event is null', () => {
    const result = calculateFeeFromEvent([yes(35)], null);
    expect(result).toEqual({ amountCents: 0, qualifyingAttendees: 0, totalAttendees: 1 });
  });
});
