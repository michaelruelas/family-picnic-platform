'use client';

import { useState, FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '~/lib/trpc-client';
import { useToast } from '~/components/ui/Toast';
import Modal from '~/components/ui/Modal';
import Button from '~/components/ui/Button';
import Input from '~/components/ui/Input';
import Textarea from '~/components/ui/Textarea';
import Select from '~/components/ui/Select';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  feedbackSubmitSchema,
  type FeedbackCategory,
} from '~/lib/schemas/feedback';

type Variant = 'link' | 'floating';

interface FeedbackButtonProps {
  variant?: Variant;
  className?: string;
}

const CATEGORY_OPTIONS = FEEDBACK_CATEGORIES.map((value) => ({
  value,
  label: FEEDBACK_CATEGORY_LABELS[value],
}));

export default function FeedbackButton({
  variant = 'link',
  className = '',
}: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('BUG');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { addToast } = useToast();
  const { data: session } = useSession();
  const pathname = usePathname();

  const submit = trpc.feedback.submit.useMutation();
  const isSignedIn = Boolean(session?.user);
  const trimmedMessage = message.trim();

  function resetForm() {
    setMessage('');
    setFieldErrors({});
    if (!isSignedIn) {
      setName('');
      setEmail('');
    }
  }

  function handleClose() {
    if (submit.isPending) return;
    resetForm();
    setIsOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});

    const candidate = {
      category,
      message: trimmedMessage,
      email: isSignedIn ? '' : email,
      name: isSignedIn ? '' : name,
      pageUrl: pathname ?? '',
    };
    const parsed = feedbackSubmitSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string' && !next[path]) {
          next[path] = issue.message;
        }
      }
      setFieldErrors(next);
      return;
    }

    try {
      await submit.mutateAsync(parsed.data);
      addToast('success', 'Thanks — your feedback is on its way to the team.');
      resetForm();
      setIsOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not send your feedback. Please try again.';
      addToast('error', message);
    }
  }

  const submitDisabled =
    submit.isPending || trimmedMessage.length < FEEDBACK_MESSAGE_MIN;

  const trigger =
    variant === 'floating' ? (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`bg-sage text-sage-foreground hover:bg-sage-hover focus:ring-sage fixed right-6 bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-sm text-2xl shadow-lg focus:ring-2 focus:ring-offset-2 focus:outline-none ${className}`}
        aria-label="Send feedback to the team"
        title="Send feedback"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`hover:text-foreground transition-colors ${className}`}
      >
        Send feedback
      </button>
    );

  return (
    <>
      {trigger}
      <Modal isOpen={isOpen} onClose={handleClose} title="Send feedback" size="md">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <p className="text-muted-foreground text-sm">
            Tell us what is broken, what you would like to see, or anything else. We read every
            message and will email you back if you leave a contact.
          </p>

          <Select
            name="category"
            label="What kind of feedback is this?"
            value={category}
            onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
            options={CATEGORY_OPTIONS}
            error={fieldErrors.category}
            required
          />

          <Textarea
            name="message"
            label="Your message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={FEEDBACK_MESSAGE_MAX}
            placeholder={`At least ${FEEDBACK_MESSAGE_MIN} characters. Describe what happened, what you expected, and any steps to reproduce.`}
            error={fieldErrors.message}
            hint={`${trimmedMessage.length} / ${FEEDBACK_MESSAGE_MAX}`}
            required
          />

          {!isSignedIn && (
            <div className="border-border/60 bg-secondary/40 space-y-4 rounded-sm border p-4">
              <p className="text-foreground text-sm font-medium">
                How should we reach you? (optional)
              </p>
              <Input
                name="name"
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                error={fieldErrors.name}
              />
              <Input
                name="email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                error={fieldErrors.email}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={submit.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitDisabled}>
              {submit.isPending ? 'Sending…' : 'Send feedback'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
