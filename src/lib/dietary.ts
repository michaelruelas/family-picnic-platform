export const STANDARD_DIETARY_LABELS = [
  'vegetarian',
  'vegan',
  'gluten_free',
  'contains_nuts',
  'dairy_free',
] as const;

export type DietaryLabel = (typeof STANDARD_DIETARY_LABELS)[number];

export function parseDietaryNotesToLabels(notes: string | null): string[] {
  if (!notes) return [];
  const lower = notes.toLowerCase();
  const labels: string[] = [];
  if (lower.includes('vegetarian') && !lower.includes('non-vegetarian')) labels.push('vegetarian');
  if (lower.includes('vegan')) labels.push('vegan');
  if (lower.includes('gluten') || lower.includes('celiac') || lower.includes('gf'))
    labels.push('gluten_free');
  if (lower.includes('nut') || lower.includes('peanut') || lower.includes('allergy'))
    labels.push('contains_nuts');
  if (lower.includes('dairy') || lower.includes('lactose') || lower.includes('milk'))
    labels.push('dairy_free');
  return labels;
}

export interface DietaryAttendee {
  id: string;
  headcount: number;
  dietaryNotes: string | null;
  respondedAt: Date | null;
  user: {
    id: string;
    name: string | null;
    household: { name: string | null } | null;
  };
}

export function getDietarySummary(attendees: DietaryAttendee[]) {
  const counts: Record<string, number> = {};
  for (const label of STANDARD_DIETARY_LABELS) {
    counts[label] = 0;
  }
  for (const attendee of attendees) {
    const labels = parseDietaryNotesToLabels(attendee.dietaryNotes);
    for (const label of labels) {
      counts[label] = (counts[label] || 0) + 1;
    }
  }
  return counts;
}
