'use client';

import { useEffect, useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, CardContent, Input, Textarea } from '~/components/ui';
import PotluckEditor from '~/components/event/PotluckEditor';
import PaymentForm from '~/components/payment/PaymentForm';
import { trpc } from '~/lib/trpc-client';

type Member = { id: string; name: string; age: number | null };
type Attendance = 'YES' | 'MAYBE' | 'NO';

type Props = {
  token: string;
  signedIn: boolean;
  /**
   * FPP-89 review: the wizard mirrors the LoginForm provider list
   * so Apple/Facebook appear whenever they are configured in env.
   * Previously the buttons were hardcoded disabled with a stale
   * "not yet wired" note, which contradicted the ticket's
   * Step 1 spec and made the wizard feel out of sync with the
   * login page when Apple/Facebook were deployed.
   */
  enabledProviders: Array<'google' | 'apple' | 'facebook'>;
  event: {
    id: string;
    name: string;
    date: string;
    location: string;
    deadline: string | null;
    registrationFeeCents: number;
    registrationFeeMinAge: number;
    currency: string;
  };
  host: { name: string; phone: string | null };
  household: { id: string; name: string; members: Member[] } | null;
  stripePublishableKey?: string;
  paymentReturnUrl: string;
};

const labels = ['Invite', 'Sign in', 'Attend', 'Members', 'Dishes', 'Confirm'];

