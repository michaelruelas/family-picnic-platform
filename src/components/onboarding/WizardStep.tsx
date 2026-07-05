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
        <h1 className="text-foreground text-3xl font-bold">{title}</h1>
        {description && <p className="text-muted-foreground mt-3 text-lg">{description}</p>}
      </div>

      <div className="mb-8 rounded-xl bg-white p-8 shadow-sm ring-1 ring-stone-200">{children}</div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          {!isFirst && onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={isLoading}
              className="border-border text-foreground/85 hover:bg-secondary/60 rounded-lg border bg-white px-6 py-3 text-lg font-medium disabled:opacity-50"
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
              className="text-muted-foreground hover:text-foreground/85 rounded-lg px-6 py-3 text-lg font-medium disabled:opacity-50"
            >
              {skipLabel || 'Skip'}
            </button>
          )}

          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled || isLoading}
              className="bg-terracotta hover:bg-terracotta rounded-lg px-8 py-3 text-lg font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Please wait...' : nextLabel || (isLast ? 'Get Started' : 'Continue')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
