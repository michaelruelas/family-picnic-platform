'use client';

import type { ReactNode } from 'react';

interface WizardStepProps {
  title: string;
  description?: string;
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  nextLabel?: string;
  backLabel?: string;
  skipLabel?: string;
  nextDisabled?: boolean;
  isLoading?: boolean;
}

export default function WizardStep({
  title,
  description,
  children,
  onNext,
  onBack,
  onSkip,
  isFirst = false,
  isLast = false,
  nextLabel,
  backLabel,
  skipLabel,
  nextDisabled = false,
  isLoading = false,
}: WizardStepProps) {
  return (
    <div className="flex flex-col">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-stone-900">{title}</h1>
        {description && <p className="mt-3 text-lg text-stone-600">{description}</p>}
      </div>

      <div className="mb-8 rounded-xl bg-white p-8 shadow-sm ring-1 ring-stone-200">{children}</div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          {!isFirst && onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={isLoading}
              className="rounded-lg border border-stone-300 bg-white px-6 py-3 text-lg font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {backLabel || 'Back'}
            </button>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end gap-4">
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={isLoading}
              className="rounded-lg px-6 py-3 text-lg font-medium text-stone-500 hover:text-stone-700 disabled:opacity-50"
            >
              {skipLabel || 'Skip'}
            </button>
          )}

          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled || isLoading}
              className="rounded-lg bg-amber-700 px-8 py-3 text-lg font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Please wait...' : nextLabel || (isLast ? 'Get Started' : 'Continue')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
