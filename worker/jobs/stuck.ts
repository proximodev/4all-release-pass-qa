import { prisma } from '../lib/prisma';
import { TestStatus } from '@prisma/client';

// Default: 60 minutes without heartbeat = stuck
const DEFAULT_STUCK_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Find and reset stuck test runs
 * A run is considered stuck if it's been RUNNING but hasn't had a heartbeat update
 * within the timeout period (default 60 minutes)
 */
export async function resetStuckRuns(
  timeoutMs: number = DEFAULT_STUCK_TIMEOUT_MS
): Promise<number> {
  const cutoffTime = new Date(Date.now() - timeoutMs);

  const result = await prisma.testRun.updateMany({
    where: {
      status: TestStatus.RUNNING,
      lastHeartbeat: {
        lt: cutoffTime,
      },
    },
    data: {
      status: TestStatus.FAILED,
      error: `Worker timeout: No heartbeat for ${timeoutMs / 1000 / 60} minutes`,
      finishedAt: new Date(),
    },
  });

  if (result.count > 0) {
    console.log(`Reset ${result.count} stuck test run(s)`);
  }

  return result.count;
}

/**
 * Get the count of currently running test runs
 * Useful for monitoring and debugging
 */
export async function getRunningCount(): Promise<number> {
  return prisma.testRun.count({
    where: { status: TestStatus.RUNNING },
  });
}

/**
 * Get the count of queued test runs
 */
export async function getQueuedCount(): Promise<number> {
  return prisma.testRun.count({
    where: { status: TestStatus.QUEUED },
  });
}
