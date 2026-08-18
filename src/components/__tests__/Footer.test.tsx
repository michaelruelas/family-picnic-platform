import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// The Footer just embeds <FeedbackButton /> in the link slot; the
// full behaviour of the modal + tRPC submit is covered by the
// FeedbackButton + feedback router tests. Stubbing it here keeps the
// Footer test focused on layout.
vi.mock('../FeedbackButton', () => ({
  default: ({ variant }: { variant?: string }) => (
    <button type="button" data-testid={`feedback-${variant ?? 'link'}`}>
      Send feedback
    </button>
  ),
}));

import Footer from '../Footer';
import { APP_VERSION } from '~/lib/constants';

describe('Footer component', () => {
  it('renders footer with title and copyright', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('Folia Family Picnic')).toBeInTheDocument();
    const currentYear = new Date().getFullYear();
    expect(
      screen.getByText(new RegExp(`© ${currentYear} Folia Picnic\\. All rights reserved\\.`)),
    ).toBeInTheDocument();
  });

  it('displays build version', () => {
    render(<Footer />);
    expect(screen.getByText(new RegExp(`Build v${APP_VERSION}`))).toBeInTheDocument();
  });

  it('renders navigation links to legal pages and a feedback trigger', () => {
    render(<Footer />);
    const termsLink = screen.getByRole('link', { name: 'Terms of Service' });
    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
    const feedbackTrigger = screen.getByRole('button', { name: 'Send feedback' });

    expect(termsLink).toHaveAttribute('href', '/terms-of-service');
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy');
    expect(feedbackTrigger).toBeInTheDocument();
  });
});
