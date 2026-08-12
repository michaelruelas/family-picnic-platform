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

type AdminRole = 'OWNER' | 'COADMIN' | 'INVITER';

/**
 * FPP-65 / QUB-13.2: host assignment UI for super admins.
 *
 * The page is divided in two:
 *
 *   1. "Hosts" — admins with role OWNER. This is the FPP-65 deliverable:
 *      a multi-select that lets a super-admin add one or more hosts at
 *      once, each of whom is recorded as `EventAdmin.role = OWNER` AND
 *      gets `User.role = HOST` stamped on them server-side. A real
 *      email notification is intentionally NOT sent; the server logs a
 *      structured payload (`template: 'host-assigned'`) so the future
 *      SendGrid integration has the exact shape.
 *
 *   2. "Other admins" — COADMIN and INVITER rows. These keep the legacy
 *      single-add-by-email picker because they are scoped to
 *      housekeeping duties (manage the guest list, send invites) and
 *      do not need the host ceremony.
 *
 * Removing an admin always returns a delete modal regardless of role.
 * The current user cannot remove themselves; the UI hides the button.
 */
export default function EventAdminsClient({
  eventId,
  eventName,
  initialAdmins,
  currentUserId,
}: Props) {
  const [admins, setAdmins] = useState<EventAdmin[]>(initialAdmins);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('COADMIN');
  const [searchResult, setSearchResult] = useState<AdminUser | null>(null);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [removeModal, setRemoveModal] = useState<EventAdmin | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // FPP-65 multi-host state. `hostQuery` drives the fuzzy substring
  // search (re-uses the `?q=` branch of /api/admin/users/search).
  // `selectedHosts` is the running list the super-admin is building
  // before clicking "Add N hosts" — each chip can be removed before
  // submit. `hostResults` is the live dropdown results from the
  // search box.
  const [hostQuery, setHostQuery] = useState('');
  const [hostResults, setHostResults] = useState<AdminUser[]>([]);
  const [selectedHosts, setSelectedHosts] = useState<AdminUser[]>([]);
  const [isHostSearching, setIsHostSearching] = useState(false);
  const [hostSearchError, setHostSearchError] = useState('');
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [bulkAddSummary, setBulkAddSummary] = useState<string | null>(null);

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
        const data = await res.json();
        // The new endpoint may return either a single row (legacy) or
        // `{ assigned, skipped }` (bulk). Normalize both shapes.
        const newAdmin = Array.isArray(data) ? data[0] : (data.assigned?.[0] ?? data);
        if (newAdmin) {
          setAdmins([...admins, newAdmin]);
        }
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
  const hosts = admins.filter((a) => a.role === 'OWNER');
  const others = admins.filter((a) => a.role !== 'OWNER');

  // FPP-65 host search: substring match on name + email. Re-uses the
  // `?q=` branch of /api/admin/users/search which already supports
  // fuzzy matches and returns up to 8 rows. We re-query on every
  // keystroke; the route is indexed and the result set is tiny.
  const searchHosts = async (query: string) => {
    setHostQuery(query);
    setHostSearchError('');
    if (query.trim().length < 2) {
      setHostResults([]);
      return;
    }
    setIsHostSearching(true);
    try {
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.users)) {
        setHostResults(data.users);
      } else {
        setHostResults([]);
        setHostSearchError(data.error || 'Search failed');
      }
    } catch {
      setHostSearchError('Failed to search for users');
    } finally {
      setIsHostSearching(false);
    }
  };

  const addHostToSelection = (user: AdminUser) => {
    if (selectedHosts.some((u) => u.id === user.id)) return;
    if (admins.some((a) => a.userId === user.id)) return;
    setSelectedHosts([...selectedHosts, user]);
  };

  const removeHostFromSelection = (userId: string) => {
    setSelectedHosts(selectedHosts.filter((u) => u.id !== userId));
  };

  const bulkAddHosts = async () => {
    if (selectedHosts.length === 0) return;
    setIsBulkAdding(true);
    setBulkAddSummary(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedHosts.map((u) => u.id),
          role: 'OWNER',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const assigned = (data.assigned ?? []) as EventAdmin[];
        setAdmins([...admins, ...assigned]);
        setSelectedHosts([]);
        setHostQuery('');
        setHostResults([]);
        const assignedCount = assigned.length;
        const skippedCount = (data.skipped ?? []).length;
        setBulkAddSummary(
          skippedCount > 0
            ? `Added ${assignedCount} host${assignedCount === 1 ? '' : 's'} (${skippedCount} skipped — already an admin).`
            : `Added ${assignedCount} host${assignedCount === 1 ? '' : 's'}.`,
        );
      }
    } finally {
      setIsBulkAdding(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-foreground text-2xl font-bold">Event Admins</h2>
        <p className="text-muted-foreground mt-2">Manage who can administer {eventName}</p>
      </div>

      {/* FPP-65: hosts surface — multi-select. Renders first because
          hosts are the user-facing concept ("Who is running this
          picnic?"). The legacy "Other admins" section sits below
          for housekeeping duties (inviters, co-admins). */}
      <Card>
        <CardHeader>
          <CardTitle>Hosts</CardTitle>
        </CardHeader>
        <CardContent>
          {hosts.length === 0 ? (
            <p className="text-muted-foreground">
              No hosts assigned yet. Hosts are the people running this event — their names and
              contact info show on the public event page.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {hosts.map((host) => (
                <li key={host.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-foreground font-medium">
                      {host.user.name}
                      {isCurrentUser(host) && (
                        <span className="text-muted-foreground ml-2 text-sm">(you)</span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-sm">{host.user.email}</p>
                    {host.user.household && (
                      <p className="text-muted-foreground/70 text-sm">{host.user.household.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-terracotta/15 text-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                      Host
                    </span>
                    {!isCurrentUser(host) && (
                      <Button variant="secondary" size="sm" onClick={() => setRemoveModal(host)}>
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
          <CardTitle>Add Hosts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Search by name or email. Pick one or more people and add them as hosts at once.
          </p>

          <div className="relative">
            <Input
              type="text"
              placeholder="Search by name or email"
              value={hostQuery}
              onChange={(e) => searchHosts(e.target.value)}
              className="flex-1"
              data-testid="host-search-input"
            />
            {isHostSearching && <p className="text-muted-foreground mt-1 text-xs">Searching...</p>}
            {hostSearchError && <p className="text-destructive mt-1 text-sm">{hostSearchError}</p>}

            {hostResults.length > 0 && (
              <ul
                className="border-border bg-card absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border shadow-lg"
                data-testid="host-search-results"
              >
                {hostResults.map((user) => {
                  const alreadyAdmin = admins.some((a) => a.userId === user.id);
                  const alreadySelected = selectedHosts.some((u) => u.id === user.id);
                  return (
                    <li
                      key={user.id}
                      className="border-border flex items-center justify-between border-b px-4 py-2 last:border-b-0"
                    >
                      <div>
                        <p className="text-foreground text-sm font-medium">{user.name}</p>
                        <p className="text-muted-foreground text-xs">{user.email}</p>
                      </div>
                      {alreadyAdmin ? (
                        <span className="text-muted-foreground text-xs">already an admin</span>
                      ) : alreadySelected ? (
                        <span className="text-muted-foreground text-xs">selected</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => addHostToSelection(user)}
                          data-testid={`host-add-${user.id}`}
                        >
                          Add
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectedHosts.length > 0 && (
            <div className="space-y-3" data-testid="host-selection">
              <p className="text-foreground text-sm font-medium">
                Selected ({selectedHosts.length}):
              </p>
              <ul className="flex flex-wrap gap-2">
                {selectedHosts.map((user) => (
                  <li
                    key={user.id}
                    className="bg-terracotta/15 text-foreground rounded-pill flex items-center gap-2 px-3 py-1 text-sm"
                  >
                    <span>{user.name}</span>
                    <button
                      type="button"
                      onClick={() => removeHostFromSelection(user.id)}
                      aria-label={`Remove ${user.name}`}
                      className="text-foreground/70 hover:text-foreground"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <Button onClick={bulkAddHosts} disabled={isBulkAdding} data-testid="host-bulk-add">
                {isBulkAdding
                  ? 'Adding...'
                  : `Add ${selectedHosts.length} host${selectedHosts.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          )}

          {bulkAddSummary && (
            <p className="text-sage text-sm" data-testid="host-bulk-summary">
              {bulkAddSummary}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Legacy single-add picker for COADMIN / INVITER rows. */}
      <Card>
        <CardHeader>
          <CardTitle>Other Admins</CardTitle>
        </CardHeader>
        <CardContent>
          {others.length === 0 ? (
            <p className="text-muted-foreground">No co-admins or inviters assigned.</p>
          ) : (
            <ul className="divide-border divide-y">
              {others.map((admin) => (
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
                    <span className="bg-secondary text-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
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
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="w-40"
              options={[
                { value: 'COADMIN', label: 'Co-Admin' },
                { value: 'INVITER', label: 'Inviter' },
                { value: 'OWNER', label: 'Host' },
              ]}
            >
              <option value="COADMIN">Co-Admin</option>
              <option value="INVITER">Inviter</option>
              <option value="OWNER">Host</option>
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
          Are you sure you want to remove <strong>{removeModal?.user.name}</strong> from this event?
          They will lose access immediately.
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
