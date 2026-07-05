'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Dependent {
  id: string;
  name: string;
  relationship: string;
  age: number | null;
  dietaryLabels: string[];
  isChild: boolean;
}

interface HouseholdClientProps {
  initialDependents: Dependent[];
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  SPOUSE: 'Spouse',
  CHILD: 'Child',
  PARENT: 'Parent',
  SIBLING: 'Sibling',
  INLAW: 'In-Law',
  COUSIN: 'Cousin',
};

export default function HouseholdClient({ initialDependents }: HouseholdClientProps) {
  const router = useRouter();
  const [dependents, setDependents] = useState<Dependent[]>(initialDependents);
  const [showDependentForm, setShowDependentForm] = useState(false);
  const [editingDependentId, setEditingDependentId] = useState<string | null>(null);
  const [dependentForm, setDependentForm] = useState({
    name: '',
    relationship: 'CHILD',
    age: '',
    dietaryLabels: '',
    isChild: false,
  });
  const [dependentError, setDependentError] = useState<string | null>(null);
  const [dependentSubmitting, setDependentSubmitting] = useState(false);

  const resetDependentForm = () => {
    setDependentForm({
      name: '',
      relationship: 'CHILD',
      age: '',
      dietaryLabels: '',
      isChild: false,
    });
    setEditingDependentId(null);
    setShowDependentForm(false);
    setDependentError(null);
  };

  const handleAddDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    setDependentSubmitting(true);
    setDependentError(null);

    try {
      const response = await fetch('/api/dependents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: dependentForm.name,
          relationship: dependentForm.relationship,
          age: dependentForm.age ? Number(dependentForm.age) : null,
          dietaryLabels: dependentForm.dietaryLabels
            .split(',')
            .map((l) => l.trim())
            .filter((l) => l !== ''),
          isChild: dependentForm.isChild,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDependentError(data.error || 'Failed to add dependent');
        return;
      }

      setDependents([...dependents, data]);
      resetDependentForm();
      router.refresh();
    } catch {
      setDependentError('Something went wrong. Please try again.');
    } finally {
      setDependentSubmitting(false);
    }
  };

  const handleUpdateDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDependentId) return;

    setDependentSubmitting(true);
    setDependentError(null);

    try {
      const response = await fetch('/api/dependents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDependentId,
          name: dependentForm.name,
          relationship: dependentForm.relationship,
          age: dependentForm.age ? Number(dependentForm.age) : null,
          dietaryLabels: dependentForm.dietaryLabels
            .split(',')
            .map((l) => l.trim())
            .filter((l) => l !== ''),
          isChild: dependentForm.isChild,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDependentError(data.error || 'Failed to update dependent');
        return;
      }

      setDependents(dependents.map((d) => (d.id === editingDependentId ? data : d)));
      resetDependentForm();
      router.refresh();
    } catch {
      setDependentError('Something went wrong. Please try again.');
    } finally {
      setDependentSubmitting(false);
    }
  };

  const handleDeleteDependent = async (id: string) => {
    if (!confirm('Are you sure you want to remove this family member?')) return;

    try {
      const response = await fetch(`/api/dependents?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to remove dependent');
        return;
      }

      setDependents(dependents.filter((d) => d.id !== id));
      router.refresh();
    } catch {
      alert('Something went wrong. Please try again.');
    }
  };

  const startEditDependent = (dependent: Dependent) => {
    setDependentForm({
      name: dependent.name,
      relationship: dependent.relationship,
      age: dependent.age !== null ? String(dependent.age) : '',
      dietaryLabels: dependent.dietaryLabels.join(', '),
      isChild: dependent.isChild,
    });
    setEditingDependentId(dependent.id);
    setShowDependentForm(true);
    setDependentError(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Family Members & Dependents</h2>
          <p className="text-muted-foreground mt-1 text-sm">Manage dependents in your household</p>
        </div>
        {!showDependentForm && (
          <button
            onClick={() => setShowDependentForm(true)}
            className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-lg px-3 py-1 text-sm font-medium"
          >
            + Add Member
          </button>
        )}
      </div>

      {dependents.length === 0 && !showDependentForm ? (
        <p className="text-muted-foreground mt-4 text-sm">
          No dependents added yet. Add your spouse, children, or other family members.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {dependents.map((dependent) => (
            <li
              key={dependent.id}
              className="border-border flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-medium text-blue-700">
                  {dependent.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">{dependent.name}</span>
                    <span className="bg-terracotta/15 text-terracotta rounded-full px-2 py-0.5 text-xs capitalize">
                      {RELATIONSHIP_LABELS[dependent.relationship]?.toLowerCase() ||
                        dependent.relationship.toLowerCase()}
                    </span>
                    {dependent.isChild && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        Child
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    {dependent.age !== null && <span>{dependent.age} yrs</span>}
                    {dependent.dietaryLabels.length > 0 && (
                      <span className="text-terracotta">
                        🥗 {dependent.dietaryLabels.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={() => startEditDependent(dependent)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteDependent(dependent.id)}
                  className="text-destructive hover:text-foreground"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showDependentForm && (
        <form
          onSubmit={editingDependentId ? handleUpdateDependent : handleAddDependent}
          className="border-border bg-secondary/60 mt-6 rounded-lg border p-4"
        >
          <h3 className="text-foreground text-lg font-medium">
            {editingDependentId ? 'Edit Family Member' : 'Add Family Member'}
          </h3>

          {dependentError && (
            <div className="bg-destructive/10 text-destructive mt-3 rounded-lg p-3 text-sm">
              {dependentError}
            </div>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-foreground/85 block text-sm font-medium">Name</label>
              <input
                type="text"
                value={dependentForm.name}
                onChange={(e) => setDependentForm({ ...dependentForm, name: e.target.value })}
                required
                placeholder="Full name"
                className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-foreground/85 block text-sm font-medium">Relationship</label>
              <select
                value={dependentForm.relationship}
                onChange={(e) =>
                  setDependentForm({ ...dependentForm, relationship: e.target.value })
                }
                className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              >
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="PARENT">Parent</option>
                <option value="SIBLING">Sibling</option>
                <option value="INLAW">In-Law</option>
                <option value="COUSIN">Cousin</option>
              </select>
            </div>

            <div>
              <label className="text-foreground/85 block text-sm font-medium">Age (optional)</label>
              <input
                type="number"
                value={dependentForm.age}
                onChange={(e) => setDependentForm({ ...dependentForm, age: e.target.value })}
                min="0"
                max="120"
                placeholder="Age in years"
                className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-foreground/85 block text-sm font-medium">
                Dietary Labels (optional)
              </label>
              <input
                type="text"
                value={dependentForm.dietaryLabels}
                onChange={(e) =>
                  setDependentForm({ ...dependentForm, dietaryLabels: e.target.value })
                }
                placeholder="vegetarian, gluten-free, nut-free"
                className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={dependentForm.isChild}
                onChange={(e) => setDependentForm({ ...dependentForm, isChild: e.target.checked })}
                className="border-border text-terracotta focus:ring-foreground/20 h-4 w-4 rounded"
              />
              <span className="text-foreground/85 text-sm">This is a child (under 18)</span>
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={dependentSubmitting}
              className="bg-terracotta hover:bg-terracotta flex-1 rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {dependentSubmitting
                ? 'Saving...'
                : editingDependentId
                  ? 'Save Changes'
                  : 'Add Family Member'}
            </button>
            <button
              type="button"
              onClick={resetDependentForm}
              disabled={dependentSubmitting}
              className="bg-secondary text-foreground/85 hover:bg-secondary flex-1 rounded-lg px-4 py-2 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
