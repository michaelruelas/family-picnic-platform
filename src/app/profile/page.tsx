import { prisma } from '~/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { redirect } from 'next/navigation';
import ProfileClient from '~/components/ProfileClient';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      communicationPreference: true,
      createdAt: true,
      household: {
        select: {
          id: true,
          name: true,
        },
      },
      managedDependents: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">My Profile</h1>
      <p className="mt-2 text-stone-600">Manage your account settings</p>

      <div className="mt-8">
        <ProfileClient user={user} />
      </div>

      <div className="mt-8 rounded-xl bg-stone-100 p-6">
        <h2 className="text-lg font-semibold text-stone-800">Account Info</h2>
        <dl className="mt-4 space-y-3">
          <div className="flex justify-between">
            <dt className="text-stone-500">Member since</dt>
            <dd className="text-stone-900">
              {user.createdAt.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Role</dt>
            <dd className="text-stone-900 capitalize">
              {session.user.role?.replace('_', ' ').toLowerCase() || 'Member'}
            </dd>
          </div>
        </dl>
      </div>

      {user.managedDependents.length > 0 && (
        <div className="mt-8 rounded-xl bg-stone-100 p-6">
          <h2 className="text-lg font-semibold text-stone-800">Family Members</h2>
          <ul className="mt-4 space-y-3">
            {user.managedDependents.map((dependent) => (
              <li key={dependent.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-stone-700">{dependent.name}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 capitalize">
                    {dependent.relationship.toLowerCase()}
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
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
