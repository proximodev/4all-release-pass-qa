import { prisma } from '../lib/prisma';
import { TestRun, TestStatus } from '@prisma/client';

/**
 * Atomically claim the next queued test run
 * Uses a transaction to prevent race conditions between multiple workers
 */
export async function claimNextQueuedRun(): Promise<TestRun | null> {
  return prisma.$transaction(async (tx) => {
    // Find the oldest queued test run
    const run = await tx.testRun.findFirst({
      where: { status: TestStatus.QUEUED },
      orderBy: { createdAt: 'asc' },
    });

    if (!run) {
      console.log('[CLAIM] No queued test runs found');
      return null;
    }

    console.log(`[CLAIM] Found queued run: ${run.id} type=${run.type}`);

    // Atomically update to RUNNING status
    return tx.testRun.update({
      where: { id: run.id },
      data: {
        status: TestStatus.RUNNING,
        startedAt: new Date(),
        lastHeartbeat: new Date(),
      },
      include: {
        project: true,
        config: true,
        releaseRun: true,
      },
    });
  });
}

/**
 * Mark a test run as completed (SUCCESS, FAILED, or PARTIAL)
 */
export async function completeTestRun(
  testRunId: string,
  status: TestStatus,
  options?: {
    score?: number;
    error?: string;
  }
): Promise<TestRun> {
  return prisma.testRun.update({
    where: { id: testRunId },
    data: {
      status,
      finishedAt: new Date(),
      score: options?.score,
      error: options?.error,
    },
  });
}

/**
 * Mark a test run as failed with an error message
 */
export async function failTestRun(
  testRunId: string,
  error: string
): Promise<TestRun> {
  return completeTestRun(testRunId, TestStatus.FAILED, { error });
}
