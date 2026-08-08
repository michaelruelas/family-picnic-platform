#!/usr/bin/env bun
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/lib/generated/client';
import { CommunicationStatus } from '../src/lib/generated/enums';

interface RetryOptions {
  apply: boolean;
  maxRetries?: number;
}

export function parseArgs(argv: string[]): RetryOptions {
  const apply = argv.includes('--apply');
  const maxIndex = argv.indexOf('--max');
  if (maxIndex >= 0) {
    const raw = argv[maxIndex + 1];
    const parsed = Number(raw);
    if (raw === undefined || !Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      throw new Error(`--max must be a non-negative integer (got: ${raw ?? 'undefined'})`);
    }
    return { apply, maxRetries: parsed };
  }
  return { apply };
}

async function retryFailedComms(): Promise<void> {
  const { apply, maxRetries } = parseArgs(process.argv.slice(2));

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const candidates = await prisma.communicationLog.findMany({
      where: {
        status: CommunicationStatus.FAILED,
        ...(maxRetries !== undefined ? { retryCount: { lt: maxRetries } } : {}),
      },
      select: { id: true, retryCount: true, errorCode: true, errorMessage: true },
    });

    if (candidates.length === 0) {
      console.log('No FAILED rows to retry.');
      return;
    }

    console.log(
      `Found ${candidates.length} FAILED row(s) eligible for retry${
        maxRetries !== undefined ? ` (retryCount < ${maxRetries})` : ''
      }:`,
    );
    for (const row of candidates) {
      console.log(
        `  - id=${row.id} retryCount=${row.retryCount} errorCode=${row.errorCode ?? 'null'} errorMessage=${row.errorMessage ?? 'null'}`,
      );
    }

    if (!apply) {
      console.log('\nDry-run. Pass --apply to re-queue these rows.');
      return;
    }

    const result = await prisma.communicationLog.updateMany({
      where: { id: { in: candidates.map((row) => row.id) } },
      data: {
        status: CommunicationStatus.QUEUED,
        retryCount: { increment: 1 },
        errorCode: null,
        errorMessage: null,
      },
    });

    console.log(`\nRe-queued ${result.count} row(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

retryFailedComms().catch((error) => {
  console.error('Retry script crashed:', error);
  process.exit(1);
});
