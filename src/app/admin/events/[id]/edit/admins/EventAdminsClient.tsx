'use client';

import { useState } from 'react';
import { Button } from '~/components/ui';
import { Input } from '~/components/ui';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui';
import { Select } from '~/components/ui';
import { Modal } from '~/components/ui';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  household: { name: string } | null;
};

type EventAdmin = {
  id: string;
  userId: string;
  role: string;
  user: AdminUser;
};

type Props = {
  eventId: string;
  eventName: string;
  initialAdmins: EventAdmin[];
  currentUserId: string;
};

export default function EventAdminsClient({
  eventId,
  eventName,
  initialAdmins,
  currentUserId,
}: Props) {
  const [admins, setAdmins] = useState<EventAdmin[]>(initialAdmins);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'OWNER' | 'COADMIN' | 'INVITER'>('COADMIN');
  const [searchResult, setSearchResult] = useState<AdminUser | null>(null);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [removeModal, setRemoveModal] = useState<EventAdmin | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const searchUser = async () => {
    if (!email) return;
    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const res = await fetch(`/api/admin/users/search?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (res.ok && data) {
        setSearchResult(data);
      } else {
        setSearchError(data.error || 'User not found');
      }
    } catch {
      setSearchError('Failed to search for user');
    } finally {
      setIsSearching(false);
    }
  };

  const addAdmin = async () => {
    if (!searchResult) return;
    setIsAdding(true);

    try {
      const res = await fetch(`/api/admin/events/${eventId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: searchResult.id, role }),
      });

      if (res.ok) {
        const newAdmin = await res.json();
        setAdmins([...admins, newAdmin]);
        setEmail('');
        setSearchResult(null);
        setRole('COADMIN');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const removeAdmin = async () => {
    if (!removeModal) return;
    setIsRemoving(true);

    try {
      const res = await fetch(`/api/admin/events/${eventId}/admins/${removeModal.userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setAdmins(admins.filter((a) => a.userId !== removeModal.userId));
        setRemoveModal(null);
      }
    } finally {
      setIsRemoving(false);
    }
  };

  const isCurrentUser = (admin: EventAdmin) => admin.userId === currentUserId;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-foreground text-2xl font-bold">Event Admins</h2>
        <p className="text-muted-foreground mt-2">Manage who can administer {eventName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Admins</CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-muted-foreground">No admins assigned yet.</p>
          ) : (
            <ul className="divide-y divide-stone-200">
              {admins.map((admin) => (
                <li key={admin.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-foreground font-medium">
                      {admin.user.name}
                      {isCurrentUser(admin) && (
                        <span className="text-muted-foreground ml-2 text-sm">(you)</span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-sm">{admin.user.email}</p>
                    {admin.user.household && (
                      <p className="text-muted-foreground/70 text-sm">
                        {admin.user.household.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-terracotta/15 text-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                      {admin.role}
                    </span>
                    {!isCurrentUser(admin) && (
                      <Button variant="secondary" size="sm" onClick={() => setRemoveModal(admin)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              type="email"
              placeholder="User email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as 'OWNER' | 'COADMIN' | 'INVITER')}
              className="w-40"
              options={[
                { value: 'COADMIN', label: 'Co-Admin' },
                { value: 'INVITER', label: 'Inviter' },
                { value: 'OWNER', label: 'Owner' },
              ]}
            >
              <option value="COADMIN">Co-Admin</option>
              <option value="INVITER">Inviter</option>
              <option value="OWNER">Owner</option>
            </Select>
            <Button onClick={searchUser} disabled={isSearching || !email}>
              {isSearching ? 'Searching...' : 'Find User'}
            </Button>
          </div>

          {searchError && <p className="text-destructive text-sm">{searchError}</p>}

          {searchResult && (
            <div className="border-border bg-secondary/60 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground font-medium">{searchResult.name}</p>
                  <p className="text-muted-foreground text-sm">{searchResult.email}</p>
                  {searchResult.household && (
                    <p className="text-muted-foreground/70 text-sm">
                      {searchResult.household.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-terracotta/15 text-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {role}
                  </span>
                  <Button
                    onClick={addAdmin}
                    disabled={isAdding || admins.some((a) => a.userId === searchResult.id)}
                  >
                    {isAdding ? 'Adding...' : 'Add as Admin'}
                  </Button>
                </div>
              </div>
              {admins.some((a) => a.userId === searchResult.id) && (
                <p className="text-terracotta mt-2 text-sm">This user is already an admin.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={!!removeModal} onClose={() => setRemoveModal(null)} title="Remove Admin">
        <p className="text-muted-foreground">
          Are you sure you want to remove <strong>{removeModal?.user.name}</strong> as an admin from
          this event? They will lose access immediately.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setRemoveModal(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={removeAdmin} disabled={isRemoving}>
            {isRemoving ? 'Removing...' : 'Remove Admin'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
