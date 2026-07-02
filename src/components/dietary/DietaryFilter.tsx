'use client';

import { STANDARD_DIETARY_LABELS } from './DietaryLabelChip';
import { getDietaryLabelConfig } from './DietaryLabelChip';

interface DietaryFilterProps {
  selectedLabel: string | null;
  onSelectLabel: (label: string | null) => void;
}

export default function DietaryFilter({ selectedLabel, onSelectLabel }: DietaryFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-stone-600">Filter by dietary need:</span>
      <button
        onClick={() => onSelectLabel(null)}
        className={`rounded-full px-3 py-1 text-sm transition-colors ${
          selectedLabel === null
            ? 'bg-stone-800 text-white'
            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
        }`}
      >
        All
      </button>
      {STANDARD_DIETARY_LABELS.map((label) => {
        const config = getDietaryLabelConfig(label);
        return (
          <button
            key={label}
            onClick={() => onSelectLabel(label)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              selectedLabel === label
                ? 'bg-stone-800 text-white'
                : `${config.color} hover:opacity-80`
            }`}
          >
            {config.emoji} {config.label}
          </button>
        );
      })}
    </div>
  );
}
