import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('renders navigation links to legal pages and contact', () => {
    render(<Footer />);
    const termsLink = screen.getByRole('link', { name: 'Terms of Service' });
    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
    const contactLink = screen.getByRole('link', { name: 'Contact' });

    expect(termsLink).toHaveAttribute('href', '/terms-of-service');
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy');
    expect(contactLink).toHaveAttribute('href', 'mailto:support@foliapicnic.com');
  });
});
