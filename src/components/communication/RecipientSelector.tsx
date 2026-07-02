'use client';

import { useState } from 'react';

type RecipientType = 'ALL' | 'HOUSEHOLD' | 'INDIVIDUAL' | 'NOT_RESPONDED';

type Household = {
  id: string;
  name: string;
};

type User = {
  id: string;
  name: string;
  email: string;
};

type RecipientSelectorProps = {
  recipientType: RecipientType;
  selectedIds: string[];
  onRecipientTypeChange: (type: RecipientType) => void;
  onSelectedIdsChange: (ids: string[]) => void;
  households: Household[];
  users: User[];
  disabled?: boolean;
};

export default function RecipientSelector({
  recipientType,
  selectedIds,
  onRecipientTypeChange,
  onSelectedIdsChange,
  households,
  users,
  disabled = false,
}: RecipientSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHouseholds = households.filter((h) =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleHouseholdToggle = (householdId: string) => {
    if (selectedIds.includes(householdId)) {
      onSelectedIdsChange(selectedIds.filter((id) => id !== householdId));
    } else {
      onSelectedIdsChange([...selectedIds, householdId]);
    }
  };

  const handleUserToggle = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onSelectedIdsChange(selectedIds.filter((id) => id !== userId));
    } else {
      onSelectedIdsChange([...selectedIds, userId]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-stone-700">Recipient Group</label>
        <select
          value={recipientType}
          onChange={(e) => {
            onRecipientTypeChange(e.target.value as RecipientType);
            onSelectedIdsChange([]);
          }}
          disabled={disabled}
          className="mt-1 block w-full rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
        >
          <option value="ALL">All Households</option>
          <option value="NOT_RESPONDED">Not Responded (RSVP pending)</option>
          <option value="HOUSEHOLD">Specific Households</option>
          <option value="INDIVIDUAL">Specific Individuals</option>
        </select>
      </div>

      {(recipientType === 'HOUSEHOLD' || recipientType === 'INDIVIDUAL') && (
        <>
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-stone-700">
              Search {recipientType === 'HOUSEHOLD' ? 'Households' : 'Users'}
            </label>
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search by ${recipientType === 'HOUSEHOLD' ? 'household' : 'name or email'}...`}
              disabled={disabled}
              className="mt-1 block w-full rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500"
            />
          </div>

          {recipientType === 'HOUSEHOLD' && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50 p-3">
              {filteredHouseholds.length === 0 ? (
                <p className="text-center text-stone-500">No households found</p>
              ) : (
                <div className="space-y-2">
                  {filteredHouseholds.map((household) => (
                    <label
                      key={household.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${
                        selectedIds.includes(household.id)
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-stone-200 bg-white'
                      }`}
                    >
                      <span className="font-medium text-stone-900">{household.name}</span>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(household.id)}
                        onChange={() => handleHouseholdToggle(household.id)}
                        disabled={disabled}
                        className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {recipientType === 'INDIVIDUAL' && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50 p-3">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-stone-500">No users found</p>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <label
                      key={user.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${
                        selectedIds.includes(user.id)
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-stone-200 bg-white'
                      }`}
                    >
                      <div>
                        <span className="font-medium text-stone-900">{user.name}</span>
                        <span className="ml-2 text-sm text-stone-500">{user.email}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => handleUserToggle(user.id)}
                        disabled={disabled}
                        className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedIds.length > 0 && (
            <p className="text-sm text-stone-600">
              {selectedIds.length}{' '}
              {recipientType === 'HOUSEHOLD' ? 'household(s)' : 'individual(s)'} selected
            </p>
          )}
        </>
      )}

      {recipientType === 'ALL' && (
        <p className="text-sm text-stone-600">
          Message will be sent to all households with registered users.
        </p>
      )}

      {recipientType === 'NOT_RESPONDED' && (
        <p className="text-sm text-stone-600">
          Message will be sent to all households who have not responded to the RSVP.
        </p>
      )}
    </div>
  );
}
