'use client';

import { useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { trpc } from '~/lib/trpc-client';
import { formatDate } from '~/lib/format-date';
import { useToast } from '~/components/ui/Toast';
import Modal from '~/components/ui/Modal';
import type { Role } from '~/lib/generated/enums';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'SUPER_ADMIN' as Role, label: 'Super Admin' },
  { value: 'ADMIN' as Role, label: 'Admin' },
  { value: 'ADULT' as Role, label: 'Adult' },
  { value: 'HOST' as Role, label: 'Host' },
];

interface UserDetailPageProps {
  userId: string;
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

export default function UserDetailPage({ userId }: UserDetailPageProps) {
  const toast = useToast();
  const { data: user, refetch } = trpc.admin.getUserDetail.useQuery({ userId });

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<Role>('ADULT' as Role);
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClearDevPassword, setConfirmClearDevPassword] = useState(false);
  const [editingHousehold, setEditingHousehold] = useState(false);
  const [editHouseholdName, setEditHouseholdName] = useState('');

  const updateUser = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'User updated');
      setEditing(false);
      void refetch();
    },
    onError: (err) => setEditError(err.message),
  });

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'User deleted');
      setConfirmDelete(false);
      void refetch();
    },
    onError: (err) => toast.addToast('error', err.message),
  });

  const unlinkIdentity = trpc.admin.unlinkIdentity.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'Identity unlinked');
      void refetch();
    },
    onError: (err) => toast.addToast('error', err.message),
  });

  const clearDevPassword = trpc.admin.clearDevPassword.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'Dev password cleared');
      setConfirmClearDevPassword(false);
      void refetch();
    },
    onError: (err) => toast.addToast('error', err.message),
  });

  const updateHouseholdName = trpc.admin.updateHouseholdName.useMutation({
    onSuccess: () => {
      toast.addToast('success', 'Household renamed');
      setEditingHousehold(false);
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

  if (!user) {
    return <div className="text-muted-foreground py-12 text-center">Loading…</div>;
  }

  return (
    <div className="max-w-3xl">
      {/* Profile Section */}
      <Section title="Profile">
        <div className="bg-card border-border rounded-sm border p-5">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsed = z
                  .object({
                    name: z.string().trim().min(1),
                    email: z.string().trim().email(),
                    role: z.string(),
                    phoneNumber: z.string().nullable(),
                  })
                  .safeParse({
                    name: editName,
                    email: editEmail,
                    role: editRole,
                    phoneNumber: editPhoneNumber || null,
                  });
                if (!parsed.success) {
                  setEditError(parsed.error.issues[0]?.message ?? 'Invalid input');
                  return;
                }
                updateUser.mutate({
                  userId,
                  name: parsed.data.name,
                  email: parsed.data.email,
                  role: parsed.data.role as Role,
                  phoneNumber: parsed.data.phoneNumber,
                });
              }}
              className="space-y-4"
            >
              {editError ? (
                <p className="text-destructive rounded-sm bg-red-50 px-3 py-2 text-sm">
                  {editError}
                </p>
              ) : null}

              <label className="block">
                <span className="text-foreground text-sm font-medium">Name</span>
                <input
                  type="text"
                  defaultValue={user.name}
                  onChange={(e) => setEditName(e.target.value)}
                  className="border-border mt-1 w-full rounded-sm border px-3 py-2 text-sm"
                  required
                />
              </label>

              <label className="block">
                <span className="text-foreground text-sm font-medium">Email</span>
                <input
                  type="email"
                  defaultValue={user.email}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="border-border mt-1 w-full rounded-sm border px-3 py-2 text-sm"
                  required
                />
              </label>

              <label className="block">
                <span className="text-foreground text-sm font-medium">Phone</span>
                <input
                  type="tel"
                  defaultValue={user.phoneNumber ?? ''}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  className="border-border mt-1 w-full rounded-sm border px-3 py-2 text-sm"
                  placeholder="+15551234567"
                />
              </label>

              <label className="block">
                <span className="text-foreground text-sm font-medium">Role</span>
                <select
                  defaultValue={user.role}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="border-border mt-1 w-full rounded-sm border px-3 py-2 text-sm"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="bg-secondary text-foreground/85 rounded-sm px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateUser.isPending}
                  className="bg-terracotta hover:bg-terracotta/90 rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {updateUser.isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <InfoRow label="Name" value={user.name} />
              <InfoRow label="Email" value={user.email} />
              <InfoRow
                label="Role"
                value={
                  <span className="bg-terracotta/10 text-terracotta rounded-sm px-2 py-0.5 text-xs font-medium">
                    {user.role}
                  </span>
                }
              />
              <InfoRow
                label="Household"
                value={
                  user.household ? (
                    <span>
                      {user.household.name}{' '}
                      <span className="text-muted-foreground text-xs">({user.household.id})</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )
                }
              />
              <InfoRow
                label="Phone"
                value={user.phoneNumber ?? <span className="text-muted-foreground">—</span>}
              />
              <InfoRow label="SMS consent" value={user.smsConsent ? 'Yes' : 'No'} />
              <InfoRow label="Communication pref" value={user.communicationPreference} />
              <InfoRow
                label="Onboarding completed"
                value={
                  user.onboardingCompletedAt ? (
                    formatDate(user.onboardingCompletedAt)
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )
                }
              />
              <InfoRow label="Created" value={formatDate(user.createdAt)} />
              <InfoRow label="Updated" value={formatDate(user.updatedAt)} />
              {user.deletedAt ? (
                <InfoRow
                  label="Deleted"
                  value={<span className="text-destructive">{formatDate(user.deletedAt)}</span>}
                />
              ) : null}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditName(user.name);
                    setEditEmail(user.email);
                    setEditRole(user.role as Role);
                    setEditPhoneNumber(user.phoneNumber ?? '');
                    setEditError(null);
                    setEditing(true);
                  }}
                  className="bg-terracotta hover:bg-terracotta/90 rounded-sm px-4 py-2 text-sm font-medium text-white"
                >
                  Edit profile
                </button>
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Auth & Logins Section */}
      <Section title="Auth &amp; Logins">
        <div className="bg-card border-border rounded-sm border p-5">
          <h3 className="text-foreground mb-3 text-sm font-semibold">Linked OAuth identities</h3>
          {user.linkedIdentities.length === 0 ? (
            <p className="text-muted-foreground text-sm">No linked identities.</p>
          ) : (
            <div className="divide-border divide-y">
              {user.linkedIdentities.map((identity) => (
                <div key={identity.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="bg-secondary rounded-sm px-2 py-0.5 text-xs font-medium uppercase">
                      {identity.provider}
                    </span>
                    <div>
                      <p className="text-foreground font-mono text-sm text-xs">
                        {identity.providerAccountId}
                      </p>
                      {identity.emailSnapshot ? (
                        <p className="text-muted-foreground text-xs">{identity.emailSnapshot}</p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => unlinkIdentity.mutate({ identityId: identity.id })}
                    disabled={unlinkIdentity.isPending}
                    className="text-destructive hover:bg-destructive/10 rounded-sm px-2 py-1 text-xs font-medium disabled:opacity-50"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 border-t pt-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold">Dev auth</h3>
            {user.hasDevPassword ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-amber-600">Dev password is set</span>
                <button
                  type="button"
                  onClick={() => setConfirmClearDevPassword(true)}
                  disabled={clearDevPassword.isPending}
                  className="bg-secondary text-foreground/85 rounded-sm px-3 py-1.5 text-xs font-medium"
                >
                  Clear dev password
                </button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No dev password set.</p>
            )}
          </div>
        </div>
      </Section>

      {/* Household Section */}
      <Section title="Household">
        <div className="bg-card border-border rounded-sm border p-5">
          {user.household ? (
            <>
              <div className="mb-4">
                {editingHousehold ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editHouseholdName.trim()) {
                        updateHouseholdName.mutate({
                          householdId: user.household!.id,
                          name: editHouseholdName.trim(),
                        });
                      }
                    }}
                    className="mb-4 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      defaultValue={user.household.name}
                      onChange={(e) => setEditHouseholdName(e.target.value)}
                      className="border-border w-full rounded-sm border px-3 py-1.5 text-sm"
                      required
                    />
                    <button
                      type="submit"
                      disabled={updateHouseholdName.isPending}
                      className="bg-terracotta rounded-sm px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingHousehold(false)}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <InfoRow label="Household" value={user.household.name} />
                    <button
                      type="button"
                      onClick={() => {
                        setEditHouseholdName(user.household!.name);
                        setEditingHousehold(true);
                      }}
                      className="text-terracotta hover:bg-terracotta/10 rounded-sm px-2 py-1 text-xs font-medium"
                    >
                      Rename
                    </button>
                  </div>
                )}
                {user.household.users.length > 0 ? (
                  <div className="mt-3">
                    <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                      Other members
                    </h4>
                    <div className="space-y-1">
                      {user.household.users.map((member) => (
                        <Link
                          key={member.id}
                          href={`/admin/users/${member.id}`}
                          className="text-terracotta hover:text-terracotta/80 block text-sm"
                        >
                          {member.name} ({member.email})
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {user.household.members.length > 0 ? (
                <div>
                  <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
                    Roster members
                  </h4>
                  <div className="divide-border divide-y text-sm">
                    {user.household.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-foreground">{member.name}</span>
                          <span className="text-muted-foreground text-xs">age {member.age}</span>
                          {member.relationship ? (
                            <span className="text-muted-foreground text-xs">
                              {member.relationship}
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember.mutate({ memberId: member.id })}
                          disabled={removeMember.isPending}
                          className="text-destructive hover:bg-destructive/10 rounded-sm px-2 py-1 text-xs font-medium disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No roster members.</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              This user is not assigned to any household.
            </p>
          )}
        </div>
      </Section>

      {/* Event Admin Section */}
      {user.eventAdmins.length > 0 ? (
        <Section title="Event admin access">
          <div className="bg-card border-border rounded-sm border p-5">
            <div className="space-y-2">
              {user.eventAdmins.map((ea) => (
                <Link
                  key={ea.id}
                  href={`/admin/events/${ea.event.id}/edit`}
                  className="text-terracotta hover:text-terracotta/80 flex items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors hover:bg-orange-50"
                >
                  <span>{ea.event.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(ea.event.date).toLocaleDateString()}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      {/* Danger Zone */}
      <Section title="Danger zone">
        <div className="border-destructive/30 rounded-sm border-2 border-dashed p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground text-sm font-semibold">Delete this user</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Soft-deletes the account. The email becomes available for re-registration. Data is
                preserved.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={Boolean(user.deletedAt)}
              className="bg-destructive rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {user.deletedAt ? 'Deleted' : 'Delete user'}
            </button>
          </div>
        </div>
      </Section>

      {/* Confirm delete modal */}
      {confirmDelete ? (
        <Modal isOpen onClose={() => setConfirmDelete(false)} title="Delete user" size="sm">
          <div className="space-y-4">
            <p className="text-foreground">
              Delete <span className="font-semibold">{user.name}</span> ({user.email})?
            </p>
            <p className="text-muted-foreground text-sm">
              This is a soft delete. The user will not be able to sign in. Their data (RSVPs,
              photos, etc.) is preserved. The email can be used to register a new account.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="bg-secondary text-foreground/85 rounded-sm px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteUser.mutate({ userId })}
                disabled={deleteUser.isPending}
                className="bg-destructive rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {deleteUser.isPending ? 'Deleting…' : 'Delete user'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Confirm clear dev password modal */}
      {confirmClearDevPassword ? (
        <Modal
          isOpen
          onClose={() => setConfirmClearDevPassword(false)}
          title="Clear dev password"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-foreground">
              Clear the dev password for <span className="font-semibold">{user.name}</span>?
            </p>
            <p className="text-muted-foreground text-sm">
              The user will no longer be able to sign in with a dev password. OAuth sign-in is not
              affected.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearDevPassword(false)}
                className="bg-secondary text-foreground/85 rounded-sm px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => clearDevPassword.mutate({ userId })}
                disabled={clearDevPassword.isPending}
                className="bg-destructive rounded-sm px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {clearDevPassword.isPending ? 'Clearing…' : 'Clear password'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
