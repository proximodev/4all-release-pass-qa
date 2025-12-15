import { prisma } from './prisma';

/**
 * Update the lastHeartbeat timestamp for a test run
 * This helps detect stuck/crashed workers
 */
export async function updateHeartbeat(testRunId: string): Promise<void> {
  try {
    await prisma.testRun.update({
      where: { id: testRunId },
      data: { lastHeartbeat: new Date() },
    });
  } catch (error) {
    console.error(`Failed to update heartbeat for test run ${testRunId}:`, error);
    // Don't throw - heartbeat failure shouldn't crash the worker
  }
}

/**
 * Create a heartbeat interval that updates every N milliseconds
 * Returns a function to stop the heartbeat
 */
export function startHeartbeat(
  testRunId: string,
  intervalMs: number = 30000
): () => void {
  const interval = setInterval(
    () => updateHeartbeat(testRunId),
    intervalMs
  );

  // Return cleanup function
  return () => clearInterval(interval);
}
