'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfileMutation, useHouseholdNameMutation } from '~/hooks';
import { CommunicationPreference } from '~/lib/generated/enums';

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
}

export default function ProfileClient({ user }: ProfileFormProps) {
  const router = useRouter();
  const { updatePreferences } = useUserProfileMutation();
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

  // FPP-117: invoked from a button click rather than a form submit.
  // The previous version wrapped this in a nested <form> inside the
  // outer profile-edit form, which is invalid HTML — browsers may
  // dispatch the Save click to the outer form's submit handler (which
  // only calls updatePreferences) and the rename silently does
  // nothing. Wired to a <div> + button.onClick instead.
  const handleSaveHousehold = async () => {
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
      // FPP-117: re-fetch the server-component prop so `user.household.name`
      // (which gates the Save button's disabled state) reflects the new
      // value. Without this the button stays disabled after the first
      // successful rename.
      router.refresh();
    } catch (err) {
      setHouseholdError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSavingHousehold(false);
    }
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
              // FPP-117: not a <form>. Nested forms are invalid HTML
              // and the outer profile-edit form swallowed this Save
              // click on some browsers. The Save button is now an
              // explicit onClick handler below.
              <div className="mt-1 space-y-2">
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
                    type="button"
                    onClick={handleSaveHousehold}
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
              </div>
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
    </div>
  );
}