export default function InvitationClient({
  token,
  signedIn,
  enabledProviders,
  event,
  host,
  household,
  stripePublishableKey,
  paymentReturnUrl,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedStep = Number(searchParams.get('step') ?? '0');
  const step =
    Number.isInteger(requestedStep) && requestedStep >= 0 && requestedStep <= 5 ? requestedStep : 0;
  const [completedStep, setCompletedStep] = useState(step);
  const [attending, setAttending] = useState<boolean | null>(null);
  const [declineMessage, setDeclineMessage] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [newMembers, setNewMembers] = useState([{ name: '', age: '' }]);
  const [memberAttendances, setMemberAttendances] = useState<Record<string, Attendance>>(
    Object.fromEntries((household?.members ?? []).map((member) => [member.id, 'YES'])),
  );
  const [setupError, setSetupError] = useState<string | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [rsvpConfirmed, setRsvpConfirmed] = useState(false);

  const confirmRsvp = trpc.rsvp.confirm.useMutation();
  const declineRsvp = trpc.rsvp.decline.useMutation();
  const consume = trpc.invitation.consume.useMutation();

  const goTo = (next: number) => {
    setCompletedStep((current) => Math.max(current, next));
    router.push(`${pathname}?step=${next}`);
  };

  useEffect(() => {
    // FPP-89 review: an unauthenticated visitor who pastes
    // ?step=3 (or any step >= 2) directly into the URL would
    // otherwise render the form and only learn auth is required
    // when the mutation throws UNAUTHORIZED. Step 1 IS the
    // sign-in step, so route them there instead.
    if (!signedIn && step >= 2) {
      router.replace(`${pathname}?step=1`);
    }
  }, [signedIn, step, pathname, router]);

  useEffect(() => {
    // FPP-89 review: only burn the token after `rsvpConfirmed`
    // is true. `rsvpConfirmed` flips in `saveMembers` (step 3)
    // and `sendDecline` (step 2 decline path), so a direct-URL
    // nav to step 5 with no RSVP saved leaves the token PENDING
    // and the user sees the "Start over" CTA below.
    if (step !== 5 || !rsvpConfirmed) return;
    if (consume.isPending || consume.isSuccess || consume.isError) return;
    consume.mutate({ token });
  }, [consume, rsvpConfirmed, step, token]);

  const selectedMembers = useMemo(
    () => (household?.members ?? []).filter((member) => memberAttendances[member.id] !== 'NO'),
    [household?.members, memberAttendances],
  );
  // FPP-113: the per-attendee fee only counts YES attendees whose age
  // is supplied and at or above the threshold. Mirror the canonical
  // `calculateFee` in src/lib/fee.ts — MAYBE/NO members and members
  // with no age on file must never trigger a charge.
  const amountCents = selectedMembers.reduce((total, member) => {
    if (memberAttendances[member.id] !== 'YES') return total;
    if (member.age === null || member.age < event.registrationFeeMinAge) return total;
    return total + event.registrationFeeCents;
  }, 0);

  async function setupHousehold() {
    const validMembers = newMembers.filter((member) => member.name.trim());
    if (!householdName.trim()) return;
    setSettingUp(true);
    setSetupError(null);
    try {
      const response = await fetch('/api/onboarding/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: householdName }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not create household');
      for (const member of validMembers) {
        const memberResponse = await fetch('/api/household-members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: member.name, age: member.age, relationship: 'Family' }),
        });
        if (!memberResponse.ok) {
          const memberResult = (await memberResponse.json()) as { error?: string };
          throw new Error(memberResult.error ?? `Could not add ${member.name}`);
        }
      }
      router.refresh();
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Could not create household');
    } finally {
      setSettingUp(false);
    }
  }

  async function sendDecline() {
    await declineRsvp.mutateAsync({
      eventId: event.id,
      declineMessage: declineMessage || undefined,
    });
    setRsvpConfirmed(true);
    goTo(5);
  }

  async function saveMembers() {
    const attendances = (household?.members ?? []).map((member) => ({
      householdMemberId: member.id,
      memberName: member.name,
      memberAge: member.age ?? undefined,
      attending: memberAttendances[member.id] ?? 'NO',
    }));
    await confirmRsvp.mutateAsync({ eventId: event.id, memberAttendances: attendances });
    setRsvpConfirmed(true);
    goTo(4);
  }

  const date = new Date(event.date);
  const deadline = event.deadline ? new Date(event.deadline) : null;
  const callbackUrl = `${pathname}?step=1`;

  return (
    <main className="bg-background min-h-screen pb-36">
      <header className="border-border bg-card sticky top-0 z-20 border-b px-4 py-4">
        <nav aria-label="RSVP progress" className="mx-auto grid max-w-4xl grid-cols-6 gap-2">
          {labels.map((label, index) => (
            <button
              key={label}
              type="button"
              disabled={index > completedStep}
              onClick={() => goTo(index)}
              className="disabled:cursor-not-allowed"
              aria-current={index === step ? 'step' : undefined}
            >
              <span
                className={`block h-2 rounded-sm ${index <= step ? 'bg-terracotta' : 'bg-secondary'}`}
              />
              <span className="text-muted-foreground mt-1 hidden text-xs sm:block">{label}</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {step === 0 ? (
          <Card className="overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lake-banner.jpg" alt="" className="h-44 w-full object-cover" />
            <CardContent className="space-y-5 p-7">
              <p className="text-terracotta text-sm font-semibold tracking-wide uppercase">
                You’re invited
              </p>
              <h1 className="font-display text-foreground text-4xl font-semibold">{event.name}</h1>
              <dl className="text-foreground grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground text-sm">Date</dt>
                  <dd>{date.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm">Host</dt>
                  <dd>{host.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm">Location</dt>
                  <dd>{event.location}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm">RSVP by</dt>
                  <dd>
                    {deadline
                      ? deadline.toLocaleDateString('en-US', { dateStyle: 'long' })
                      : 'No deadline'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ) : null}

        {step === 1 ? (
          <section className="space-y-5">
            <h1 className="font-display text-foreground text-3xl font-semibold">
              {signedIn ? 'Set up your household' : 'Sign in to RSVP'}
            </h1>
            {!signedIn ? (
              <div className="space-y-3">
                {enabledProviders.includes('google') && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => void signIn('google', { callbackUrl })}
                    data-testid="wizard-signin-google"
                  >
                    Continue with Google
                  </Button>
                )}
                {enabledProviders.includes('apple') && (
                  <Button
                    className="w-full"
                    size="lg"
                    variant="outline"
                    onClick={() => void signIn('apple', { callbackUrl })}
                    data-testid="wizard-signin-apple"
                  >
                    Continue with Apple
                  </Button>
                )}
                {enabledProviders.includes('facebook') && (
                  <Button
                    className="w-full"
                    size="lg"
                    variant="outline"
                    onClick={() => void signIn('facebook', { callbackUrl })}
                    data-testid="wizard-signin-facebook"
                  >
                    Continue with Facebook
                  </Button>
                )}
                {enabledProviders.length === 0 && (
                  <p className="text-muted-foreground text-center text-sm">
                    No sign-in providers are configured for this environment.
                  </p>
                )}
              </div>
            ) : household ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-sm">Household</p>
                  <p className="text-foreground text-xl font-semibold">{household.name}</p>
                  <p className="text-muted-foreground mt-2">
                    {household.members.length} member{household.members.length === 1 ? '' : 's'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Input
                  label="Household name"
                  value={householdName}
                  onChange={(event) => setHouseholdName(event.target.value)}
                />
                {newMembers.map((member, index) => (
                  <div className="grid grid-cols-[1fr_7rem] gap-3" key={index}>
                    <Input
                      aria-label={`Member ${index + 1} name`}
                      placeholder="Member name"
                      value={member.name}
                      onChange={(event) =>
                        setNewMembers((rows) =>
                          rows.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, name: event.target.value } : row,
                          ),
                        )
                      }
                    />
                    <Input
                      aria-label={`Member ${index + 1} age`}
                      placeholder="Age"
                      inputMode="numeric"
                      value={member.age}
                      onChange={(event) =>
                        setNewMembers((rows) =>
                          rows.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, age: event.target.value } : row,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setNewMembers((rows) => [...rows, { name: '', age: '' }])}
                >
                  Add member
                </Button>
                {setupError ? (
                  <p role="alert" className="text-destructive text-sm">
                    {setupError}
                  </p>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-5">
            <h1 className="font-display text-foreground text-3xl font-semibold">
              Can your household make it?
            </h1>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { value: true, label: 'Yes, we’ll be there' },
                { value: false, label: 'Can’t make it' },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setAttending(option.value)}
                  className={`rounded-sm border p-7 text-left text-xl font-semibold ${attending === option.value ? 'border-terracotta bg-terracotta/10' : 'border-border bg-card'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {attending === false ? (
              <Textarea
                label="Note to the host (optional)"
                value={declineMessage}
                onChange={(event) => setDeclineMessage(event.target.value)}
              />
            ) : null}
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-5">
            <h1 className="font-display text-foreground text-3xl font-semibold">Who’s coming?</h1>
            {(household?.members ?? []).map((member) => (
              <Card key={member.id}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    {member.age !== null ? (
                      <p className="text-muted-foreground text-sm">Age {member.age}</p>
                    ) : null}
                  </div>
                  <div className="bg-secondary grid grid-cols-3 rounded-sm p-1">
                    {(['YES', 'MAYBE', 'NO'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setMemberAttendances((current) => ({ ...current, [member.id]: value }))
                        }
                        className={`rounded-sm px-3 py-2 text-sm ${memberAttendances[member.id] === value ? 'bg-card shadow-sm' : ''}`}
                      >
                        {value === 'YES' ? 'Going' : value === 'MAYBE' ? 'Maybe' : 'Not going'}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-5">
            <h1 className="font-display text-foreground text-3xl font-semibold">Bring a dish</h1>
            <p className="text-muted-foreground">
              Claim a potluck item, or skip this optional step.
            </p>
            <PotluckEditor eventId={event.id} hasRsvp isRsvpConfirmed readOnly={false} />
          </section>
        ) : null}

        {step === 5 ? (
          <section className="space-y-5">
            <h1 className="font-display text-foreground text-3xl font-semibold">Your RSVP</h1>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-5">
                  <p className="text-muted-foreground text-sm">RSVP</p>
                  <p className="mt-2 font-semibold">
                    {attending === false ? 'Not attending' : `${selectedMembers.length} attending`}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-muted-foreground text-sm">Dishes</p>
                  <p className="mt-2 font-semibold">Saved with your RSVP</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-muted-foreground text-sm">Payment</p>
                  <p className="mt-2 font-semibold">
                    {amountCents > 0
                      ? `${event.currency.toUpperCase()} ${(amountCents / 100).toFixed(2)}`
                      : 'No payment due'}
                  </p>
                </CardContent>
              </Card>
            </div>
            {consume.isError ? (
              <div className="space-y-3">
                <p role="alert" className="text-destructive">
                  {consume.error.message}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    consume.reset();
                    consume.mutate({ token });
                  }}
                >
                  Retry confirmation
                </Button>
              </div>
            ) : null}
            {amountCents > 0 && stripePublishableKey && rsvpConfirmed ? (
              <PaymentForm
                eventId={event.id}
                eventName={event.name}
                amountCents={amountCents}
                currency={event.currency}
                publishableKey={stripePublishableKey}
                returnUrl={paymentReturnUrl}
              />
            ) : null}
          </section>
        ) : null}
      </div>

      {host.phone ? (
        <a
          href={`sms:${host.phone}`}
          className="bg-card/95 border-border fixed right-0 bottom-20 left-0 z-20 border-t px-4 py-3 text-center text-sm font-medium backdrop-blur"
        >
          Stuck? Text the host at {host.phone}.
        </a>
      ) : null}
      <footer className="bg-background/95 border-border fixed right-0 bottom-0 left-0 z-30 border-t p-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl justify-end gap-3">
          {step === 0 ? (
            <Button size="lg" onClick={() => goTo(1)}>
              RSVP now
            </Button>
          ) : null}
          {step === 1 && signedIn && !household ? (
            <Button
              size="lg"
              disabled={!householdName.trim()}
              title={!householdName.trim() ? 'Enter a household name' : undefined}
              isLoading={settingUp}
              onClick={() => void setupHousehold()}
              data-testid="wizard-cta-save-household"
            >
              Save household
            </Button>
          ) : null}
          {step === 1 && signedIn && household ? (
            <Button size="lg" onClick={() => goTo(2)}>
              Continue
            </Button>
          ) : null}
          {step === 1 && !signedIn && enabledProviders.length === 0 ? (
            <Button
              size="lg"
              disabled
              title="No sign-in providers are configured. Ask the host for help."
            >
              Continue
            </Button>
          ) : null}
          {step === 2 && attending === true ? (
            <Button size="lg" onClick={() => goTo(3)}>
              Continue
            </Button>
          ) : null}
          {step === 2 && attending === false ? (
            <Button size="lg" isLoading={declineRsvp.isPending} onClick={() => void sendDecline()}>
              Send my decline
            </Button>
          ) : null}
          {step === 2 && attending === null ? (
            <Button size="lg" disabled title="Choose yes or can’t make it">
              Continue
            </Button>
          ) : null}
          {step === 3 ? (
            <Button
              size="lg"
              disabled={!household?.members.length || selectedMembers.length === 0}
              isLoading={confirmRsvp.isPending}
              title={
                !household?.members.length
                  ? 'Add household members first'
                  : selectedMembers.length === 0
                    ? 'Select at least one person'
                    : undefined
              }
              onClick={() => void saveMembers()}
              data-testid="wizard-cta-save-attendance"
            >
              Save attendance
            </Button>
          ) : null}
          {step === 4 ? (
            <Button size="lg" onClick={() => goTo(5)}>
              Skip or continue
            </Button>
          ) : null}
          {step === 5 && consume.isError ? (
            <Button size="lg" variant="outline" onClick={() => router.push(`/events/${event.id}`)}>
              View event
            </Button>
          ) : null}
          {step === 5 && !rsvpConfirmed ? (
            <Button size="lg" variant="outline" onClick={() => goTo(2)}>
              Start over
            </Button>
          ) : null}
          {step === 5 && !consume.isError && rsvpConfirmed ? (
            <Link
              href={`/events/${event.id}`}
              className="bg-terracotta inline-flex min-h-12 items-center justify-center rounded-sm px-6 py-3 text-lg font-semibold text-white"
            >
              Done — view event
            </Link>
          ) : null}
        </div>
      </footer>
    </main>
  );
}
