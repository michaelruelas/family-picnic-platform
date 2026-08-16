import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TermsOfServicePage, { metadata } from '../page';

describe('TermsOfServicePage', () => {
  it('defines valid metadata', () => {
    expect(metadata.title).toBe('Terms of Service | Folia Picnic');
    expect(metadata.description).toBe('Terms of Service for the Folia Picnic platform.');
  });

  it('renders page header and main headings', () => {
    render(<TermsOfServicePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByText('Last updated: August 16, 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Back to home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy-policy',
    );
  });

  it('renders all 14 core sections', () => {
    render(<TermsOfServicePage />);
    expect(
      screen.getByRole('heading', { level: 2, name: '1. Agreement to Terms' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '2. Definitions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '3. User Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '4. User Content' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '5. Content Restrictions' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '6. Copyright Policy (DMCA)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '7. Intellectual Property' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '8. Third-Party Links' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '9. Termination' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '10. Limitation of Liability' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '11. Disclaimer of Warranties' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '12. Governing Law and Dispute Resolution' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '13. General Terms' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '14. Contact Us' })).toBeInTheDocument();
  });
});
