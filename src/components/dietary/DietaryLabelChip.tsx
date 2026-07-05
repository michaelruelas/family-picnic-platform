'use client';

const DIETARY_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  vegetarian: { emoji: '🥬', label: 'Vegetarian', color: 'bg-sage/20 text-sage' },
  vegan: { emoji: '🌱', label: 'Vegan', color: 'bg-sage/20 text-foreground' },
  gluten_free: { emoji: '🌾', label: 'Gluten-Free', color: 'bg-terracotta/15 text-terracotta' },
  contains_nuts: {
    emoji: '🥜',
    label: 'Contains Nuts',
    color: 'bg-destructive/15 text-destructive',
  },
  dairy_free: { emoji: '🥛', label: 'Dairy-Free', color: 'bg-blue-100 text-blue-700' },
};

interface DietaryLabelChipProps {
  label: string;
  size?: 'sm' | 'md';
}

export default function DietaryLabelChip({ label, size = 'sm' }: DietaryLabelChipProps) {
  const config = DIETARY_LABELS[label];

  if (!config) {
    return (
      <span
        className={`bg-secondary text-muted-foreground inline-flex items-center gap-1 rounded-full ${
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
        }`}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${config.color} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}

export function getDietaryLabelConfig(label: string) {
  return (
    DIETARY_LABELS[label] || { emoji: '❓', label, color: 'bg-secondary text-muted-foreground' }
  );
}

export const STANDARD_DIETARY_LABELS = Object.keys(DIETARY_LABELS);
