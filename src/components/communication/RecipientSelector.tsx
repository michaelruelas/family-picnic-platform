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
        <label className="text-foreground/85 block text-sm font-medium">Recipient Group</label>
        <select
          value={recipientType}
          onChange={(e) => {
            onRecipientTypeChange(e.target.value as RecipientType);
            onSelectedIdsChange([]);
          }}
          disabled={disabled}
          className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg shadow-sm"
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
            <label htmlFor="search" className="text-foreground/85 block text-sm font-medium">
              Search {recipientType === 'HOUSEHOLD' ? 'Households' : 'Users'}
            </label>
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search by ${recipientType === 'HOUSEHOLD' ? 'household' : 'name or email'}...`}
              disabled={disabled}
              className="border-border focus:border-terracotta focus:ring-foreground/20 mt-1 block w-full rounded-lg shadow-sm"
            />
          </div>

          {recipientType === 'HOUSEHOLD' && (
            <div className="border-border bg-secondary/60 max-h-48 overflow-y-auto rounded-lg border p-3">
              {filteredHouseholds.length === 0 ? (
                <p className="text-muted-foreground text-center">No households found</p>
              ) : (
                <div className="space-y-2">
                  {filteredHouseholds.map((household) => (
                    <label
                      key={household.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${
                        selectedIds.includes(household.id)
                          ? 'border-terracotta bg-sunlight/20'
                          : 'border-border bg-white'
                      }`}
                    >
                      <span className="text-foreground font-medium">{household.name}</span>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(household.id)}
                        onChange={() => handleHouseholdToggle(household.id)}
                        disabled={disabled}
                        className="border-border text-terracotta focus:ring-foreground/20 h-4 w-4 rounded"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {recipientType === 'INDIVIDUAL' && (
            <div className="border-border bg-secondary/60 max-h-48 overflow-y-auto rounded-lg border p-3">
              {filteredUsers.length === 0 ? (
                <p className="text-muted-foreground text-center">No users found</p>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <label
                      key={user.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${
                        selectedIds.includes(user.id)
                          ? 'border-terracotta bg-sunlight/20'
                          : 'border-border bg-white'
                      }`}
                    >
                      <div>
                        <span className="text-foreground font-medium">{user.name}</span>
                        <span className="text-muted-foreground ml-2 text-sm">{user.email}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => handleUserToggle(user.id)}
                        disabled={disabled}
                        className="border-border text-terracotta focus:ring-foreground/20 h-4 w-4 rounded"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedIds.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {selectedIds.length}{' '}
              {recipientType === 'HOUSEHOLD' ? 'household(s)' : 'individual(s)'} selected
            </p>
          )}
        </>
      )}

      {recipientType === 'ALL' && (
        <p className="text-muted-foreground text-sm">
          Message will be sent to all households with registered users.
        </p>
      )}

      {recipientType === 'NOT_RESPONDED' && (
        <p className="text-muted-foreground text-sm">
          Message will be sent to all households who have not responded to the RSVP.
        </p>
      )}
    </div>
  );
}
