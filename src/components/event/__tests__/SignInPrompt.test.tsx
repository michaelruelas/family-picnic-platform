import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignInPrompt } from '../SignInPrompt';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('SignInPrompt', () => {
  it('renders with default title and description', () => {
    render(<SignInPrompt />);
    expect(screen.getByText('A few details are just for family')).toBeInTheDocument();
    expect(screen.getByText(/Sign in to see who is bringing what/i)).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    render(<SignInPrompt title="My Title" description="My description" />);
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My description')).toBeInTheDocument();
  });

  it('renders children alongside the sign in link', () => {
    render(<SignInPrompt>Extra content</SignInPrompt>);
    expect(screen.getByText('Extra content')).toBeInTheDocument();
  });

  it('links to /login', () => {
    render(<SignInPrompt />);
    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it.each(['sunlight', 'sage', 'default'] as const)('applies %s variant classes', (variant) => {
    const { container } = render(<SignInPrompt variant={variant} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
