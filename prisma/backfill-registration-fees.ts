import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/lib/generated/client.js';
import {
  backfillRegistrationFees,
  DEFAULT_BACKFILL_CUTOFF,
  formatRegistrationFeeBackfillResult,
  type RegistrationFeeBackfillResult,
} from '../src/lib/registration-fee-backfill.js';

function parseArgs(argv: string[]): { apply: boolean; cutoff: Date } {
  const apply = argv.includes('--apply');
  const cutoffFlag = argv.find((arg) => arg.startsWith('--cutoff='));
  const cutoff = cutoffFlag
    ? new Date(cutoffFlag.slice('--cutoff='.length))
    : DEFAULT_BACKFILL_CUTOFF;
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error(
      `Invalid --cutoff value: expected ISO date string (e.g. --cutoff=2026-08-06T09:00:00Z)`,
    );
  }
  return { apply, cutoff };
}

async function main(): Promise<void> {
  const { apply, cutoff } = parseArgs(process.argv.slice(2));

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  let result: RegistrationFeeBackfillResult;
  try {
    result = await backfillRegistrationFees(prisma, { apply, cutoff });
  } finally {
    await prisma.$disconnect();
  }

  console.log(formatRegistrationFeeBackfillResult(result));

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Backfill script crashed:', error);
  process.exit(1);
});
