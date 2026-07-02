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

interface ProfileFormProps {
  user: {
    id: string;
    name: string;
    email: string;
    communicationPreference: string;
    household?: {
      id: string;
      name: string;
    } | null;
  };
  initialDependents?: Dependent[];
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  SPOUSE: 'Spouse',
  CHILD: 'Child',
  PARENT: 'Parent',
  SIBLING: 'Sibling',
  INLAW: 'In-Law',
  COUSIN: 'Cousin',
};

export default function ProfileClient({ user, initialDependents = [] }: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [communicationPreference, setCommunicationPreference] = useState(
    user.communicationPreference,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          communicationPreference,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update profile');
        return;
      }

      setSuccess(true);
      setIsEditing(false);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setName(user.name);
    setCommunicationPreference(user.communicationPreference);
    setIsEditing(false);
    setError(null);
    setSuccess(false);
  };

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
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-stone-900">Profile Settings</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-200"
            >
              Edit
            </button>
          )}
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {success && !isEditing && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700">Display Name</label>
            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              />
            ) : (
              <p className="mt-1 text-stone-900">{user.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">Email</label>
            <p className="mt-1 text-stone-500">{user.email}</p>
            <p className="mt-1 text-xs text-stone-400">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">Household</label>
            {user.household ? (
              <p className="mt-1 text-stone-900">{user.household.name}</p>
            ) : (
              <p className="mt-1 text-stone-500">Not assigned to a household</p>
            )}
            <p className="mt-1 text-xs text-stone-400">Contact an admin to change household</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700">
              Communication Preference
            </label>
            {isEditing ? (
              <select
                value={communicationPreference}
                onChange={(e) => setCommunicationPreference(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              >
                <option value="EMAIL">Email only</option>
                <option value="SMS">SMS only</option>
                <option value="BOTH">Both email and SMS</option>
                <option value="NONE">No notifications</option>
              </select>
            ) : (
              <p className="mt-1 text-stone-900">
                {communicationPreference === 'EMAIL' && 'Email only'}
                {communicationPreference === 'SMS' && 'SMS only'}
                {communicationPreference === 'BOTH' && 'Email and SMS'}
                {communicationPreference === 'NONE' && 'No notifications'}
              </p>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-stone-200 px-4 py-2 font-medium text-stone-700 hover:bg-stone-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-stone-900">Family Members</h2>
          {!showDependentForm && (
            <button
              onClick={() => setShowDependentForm(true)}
              className="rounded-lg bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 hover:bg-amber-200"
            >
              + Add
            </button>
          )}
        </div>

        {dependents.length === 0 && !showDependentForm ? (
          <p className="mt-4 text-sm text-stone-500">
            No family members added yet. Add your spouse, children, or other family members to help
            us plan for everyone.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {dependents.map((dependent) => (
              <li key={dependent.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-stone-700">{dependent.name}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 capitalize">
                    {RELATIONSHIP_LABELS[dependent.relationship]?.toLowerCase() ||
                      dependent.relationship.toLowerCase()}
                  </span>
                  {dependent.isChild && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      Child
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-stone-500">
                  {dependent.age !== null && <span>{dependent.age} yrs</span>}
                  {dependent.dietaryLabels.length > 0 && (
                    <span className="text-amber-600">🥗 {dependent.dietaryLabels.join(', ')}</span>
                  )}
                  <button
                    onClick={() => startEditDependent(dependent)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteDependent(dependent.id)}
                    className="text-red-600 hover:text-red-800"
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
            className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4"
          >
            <h3 className="text-lg font-medium text-stone-900">
              {editingDependentId ? 'Edit Family Member' : 'Add Family Member'}
            </h3>

            {dependentError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {dependentError}
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-stone-700">Name</label>
                <input
                  type="text"
                  value={dependentForm.name}
                  onChange={(e) => setDependentForm({ ...dependentForm, name: e.target.value })}
                  required
                  placeholder="Full name"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700">Relationship</label>
                <select
                  value={dependentForm.relationship}
                  onChange={(e) =>
                    setDependentForm({ ...dependentForm, relationship: e.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
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
                <label className="block text-sm font-medium text-stone-700">Age (optional)</label>
                <input
                  type="number"
                  value={dependentForm.age}
                  onChange={(e) => setDependentForm({ ...dependentForm, age: e.target.value })}
                  min="0"
                  max="120"
                  placeholder="Age in years"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700">
                  Dietary Labels (optional)
                </label>
                <input
                  type="text"
                  value={dependentForm.dietaryLabels}
                  onChange={(e) =>
                    setDependentForm({ ...dependentForm, dietaryLabels: e.target.value })
                  }
                  placeholder="vegetarian, gluten-free, nut-free"
                  className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dependentForm.isChild}
                  onChange={(e) =>
                    setDependentForm({ ...dependentForm, isChild: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm text-stone-700">This is a child (under 18)</span>
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={dependentSubmitting}
                className="flex-1 rounded-lg bg-amber-700 px-4 py-2 font-medium text-white hover:bg-amber-800 disabled:opacity-50"
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
                className="flex-1 rounded-lg bg-stone-200 px-4 py-2 font-medium text-stone-700 hover:bg-stone-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
