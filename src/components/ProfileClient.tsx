'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
}

export default function ProfileClient({ user }: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [communicationPreference, setCommunicationPreference] = useState(
    user.communicationPreference,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  return (
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
  );
}
