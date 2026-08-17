'use client';

import { useState, type ReactNode } from 'react';
import AdminSidebar from './AdminSidebar';
import CommandPalette from './CommandPalette';

interface AdminShellProps {
  children: ReactNode;
  /** Optional page-level header. Rendered above the children inside the main area. */
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

/**
 * Shared layout for every `/admin/*` page. Renders a left sidebar with
 * the primary nav and a right-side main column. The sidebar collapses
 * to a drawer on small screens (triggered by the hamburger button in
 * the mobile top bar).
 *
 * Pages that need their own toolbar inside the main column (e.g. a
 * "New event" button) should pass it via `actions`.
 */
export default function AdminShell({ children, title, description, actions }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="bg-background flex min-h-[calc(100vh-65px)]">
      {/* Desktop sidebar. Hidden on small screens; the drawer handles mobile. */}
      <div className="hidden md:block">
        <AdminSidebar />
      </div>

      {/* Mobile drawer. Backdrop + slide-in panel from the left. */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative z-50 h-full w-64 max-w-[80%] shadow-xl">
            <AdminSidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="flex-1 overflow-x-hidden">
        {/* Mobile top bar with hamburger. Hidden on md+ where the sidebar is visible. */}
        <div className="border-border bg-background sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="border-border bg-card text-foreground hover:bg-secondary rounded-sm border p-2"
            data-testid="admin-drawer-toggle"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-foreground font-semibold">Admin</span>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {(title || actions) && (
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                {title ? (
                  <h1 className="text-foreground text-2xl font-bold sm:text-3xl">{title}</h1>
                ) : null}
                {description ? (
                  <p className="text-muted-foreground mt-1 max-w-2xl text-sm sm:text-base">
                    {description}
                  </p>
                ) : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          )}
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  );
}
