'use client';

import { useState } from 'react';
import { useUserProfileMutation, useDependentMutations, useHouseholdNameMutation } from '~/hooks';
import { Relationship, CommunicationPreference } from '~/lib/generated/enums';

interface Dependent {
  id: string;
  name: string;
  relationship: Relationship;
  age: number | null;
  dietaryLabels: string[];
  isChild: boolean;
}

interface ProfileFormProps {
  user: {
    id: string;
    name: string;
    email: string;
    communicationPreference: CommunicationPreference;
    household?: {
      id: string;
      name: string;
    } | null;
  };
  initialDependents?: Dependent[];
}

const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  SPOUSE: 'Spouse',
  CHILD: 'Child',
  PARENT: 'Parent',
  SIBLING: 'Sibling',
  INLAW: 'In-Law',
  COUSIN: 'Cousin',
};

export default function ProfileClient({ user, initialDependents = [] }: ProfileFormProps) {
  const { updatePreferences } = useUserProfileMutation();
  const { create, update, remove } = useDependentMutations();
  const { updateName } = useHouseholdNameMutation();
  const [name, setName] = useState(user.name);
  const [communicationPreference, setCommunicationPreference] = useState(
    user.communicationPreference,
  );
  const [householdName, setHouseholdName] = useState(user.household?.name ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [householdSuccess, setHouseholdSuccess] = useState(false);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [isSavingHousehold, setIsSavingHousehold] = useState(false);
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
      await updatePreferences.mutateAsync({
        name,
        communicationPreference: communicationPreference as 'EMAIL' | 'SMS' | 'BOTH' | 'NONE',
      });
      setSuccess(true);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setName(user.name);
    setCommunicationPreference(user.communicationPreference);
    setHouseholdName(user.household?.name ?? '');
    setIsEditing(false);
    setError(null);
    setSuccess(false);
    setHouseholdError(null);
    setHouseholdSuccess(false);
  };

  const handleSaveHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.household) return;
    const trimmed = householdName.trim();
    if (!trimmed) {
      setHouseholdError('Household name is required');
      return;
    }
    if (trimmed === user.household.name) {
      setHouseholdError(null);
      setHouseholdSuccess(false);
      return;
    }

    setIsSavingHousehold(true);
    setHouseholdError(null);
    setHouseholdSuccess(false);

    try {
      await updateName.mutateAsync({ id: user.household.id, name: trimmed });
      setHouseholdSuccess(true);
      setHouseholdName(trimmed);
    } catch (err) {
      setHouseholdError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSavingHousehold(false);
    }
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
      const newDependent = await create.mutateAsync({
        name: dependentForm.name,
        relationship: dependentForm.relationship as
          'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'INLAW' | 'COUSIN',
        age: dependentForm.age ? Number(dependentForm.age) : undefined,
        dietaryLabels: dependentForm.dietaryLabels
          .split(',')
          .map((l) => l.trim())
          .filter((l) => l !== ''),
        isChild: dependentForm.isChild,
      });
      setDependents([...dependents, newDependent]);
      resetDependentForm();
    } catch (err) {
      setDependentError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
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
      const updatedDependent = await update.mutateAsync({
        id: editingDependentId,
        name: dependentForm.name,
        relationship: dependentForm.relationship as
          'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'INLAW' | 'COUSIN',
        age: dependentForm.age ? Number(dependentForm.age) : null,
        dietaryLabels: dependentForm.dietaryLabels
          .split(',')
          .map((l) => l.trim())
          .filter((l) => l !== ''),
        isChild: dependentForm.isChild,
      });
      setDependents(dependents.map((d) => (d.id === editingDependentId ? updatedDependent : d)));
      resetDependentForm();
    } catch (err) {
      setDependentError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setDependentSubmitting(false);
    }
  };

  const handleDeleteDependent = async (id: string) => {
    if (!confirm('Are you sure you want to remove this family member?')) return;

    try {
      await remove.mutateAsync({ id });
      setDependents(dependents.filter((d) => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
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
      <div className="bg-card ring-border rounded-sm p-6 shadow-sm ring-1">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-xl font-semibold">Profile Settings</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-sm px-3 py-1 text-sm font-medium"
            >
              Edit
            </button>
          )}
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive mt-4 rounded-sm p-3 text-sm">
            {error}
          </div>
        )}

        {success && !isEditing && (
          <div className="bg-sage/15 text-sage mt-4 rounded-sm p-3 text-sm">
            Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div>
            <label className="text-foreground/85 block text-sm font-medium">Display Name</label>
            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              />
            ) : (
              <p className="text-foreground mt-1">{user.name}</p>
            )}
          </div>

          <div>
            <label className="text-foreground/85 block text-sm font-medium">Email</label>
            <p className="text-muted-foreground mt-1">{user.email}</p>
            <p className="text-muted-foreground/70 mt-1 text-xs">Email cannot be changed</p>
          </div>

          <div>
            <label className="text-foreground/85 block text-sm font-medium">Household</label>
            {user.household ? (
              <form onSubmit={handleSaveHousehold} className="mt-1 space-y-2">
                <input
                  type="text"
                  value={householdName}
                  onChange={(e) => {
                    setHouseholdName(e.target.value);
                    setHouseholdSuccess(false);
                  }}
                  maxLength={80}
                  required
                  aria-label="Household name"
                  className="border-border focus:border-terracotta focus:ring-foreground/20 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={
                      isSavingHousehold ||
                      householdName.trim() === '' ||
                      householdName.trim() === user.household.name
                    }
                    className="bg-terracotta hover:bg-terracotta rounded-sm px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {isSavingHousehold ? 'Saving...' : 'Save'}
                  </button>
                  <p className="text-muted-foreground/70 text-xs">{householdName.length}/80</p>
                </div>
                {householdError && <p className="text-destructive text-xs">{householdError}</p>}
                {householdSuccess && <p className="text-sage text-xs">Household name updated</p>}
              </form>
            ) : (
              <p className="text-muted-foreground mt-1">Not assigned to a household</p>
            )}
            <p className="text-muted-foreground/70 mt-1 text-xs">
              Must be unique across the platform (case-insensitive)
            </p>
          </div>

          <div>
            <label className="text-foreground/85 block text-sm font-medium">
              Communication Preference
            </label>
            {isEditing ? (
              <select
                value={communicationPreference}
                onChange={(e) =>
                  setCommunicationPreference(e.target.value as CommunicationPreference)
                }
                className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
              >
                <option value="EMAIL">Email only</option>
                <option value="SMS">SMS only</option>
                <option value="BOTH">Both email and SMS</option>
                <option value="NONE">No notifications</option>
              </select>
            ) : (
              <p className="text-foreground mt-1">
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
                className="bg-terracotta hover:bg-terracotta flex-1 rounded-sm px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="bg-secondary text-foreground/85 hover:bg-secondary flex-1 rounded-sm px-4 py-2 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>

      <div className="bg-card ring-border rounded-sm p-6 shadow-sm ring-1">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-xl font-semibold">Family Members</h2>
          {!showDependentForm && (
            <button
              onClick={() => setShowDependentForm(true)}
              className="bg-terracotta/15 text-terracotta hover:bg-terracotta/20 rounded-sm px-3 py-1 text-sm font-medium"
            >
              + Add
            </button>
          )}
        </div>

        {dependents.length === 0 && !showDependentForm ? (
          <p className="text-muted-foreground mt-4 text-sm">
            No family members added yet. Add your spouse, children, or other family members to help
            us plan for everyone.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {dependents.map((dependent) => (
              <li key={dependent.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-foreground/85">{dependent.name}</span>
                  <span className="bg-terracotta/15 text-terracotta rounded-sm px-2 py-0.5 text-xs capitalize">
                    {RELATIONSHIP_LABELS[dependent.relationship]?.toLowerCase() ||
                      dependent.relationship.toLowerCase()}
                  </span>
                  {dependent.isChild && (
                    <span className="bg-info/15 text-info rounded-sm px-2 py-0.5 text-xs">
                      Child
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground flex items-center gap-3 text-sm">
                  {dependent.age !== null && <span>{dependent.age} yrs</span>}
                  {dependent.dietaryLabels.length > 0 && (
                    <span className="text-terracotta">🥗 {dependent.dietaryLabels.join(', ')}</span>
                  )}
                  <button
                    onClick={() => startEditDependent(dependent)}
                    className="text-primary hover:text-primary-hover font-medium"
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
            className="border-border bg-secondary/60 mt-6 rounded-sm border p-4"
          >
            <h3 className="text-foreground text-lg font-medium">
              {editingDependentId ? 'Edit Family Member' : 'Add Family Member'}
            </h3>

            {dependentError && (
              <div className="bg-destructive/10 text-destructive mt-3 rounded-sm p-3 text-sm">
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
                  className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-foreground/85 block text-sm font-medium">Relationship</label>
                <select
                  value={dependentForm.relationship}
                  onChange={(e) =>
                    setDependentForm({ ...dependentForm, relationship: e.target.value })
                  }
                  className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
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
                <label className="text-foreground/85 block text-sm font-medium">
                  Age (optional)
                </label>
                <input
                  type="number"
                  value={dependentForm.age}
                  onChange={(e) => setDependentForm({ ...dependentForm, age: e.target.value })}
                  min="0"
                  max="120"
                  placeholder="Age in years"
                  className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
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
                  className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-sm border px-3 py-2 shadow-sm focus:ring-1 focus:outline-none"
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
                  className="border-border text-terracotta focus:ring-foreground/20 h-4 w-4 rounded"
                />
                <span className="text-foreground/85 text-sm">This is a child (under 18)</span>
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={dependentSubmitting}
                className="bg-terracotta hover:bg-terracotta flex-1 rounded-sm px-4 py-2 font-medium text-white disabled:opacity-50"
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
                className="bg-secondary text-foreground/85 hover:bg-secondary flex-1 rounded-sm px-4 py-2 font-medium disabled:opacity-50"
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
