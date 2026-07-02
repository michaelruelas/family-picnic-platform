import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth';
import { prisma } from '~/lib/prisma';
import FamilyTree from '~/components/household/FamilyTree';

export const dynamic = 'force-dynamic';

interface HouseholdNode {
  id: string;
  name: string;
  users: {
    id: string;
    name: string;
    email: string;
  }[];
  dependents: {
    id: string;
    name: string;
    relationship: string;
    age: number | null;
    isChild: boolean;
  }[];
  children: HouseholdNode[];
}

async function getHouseholdTree(): Promise<HouseholdNode[]> {
  const households = await prisma.household.findMany({
    where: { deletedAt: null },
    include: {
      users: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      dependents: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          relationship: true,
          age: true,
          isChild: true,
        },
      },
      children: {
        where: { deletedAt: null },
        include: {
          users: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          dependents: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              relationship: true,
              age: true,
              isChild: true,
            },
          },
          children: {
            where: { deletedAt: null },
            include: {
              users: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              dependents: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  name: true,
                  relationship: true,
                  age: true,
                  isChild: true,
                },
              },
              children: {
                where: { deletedAt: null },
                include: {
                  users: {
                    where: { deletedAt: null },
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                  dependents: {
                    where: { deletedAt: null },
                    select: {
                      id: true,
                      name: true,
                      relationship: true,
                      age: true,
                      isChild: true,
                    },
                  },
                  children: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return households.filter((h) => !h.parentHouseholdId);
}

export default async function HouseholdTreePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  const tree = await getHouseholdTree();

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <Link href="/household" className="text-sm text-amber-600 hover:text-amber-700">
          ← Back to Household
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-900">Family Tree</h1>
        <p className="mt-2 text-stone-600">View the household hierarchy and family relationships</p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Household Network</h2>
          <div className="flex items-center gap-4 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Adults
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-400" /> Children
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-400" /> Other Dependents
            </span>
          </div>
        </div>

        <FamilyTree households={tree} />
      </div>
    </main>
  );
}
