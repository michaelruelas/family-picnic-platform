'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';

interface LoginFormProps {
  devAuthEnabled: boolean;
}

export default function LoginForm({ devAuthEnabled }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const result = await signIn('dev-credentials', {
      username,
      password,
      redirect: true,
      callbackUrl: '/',
    });
    if (result?.error) {
      setError('Invalid credentials');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="text-5xl">🏕️</div>
          <h1 className="mt-4 text-2xl font-bold text-stone-900">Welcome Back</h1>
          <p className="mt-2 text-stone-600">
            Sign in to RSVP for events and join potluck sign-ups
          </p>
        </div>

        {devAuthEnabled && (
          <form onSubmit={handleDevLogin} className="mt-8 space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-stone-700">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                placeholder="Dev username"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                placeholder="Dev password"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-amber-600 px-4 py-3 text-white shadow-sm transition-all hover:bg-amber-700"
            >
              Sign in (Dev)
            </button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200" />
              </div>
              <div className="relative flex justify-center text-xs text-stone-500">
                <span className="bg-white px-2">or</span>
              </div>
            </div>
          </form>
        )}

        <div className="mt-8 space-y-4">
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-stone-700 shadow-sm ring-1 ring-stone-200 transition-all hover:bg-stone-50 hover:shadow-md"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-medium">Continue with Google</span>
          </button>
        </div>

        <div className="mt-8 rounded-lg bg-amber-50 p-4">
          <h2 className="font-medium text-amber-900">After signing in, you can:</h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            <li className="flex items-center gap-2">
              <span>✓</span> RSVP for upcoming events
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Sign up for potluck dishes
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Share photos from events
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Track dietary needs for your household
            </li>
          </ul>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-stone-500 hover:text-amber-700">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
