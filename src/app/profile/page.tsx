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
    </main>
  );
}
