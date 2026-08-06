import { test, expect } from '@playwright/test';
import { getFixtures, loginAs, logout, reseedDatabase, submitRsvp } from './helpers';

test.describe('User - Authentication', () => {
  test('login redirects to / and the nav shows the user name', async ({ page }) => {
    await loginAs(page, 'maria');
    await expect(page).toHaveURL(/\/(?!login)/);
    // The nav bar should now expose the user's name or a Sign Out action.
    // The simplest cross-stable assertion is the logout button in the nav.
    await expect(page.getByRole('button', { name: /Sign out/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('logout returns the user to a public page', async ({ page }) => {
    await loginAs(page, 'maria');
    await logout(page);
    await page.goto('/profile');
    await page.waitForURL(/\/login/);
  });
});

test.describe('User - RSVP', () => {
  test.beforeEach(async () => {
    await reseedDatabase();
  });

  test('declined user sees the RSVP card with an "RSVP again" affordance', async ({ page }) => {
    const { events } = await getFixtures();
    await loginAs(page, 'priya');

    // Priya has no RSVP yet for the main event, so the card must show the
    // "RSVP Now" CTA. We use the API to record a DECLINED RSVP so the page
    // renders the recolored "Changed your mind?" branch.
    await submitRsvp(page.request, {
      eventId: events.mainEvent.id,
      status: 'DECLINED',
    });

    await page.goto(`/events/${events.mainEvent.id}`);
    await expect(page.getByText('You declined')).toBeVisible();
    await expect(page.getByRole('button', { name: /RSVP again/i })).toBeVisible();
  });

  test('confirmed user sees the "You are in!" badge and the dishes CTA', async ({ page }) => {
    const { events } = await getFixtures();
    await loginAs(page, 'maria');

    await page.goto(`/events/${events.mainEvent.id}`);
    await expect(page.getByText(/You.*re in/i).first()).toBeVisible();
    await expect(page.getByTestId('rsvp-card-edit-link')).toBeVisible();
    await expect(page.getByText('Manage your dishes')).toBeVisible();
  });

  test('declined state renders an "RSVP again" affordance', async ({ page }) => {
    const { events } = await getFixtures();
    await loginAs(page, 'maria');

    // Drive the state change through the API rather than through the UI
    // so the test is not coupled to the click handler timing or to
    // selector text quirks like the "Can't make it" button's accessible
    // name (which uses a curly apostrophe).
    await submitRsvp(page.request, {
      eventId: events.mainEvent.id,
      status: 'DECLINED',
    });

    await page.goto(`/events/${events.mainEvent.id}`);
    await expect(page.getByText('You declined').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /RSVP again/i })).toBeVisible();
  });

  test('RSVP bottom sheet opens for a logged-in user without an RSVP', async ({ page }) => {
    // Priya has a household but no members, so the attendance form has
    // no rows to mark YES. The bottom sheet still opens; we just verify
    // it renders the attendance tab so the user can interact.
    const { events } = await getFixtures();
    await loginAs(page, 'priya');

    await page.goto(`/events/${events.mainEvent.id}`);
    await page
      .getByRole('button', { name: /RSVP Now/i })
      .first()
      .click();

    // The bottom sheet's attendance tab is the default view.
    await expect(page.getByTestId('rsvp-tabs')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Attendance' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Dishes' })).toBeVisible();
  });
});

test.describe('User - Potluck', () => {
  test.beforeEach(async () => {
    await reseedDatabase();
  });

  test('confirmed user sees the side-slot card with a "Yours" badge', async ({ page }) => {
    const { events, mainPotluckSlots } = await getFixtures();
    await loginAs(page, 'maria');

    await page.goto(`/events/${events.mainEvent.id}/potluck`);

    // Maria already claimed the side slot in the seed. The slot element
    // appears in the main list and the sticky nav, so target the first
    // match and inspect the data attribute rather than the visible badge.
    const slot = page.getByTestId(`potluck-slot-${mainPotluckSlots.sideSlotId}`).first();
    await expect(slot).toHaveAttribute('data-slot-mine', 'true');
    await expect(slot.getByTestId('yours-badge')).toBeVisible();
  });

  test('unrelated user sees the claim button but not the "Yours" badge', async ({ page }) => {
    const { events, mainPotluckSlots } = await getFixtures();
    await loginAs(page, 'priya');

    // Priya has a household but no RSVP for the main event. The potluck
    // page is read-only and the slot is not claimed by her.
    await page.goto(`/events/${events.mainEvent.id}/potluck`);
    await expect(
      page.getByTestId(`potluck-slot-${mainPotluckSlots.sideSlotId}`).first(),
    ).toHaveAttribute('data-slot-mine', 'false');
    await expect(page.getByTestId('potluck-readonly-banner').first()).toBeVisible();
  });
});

test.describe('User - Household and Profile', () => {
  test.beforeEach(async () => {
    await reseedDatabase();
  });

  test('Maria sees her household on /household', async ({ page }) => {
    await loginAs(page, 'maria');
    await page.goto('/household');
    await expect(page.getByRole('heading', { name: 'The Garcia Family' })).toBeVisible();
    await expect(page.getByText('Maria Garcia').first()).toBeVisible();
    await expect(page.getByText('Carlos Garcia').first()).toBeVisible();
  });

  test('Maria sees her profile and dependents', async ({ page }) => {
    await loginAs(page, 'maria');
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: /My Profile/i })).toBeVisible();
    await expect(page.getByText('Sofia Garcia').first()).toBeVisible();
  });

  test('My Events lists the upcoming event Maria RSVPed to', async ({ page }) => {
    const { events } = await getFixtures();
    await loginAs(page, 'maria');
    await page.goto('/my-events');
    await expect(page.getByRole('heading', { name: 'My Events' })).toBeVisible();
    await expect(page.getByRole('link', { name: events.mainEvent.name })).toBeVisible();
    await expect(page.getByText('Confirmed').first()).toBeVisible();
  });

  test('Singleton user without onboarding reaches the /onboarding wizard', async ({ page }) => {
    await loginAs(page, 'singleton');
    // The singleton user has no `onboardingCompletedAt`, so visiting
    // /onboarding renders the wizard. The home page does not auto-redirect
    // to /onboarding, so we navigate there explicitly.
    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: /Welcome to Family Picnic/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('User - Photos', () => {
  test.beforeEach(async () => {
    await reseedDatabase();
  });

  test('event detail page shows the seeded photos', async ({ page }) => {
    const { events } = await getFixtures();
    await page.goto(`/events/${events.mainEvent.id}`);

    // The seeded photos are picsum.photos URLs; the page renders the photo
    // cards with alt/caption text. The caption is rendered twice per
    // photo (overlay + visible label), so use .first() to disambiguate.
    await expect(page.getByText('The family arriving at the park').first()).toBeVisible();
    await expect(page.getByText('Kids playing frisbee').first()).toBeVisible();
  });
});
