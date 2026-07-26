import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginForm from '../LoginForm';

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { signIn } from 'next-auth/react';

const mockedSignIn = vi.mocked(signIn);

beforeEach(() => {
  vi.clearAllMocks();
  mockedSignIn.mockReset();
});

describe('LoginForm', () => {
  it('renders welcome message and Google sign-in', () => {
    render(<LoginForm devAuthEnabled={false} />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('does not render dev form when devAuthEnabled is false', () => {
    render(<LoginForm devAuthEnabled={false} />);
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
  });

  it('renders dev form when devAuthEnabled is true', () => {
    render(<LoginForm devAuthEnabled={true} />);
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('updates username and password fields', () => {
    render(<LoginForm devAuthEnabled={true} />);
    const usernameInput = screen.getByLabelText('Username') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'pass' } });
    expect(usernameInput.value).toBe('admin');
    expect(passwordInput.value).toBe('pass');
  });

  it('submits dev login form and calls signIn', async () => {
    mockedSignIn.mockResolvedValue({} as never);
    render(<LoginForm devAuthEnabled={true} />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in \(dev\)/i }));
    await waitFor(() => {
      expect(mockedSignIn).toHaveBeenCalledWith('dev-credentials', {
        username: 'admin',
        password: 'pass',
        redirect: true,
        callbackUrl: '/',
      });
    });
  });

  it('shows error message on signIn failure', async () => {
    mockedSignIn.mockResolvedValue({ error: 'Invalid credentials' } as never);
    render(<LoginForm devAuthEnabled={true} />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in \(dev\)/i }));
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('triggers Google sign in', async () => {
    mockedSignIn.mockResolvedValue({} as never);
    render(<LoginForm devAuthEnabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(mockedSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/' });
  });

  it('renders back to home link', () => {
    render(<LoginForm devAuthEnabled={false} />);
    const link = screen.getByRole('link', { name: /back to home/i });
    expect(link).toHaveAttribute('href', '/');
  });
});
