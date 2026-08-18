'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '~/lib/trpc-client';
import { formatDate } from '~/lib/format-date';
import { useToast } from '~/components/ui/Toast';
import Modal from '~/components/ui/Modal';

interface HouseholdDetailPageProps {
  householdId: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-border mt-10 border-t pt-8 first:mt-0 first:border-t-0 first:pt-0">
      <h2 className="text-foreground mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 py-2">
      <span className="text-muted-foreground w-40 shrink-0 text-sm font-medium">{label}</span>
      <span className="text-foreground text-sm">{value}</span>
    </div>
  );
}

export default function HouseholdDetailPage({ householdId }: HouseholdDetailPageProps) {
  const toast = useToast();
  const { data: household, refetch } = trpc.admin.getHouseholdDetail.useQuery({ householdId });
  const { data: users } = trpc.admin.listUsers.useQuery();

  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  const [showAddMember, setShowAddMember] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberAge, setMemberAge] = useState('');
  const [memberRelationship, setMemberRelationship] = useState('');

  const [showLinkUser, setShowLinkUser] = useState(false);
  const [linkUserId, setLinkUserId] = useState('');

  const updateName = trpc.admin.updateHouseholdName.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'Household renamed');
      setEditingName(false);
      void refetch();
    },
    onError: (err) => toast.addToast('error', err.message),
  });

  const addMember = trpc.admin.addHouseholdMember.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'Member added');
      setShowAddMember(false);
      setMemberName('');
      setMemberAge('');
      setMemberRelationship('');
      void refetch();
    },
    onError: (err) => toast.addToast('error', err.message),
  });

  const removeMember = trpc.admin.removeHouseholdMember.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'Member removed');
      void refetch();
    },
    onError: (err) => toast.addToast('error', err.message),
  });

  const linkUser = trpc.admin.linkUserToHousehold.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'User linked');
      setShowLinkUser(false);
      setLinkUserId('');
      void refetch();
    },
    onError: (err) => toast.addToast('error', err.message),
  });

  const unlinkUser = trpc.admin.unlinkUserFromHousehold.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'User removed from household');
      void refetch();
    },
    onError: (err) => toast.addToast('error', err.message),
  });

  const unlinkedUsers = users?.filter(
    (u) => !household?.users.some((hu) => hu.id === u.id),
  );

  if (!household) {
    return <div className="text-muted-foreground py-12 text-center">Loading…</div>;
  }

  return (
    <div className="max-w-3xl">
      {/* Details Section */}
      <Section title="Details">
        <div className="bg-card border-border rounded-sm border p-5">
          {editingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editName.trim()) {
                  updateName.mutate({ householdId, name: editName.trim() });
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                defaultValue={household.name}
                onChange={(e) => setEditName(e.target.value)}
                className="border-border w-full rounded-sm border px-3 py-1.5 text-sm"
                required
                autoFocus
              />
              <button
                type="submit"
                disabled={updateName.isPending}
                className="bg-terracotta rounded-sm px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <InfoRow label="Name" value={household.name} />
              <InfoRow label="Created" value={formatDate(household.createdAt)} />
              <InfoRow label="Updated" value={formatDate(household.updatedAt)} />
              {household.deletedAt ? (
                <InfoRow
                  label="Deleted"
                  value={<span className="text-destructive">{formatDate(household.deletedAt)}</span>}
                />
              ) : null}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditName(household.name);
                    setEditingName(true);
                  }}
                  className="bg-terracotta hover:bg-terracotta/90 rounded-sm px-4 py-2 text-sm font-medium text-white"
                >
                  Rename
                </button>
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Users Section */}
      <Section title="Users">
        <div className="bg-card border-border rounded-sm border p-5">
          {household.users.length === 0 ? (
            <p className="text-muted-foreground text-sm">No users in this household.</p>
          ) : (
            <div className="divide-border divide-y text-sm">
              {household.users.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-terracotta hover:text-terracotta/80 font-medium"
                    >
                      {u.name}
                    </Link>
                    <span className="text-muted-foreground text-xs">{u.email}</span>
                    <span className="bg-terracotta/10 text-terracotta rounded-sm px-1.5 py-0.5 text-xs">
                      {u.role}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => unlinkUser.mutate({ userId: u.id })}
                    disabled={unlinkUser.isPending}
                    className="text-destructive hover:bg-destructive/10 rounded-sm px-2 py-1 text-xs font-medium disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setLinkUserId('');
              setShowLinkUser(true);
            }}
            className="text-terracotta hover:bg-terracotta/10 mt-3 rounded-sm px-2 py-1 text-xs font-medium"
          >
            + Link user
          </button>
        </div>
      </Section>

      {/* Roster Members Section */}
      <Section title="Roster members">
        <div className="bg-card border-border rounded-sm border p-5">
          {household.members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No roster members.</p>
          ) : (
            <div className="divide-border divide-y text-sm">
              {household.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-foreground font-medium">{m.name}</span>
                    <span className="text-muted-foreground text-xs">age {m.age}</span>
                    {m.relationship ? (
                      <span className="bg-secondary rounded-sm px-1.5 py-0.5 text-xs">
                        {m.relationship}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMember.mutate({ memberId: m.id })}
                    disabled={removeMember.isPending}
                    className="text-destructive hover:bg-destructive/10 rounded-sm px-2 py-1 text-xs font-medium disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setMemberName('');
              setMemberAge('');
              setMemberRelationship('');
              setShowAddMember(true);
            }}
            className="text-terracotta hover:bg-terracotta/10 mt-3 rounded-sm px-2 py-1 text-xs font-medium"
          >
            + Add roster member
          </button>
        </div>
      </Section>

      {/* Add roster member modal */}
      {showAddMember ? (
        <Modal isOpen onClose={() => setShowAddMember(false)} title="Add roster member" size="sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const age = parseInt(memberAge, 10);
              if (memberName.trim() && !isNaN(age)) {
                addMember.mutate({
                  householdId,
                  name: memberName.trim(),
                  age,
                  relationship: memberRelationship.trim() || null,
                });
              }
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="text-foreground text-sm font-medium">Name</span>
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="border-border mt-1 w-full rounded-sm border px-3 py-2 text-sm"
                required
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-foreground text-sm font-medium">Age</span>
              <input
                type="number"
                min={0}
                max={150}
                value={memberAge}
                onChange={(e) => setMemberAge(e.target.value)}
                className="border-border mt-1 w-full rounded-sm border px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block">
              <span className="text-foreground text-sm font-medium">Relationship</span>
              <input
                type="text"
                value={memberRelationship}
                onChange={(e) => setMemberRelationship(e.target.value)}
                className="border-border mt-1 w-full rounded-sm border px-3 py-2 text-sm"
                placeholder="e.g. spouse, child, grandparent"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddMember(false)}
                className="bg-secondary text-foreground/85 rounded-sm px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addMember.isPending}
                className="bg-terracotta rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {addMember.isPending ? 'Adding…' : 'Add member'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Link user modal */}
      {showLinkUser ? (
        <Modal isOpen onClose={() => setShowLinkUser(false)} title="Link user to household" size="sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (linkUserId) {
                linkUser.mutate({ householdId, userId: linkUserId });
              }
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="text-foreground text-sm font-medium">User</span>
              <select
                value={linkUserId}
                onChange={(e) => setLinkUserId(e.target.value)}
                className="border-border mt-1 w-full rounded-sm border px-3 py-2 text-sm"
                required
              >
                <option value="">— Select a user —</option>
                {(unlinkedUsers ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLinkUser(false)}
                className="bg-secondary text-foreground/85 rounded-sm px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={linkUser.isPending || !linkUserId}
                className="bg-terracotta rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {linkUser.isPending ? 'Linking…' : 'Link user'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}