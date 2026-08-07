import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('FPP-89: /events/invitation/[token] RSVP wizard', () => {
  const pagePath = path.join(process.cwd(), 'src/app/events/invitation/[token]/page.tsx');
  const clientPath = path.join(process.cwd(), 'src/app/events/invitation/[token]/InvitationClient.tsx');
  const invitationRouterPath = path.join(process.cwd(), 'src/server/routers/invitation.router.ts');

  it('serves a server component at the wizard route', async () => {
    const page = await fs.readFile(pagePath, 'utf-8');
    expect(page).toMatch(/export const dynamic = 'force-dynamic'/);
    // The page is a server component (no 'use client' directive).
    expect(page).not.toMatch(/^['"]use client['"]/m);
    // It loads the invitation by token and renders the client wizard.
    expect(page).toMatch(/prisma\.invitation\.findUnique/);
    expect(page).toMatch(/InvitationClient/);
  });

  it('renders the four pre-flight error pages (not found, used, expired, past)', async () => {
    const page = await fs.readFile(pagePath, 'utf-8');
    expect(page).toMatch(/Invitation unavailable/);
    expect(page).toMatch(/Invitation expired/);
    expect(page).toMatch(/Account unavailable/);
    expect(page).toMatch(/This event has passed/);
    // Already-used and already-RSVPed both deep-link to the event page.
    expect(page).toMatch(/You already responded/);
    expect(page).toMatch(/You already have an RSVP/);
  });

  it('surfaces the host phone as both a sticky help link and a contact fallback', async () => {
    const page = await fs.readFile(pagePath, 'utf-8');
    expect(page).toMatch(/invitedBy\.phoneNumber/);
    expect(page).toMatch(/sms:\${hostPhone}/);
  });

  it('client wizard drives state via ?step= and renders all six steps', async () => {
    const client = await fs.readFile(clientPath, 'utf-8');
    expect(client).toMatch(/searchParams\.get\('step'\)/);
    expect(client).toMatch(/step === 0/);
    expect(client).toMatch(/step === 1/);
    expect(client).toMatch(/step === 2/);
    expect(client).toMatch(/step === 3/);
    expect(client).toMatch(/step === 4/);
    expect(client).toMatch(/step === 5/);
    // The labels match the ticket's step list.
    expect(client).toMatch(/'Invite'/);
    expect(client).toMatch(/'Sign in'/);
    expect(client).toMatch(/'Attend'/);
    expect(client).toMatch(/'Members'/);
    expect(client).toMatch(/'Dishes'/);
    expect(client).toMatch(/'Confirm'/);
  });

  it('client wizard wires step 0 to validate and step 5 to consume', async () => {
    const client = await fs.readFile(clientPath, 'utf-8');
    // Step 0 boots straight from the server-rendered props (no
    // client-side tRPC validate call). The route reads the
    // invitation directly via prisma before the client ever
    // mounts, so the wizard is a render of server data.
    const page = await fs.readFile(pagePath, 'utf-8');
    expect(page).toMatch(/prisma\.invitation\.findUnique/);
    // Step 5 burns the token on first render.
    expect(client).toMatch(/consume\.mutate\(\{ token \}\)/);
    expect(client).toMatch(/trpc\.invitation\.consume\.useMutation/);
  });

  it('FPP-89 review: unauthenticated visitors on step >= 2 are routed to the sign-in step', async () => {
    const client = await fs.readFile(clientPath, 'utf-8');
    // The wizard's rsvp/potluck mutations are protected, so an
    // unauthenticated visitor who pastes ?step=3 directly would
    // otherwise hit UNAUTHORIZED at the click. The fix pushes
    // them to ?step=1 (the sign-in step) on mount.
    expect(client).toMatch(/!\s*signedIn\s*&&\s*step\s*>=\s*2/);
    expect(client).toMatch(/router\.replace\(`\$\{pathname\}\?step=1`\)/);
  });

  it('FPP-89 review: consume only fires after the RSVP is saved', async () => {
    const client = await fs.readFile(clientPath, 'utf-8');
    // The effect that calls consume.mutate must check
    // rsvpConfirmed so a direct-URL nav to step 5 (or a back-
    // and-forth without re-saving) cannot burn the token before
    // an RSVP exists. The matching dependency on rsvpConfirmed
    // in the effect array is the second half of the contract.
    expect(client).toMatch(/step !== 5 \|\| !rsvpConfirmed/);
    expect(client).toMatch(/\[consume, rsvpConfirmed, step, token\]/);
  });

  it('FPP-89 review: step 5 has a primary CTA even when consume succeeds', async () => {
    const client = await fs.readFile(clientPath, 'utf-8');
    // The "Done — view event" link must live in the sticky
    // footer for the success path so the user is never left on
    // a page with no way forward.
    expect(client).toMatch(/Done\s*—\s*view event/);
    expect(client).toMatch(/href=\{`\/events\/\$\{event\.id\}`\}/);
  });

  it('FPP-89 review: consume error surfaces a retry and a way out', async () => {
    const client = await fs.readFile(clientPath, 'utf-8');
    // When consume fails the user must see the error AND have a
    // retry button. The footer must also give them a "View
    // event" exit so they are not trapped on the wizard.
    expect(client).toMatch(/consume\.isError/);
    expect(client).toMatch(/Retry confirmation/);
    expect(client).toMatch(/step === 5 && consume\.isError/);
    expect(client).toMatch(/View event/);
  });

  it('FPP-89 review: unauthenticated consumption is logged to AdminAuditLog', async () => {
    const router = await fs.readFile(invitationRouterPath, 'utf-8');
    // Every successful consume must write an audit row so a bad
    // actor with a list of valid tokens leaves a trail. The
    // action label should be the procedure path so existing
    // audit viewers surface it consistently.
    const consumeBlock = router.split(/consume:\s*procedure/)[1] ?? '';
    expect(consumeBlock).toMatch(/writeAuditLog/);
    expect(consumeBlock).toMatch(/action:\s*['"]invitation\.consume['"]/);
  });

  it('client wizard calls rsvp.confirm and rsvp.decline for the two attendance paths', async () => {
    const client = await fs.readFile(clientPath, 'utf-8');
    expect(client).toMatch(/trpc\.rsvp\.confirm\.useMutation/);
    expect(client).toMatch(/trpc\.rsvp\.decline\.useMutation/);
    // The decline path forwards the optional note via the
    // `declineMessage` field that FPP-88 introduced.
    expect(client).toMatch(/declineMessage:\s*declineMessage/);
  });

  it('client wizard embeds the existing potluck editor and Stripe Payment Element on the paid path', async () => {
    const client = await fs.readFile(clientPath, 'utf-8');
    expect(client).toMatch(/import PotluckEditor from '~\/components\/event\/PotluckEditor'/);
    expect(client).toMatch(/import PaymentForm from '~\/components\/payment\/PaymentForm'/);
    // The Stripe form only mounts after the user has confirmed
    // their RSVP and the event actually has a fee.
    expect(client).toMatch(/amountCents\s*>\s*0\s*&&\s*stripePublishableKey\s*&&\s*rsvpConfirmed/);
  });

  it('primary CTA per step is bottom-sticky and disabled CTAs show a reason', async () => {
    const client = await fs.readFile(clientPath, 'utf-8');
    // The CTA bar is fixed to the bottom of the viewport.
    expect(client).toMatch(/fixed\s+right-0\s+bottom-0/);
    // Every disabled CTA in the footer carries a `title` so the
    // user can hover (or focus, on mobile) to learn why.
    const disabledCtas = client.match(/disabled\s+title=/g) ?? [];
    expect(disabledCtas.length).toBeGreaterThanOrEqual(3);
  });

  it('progress bar is clickable for completed steps', async () => {
    const client = await fs.readFile(clientPath, 'utf-8');
    expect(client).toMatch(/aria-label="RSVP progress"/);
    // Each progress chip calls goTo(index) when clicked, but only
    // when the step is already unlocked.
    expect(client).toMatch(/disabled=\{index > completedStep\}/);
    expect(client).toMatch(/onClick=\{\(\) => goTo\(index\)\}/);
  });

  it('validate and consume are public procedures (no auth required) so the wizard can call them', async () => {
    const router = await fs.readFile(invitationRouterPath, 'utf-8');
    expect(router).toMatch(/validate:\s*procedure\b/);
    expect(router).toMatch(/consume:\s*procedure\b/);
  });
});
