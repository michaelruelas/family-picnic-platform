import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrivacyPolicyPage, { metadata } from '../page';

describe('PrivacyPolicyPage', () => {
  it('defines valid metadata', () => {
    expect(metadata.title).toBe('Privacy Policy | Folia Picnic');
    expect(metadata.description).toBe('Privacy Policy for the Folia Picnic platform.');
  });

  it('renders page header and main headings', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText('Last updated: August 16, 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Back to home' })).toHaveAttribute('href', '/');
  });

  it('renders all 12 core privacy policy sections', () => {
    render(<PrivacyPolicyPage />);
    expect(screen.getByRole('heading', { level: 2, name: '1. Definitions' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '2. Information We Collect' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '3. How We Use Your Data' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '4. Sharing Your Data' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '5. Data Retention and Security' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: '6. Your Rights Under GDPR (European Union Users)',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: '7. Notice for California Residents (CCPA / CPRA)',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: "8. Children's Privacy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '9. Do Not Track Signals (CalOPPA)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '10. Links to Third-Party Sites' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: '11. Changes to This Privacy Policy' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '12. Contact Us' })).toBeInTheDocument();
  });
});
