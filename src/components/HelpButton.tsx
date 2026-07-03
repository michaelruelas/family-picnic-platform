'use client';

import { useState, useMemo } from 'react';

interface HelpContent {
  title: string;
  content: string;
}

const DEFAULT_HELP: HelpContent = {
  title: 'Help',
  content:
    'Welcome to the Family Picnic Platform! Browse events, RSVP, and coordinate potluck contributions.',
};

const HELP_CONTENT: Record<string, HelpContent> = {
  events: {
    title: 'Events Help',
    content:
      'Browse upcoming events and RSVP for your family. Each event shows date, time, location, and available potluck slots.',
  },
  potluck: {
    title: 'Potluck Help',
    content:
      'Sign up to bring a dish for the potluck. Choose a category (main, side, dessert, etc.) and let us know if you have any dietary restrictions.',
  },
  photos: {
    title: 'Photos Help',
    content:
      'Upload and share photos from events. Your photos are private to your household unless you choose to share them publicly.',
  },
  profile: {
    title: 'Profile Help',
    content:
      'Manage your family members, update your contact preferences, and view your household information.',
  },
  household: {
    title: 'Household Help',
    content:
      'Your household groups your family together for RSVPs and headcount tracking. Add family members to include them in your count.',
  },
  rsvp: {
    title: 'RSVP Help',
    content:
      'RSVP lets you tell us how many people in your family are attending. We use this to plan food, seating, and more.',
  },
};

interface HelpButtonProps {
  context?: string;
  className?: string;
}

export default function HelpButton({ context = 'events', className = '' }: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState(context);
  const content = useMemo(() => HELP_CONTENT[selectedContext] ?? DEFAULT_HELP, [selectedContext]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed right-6 bottom-6 flex h-14 w-14 items-center justify-center rounded-full bg-amber-700 text-2xl text-white shadow-lg hover:bg-amber-800 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:outline-none ${className}`}
        aria-label="Open help"
      >
        ?
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="max-w-md rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="help-title"
          >
            <div className="mb-4 flex items-start justify-between">
              <h2 id="help-title" className="text-xl font-bold text-stone-900">
                {content.title}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-2xl text-stone-400 hover:text-stone-600"
                aria-label="Close help"
              >
                ×
              </button>
            </div>
            <p className="text-lg text-stone-600">{content.content}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(Object.keys(HELP_CONTENT) as Array<keyof typeof HELP_CONTENT>).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedContext(key)}
                  className={`rounded-lg px-3 py-1 text-sm capitalize transition-colors ${
                    selectedContext === key
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-lg bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                <strong>Need more help?</strong> Contact your family admin or email
                support@example.com
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
