import type { APIRequestContext } from '@playwright/test';

/**
 * Lightweight admin/event API helpers. These wrap the existing REST endpoints
 * so tests can exercise the full stack (auth + handler + Prisma) without
 * reaching below the routing layer.
 *
 * These helpers assume the NextAuth session cookie is already set on the
 * `request` context. Pass `page.request` to share cookies with the browser.
 */

export interface CreateEventInput {
  name: string;
  date: string;
  location: string;
  description?: string;
  rsvpDeadline?: string;
  maxCapacity?: number;
  mapImageUrl?: string;
  registrationFeeCents?: number;
  registrationFeeMinAge?: number;
}

export async function createEvent(
  request: APIRequestContext,
  input: CreateEventInput,
): Promise<{ id: string }> {
  const response = await request.post('/api/admin/events', {
    data: input,
  });
  if (!response.ok()) {
    throw new Error(`createEvent failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

export async function publishEvent(request: APIRequestContext, eventId: string): Promise<void> {
  const response = await request.post(`/api/admin/events/${eventId}/publish`);
  if (!response.ok()) {
    throw new Error(`publishEvent failed: ${response.status()} ${await response.text()}`);
  }
}

export async function closeEvent(request: APIRequestContext, eventId: string): Promise<void> {
  const response = await request.post(`/api/admin/events/${eventId}/close`);
  if (!response.ok()) {
    throw new Error(`closeEvent failed: ${response.status()} ${await response.text()}`);
  }
}

export async function cancelEvent(request: APIRequestContext, eventId: string): Promise<void> {
  const response = await request.post(`/api/admin/events/${eventId}/cancel`);
  if (!response.ok()) {
    throw new Error(`cancelEvent failed: ${response.status()} ${await response.text()}`);
  }
}

export async function deleteEvent(request: APIRequestContext, eventId: string): Promise<void> {
  const response = await request.delete(`/api/admin/events/${eventId}`);
  if (!response.ok()) {
    throw new Error(`deleteEvent failed: ${response.status()} ${await response.text()}`);
  }
}

export async function createPotluckSlot(
  request: APIRequestContext,
  eventId: string,
  input: {
    category: 'MAIN' | 'SIDE' | 'DESSERT' | 'DRINK' | 'OTHER';
    name?: string;
    slotType: 'LIMITED' | 'UNLIMITED';
    maxSignups?: number;
  },
): Promise<{ id: string }> {
  const response = await request.post('/api/admin/potluck-slots', {
    data: { eventId, ...input },
  });
  if (!response.ok()) {
    throw new Error(`createPotluckSlot failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

export async function submitRsvp(
  request: APIRequestContext,
  input: {
    eventId: string;
    status: 'CONFIRMED' | 'DECLINED';
    headcount?: number;
    memberAttendances?: Array<{
      householdMemberId: string | null;
      memberName: string;
      memberAge: number | null;
      attending: 'YES' | 'NO' | 'MAYBE';
    }>;
  },
): Promise<{ id: string }> {
  const action = input.status === 'CONFIRMED' ? 'confirm' : 'decline';
  const response = await request.post('/api/rsvp', {
    data: {
      eventId: input.eventId,
      action,
      headcount: input.headcount,
      memberAttendances: input.memberAttendances,
    },
  });
  if (!response.ok()) {
    throw new Error(`submitRsvp failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

export async function signupForPotluck(
  request: APIRequestContext,
  input: {
    slotId: string;
    rsvpId: string;
    dishName: string;
    servings?: number;
    dietaryLabels?: string[];
  },
): Promise<{ id: string }> {
  const response = await request.post('/api/potluck-signup', { data: input });
  if (!response.ok()) {
    throw new Error(`signupForPotluck failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

export async function sendInvitation(
  request: APIRequestContext,
  eventId: string,
  householdId: string,
): Promise<{ id: string }> {
  const response = await request.post('/api/admin/invitations/send', {
    data: { eventId, householdId },
  });
  if (!response.ok()) {
    throw new Error(`sendInvitation failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}
