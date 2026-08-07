import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/lib/generated/client.js';
import {
  backfillAuditLog,
  formatAuditLogBackfillResult,
  type AuditLogBackfillResult,
} from '../src/lib/audit-log-backfill.js';

function parseArgs(argv: string[]): { apply: boolean } {
  return { apply: argv.includes('--apply') };
}

async function main(): Promise<void> {
  const { apply } = parseArgs(process.argv.slice(2));

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  let result: AuditLogBackfillResult;
  try {
    result = await backfillAuditLog(prisma, { apply });
  } finally {
    await prisma.$disconnect();
  }

  console.log(formatAuditLogBackfillResult(result));

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Backfill script crashed:', error);
  process.exit(1);
});
