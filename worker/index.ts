import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from './lib/prisma';
import { sleep } from './lib/sleep';
import { claimNextQueuedRun } from './jobs/claim';
import { processTestRun } from './jobs/process';
import { resetStuckRuns, getQueuedCount, getRunningCount } from './jobs/stuck';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Polling intervals (exponential backoff)
  POLL_INTERVAL_MIN: parseInt(process.env.POLL_INTERVAL_MIN || '10000', 10),  // 10 seconds
  POLL_INTERVAL_MAX: parseInt(process.env.POLL_INTERVAL_MAX || '60000', 10),  // 60 seconds
  BACKOFF_MULTIPLIER: 1.5,

  // Heartbeat & stuck run detection
  HEARTBEAT_INTERVAL: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10), // 30 seconds
  STUCK_RUN_TIMEOUT: parseInt(process.env.STUCK_RUN_TIMEOUT || '3600000', 10), // 60 minutes

  // Stuck run check interval
  STUCK_CHECK_INTERVAL: 5 * 60 * 1000, // Check every 5 minutes
};

// ============================================================================
// Worker State
// ============================================================================

let pollInterval = CONFIG.POLL_INTERVAL_MIN;
let isShuttingDown = false;
let lastStuckCheck = 0;

// ============================================================================
// Main Worker Loop
// ============================================================================

async function workerLoop(): Promise<void> {
  console.log('Worker loop started');
  console.log(`Poll interval: ${CONFIG.POLL_INTERVAL_MIN}ms - ${CONFIG.POLL_INTERVAL_MAX}ms`);

  while (!isShuttingDown) {
    try {
      // Periodically check for stuck runs
      await checkStuckRuns();

      // Try to claim and process a job
      const job = await claimNextQueuedRun();

      if (job) {
        console.log(`Claimed job: ${job.id} (${job.type})`);
        pollInterval = CONFIG.POLL_INTERVAL_MIN; // Reset on success

        try {
          await processTestRun(job as any); // Cast to include relations
        } catch (error) {
          // Error already logged and handled in processTestRun
        }

      } else {
        // No jobs available, back off exponentially
        pollInterval = Math.min(
          pollInterval * CONFIG.BACKOFF_MULTIPLIER,
          CONFIG.POLL_INTERVAL_MAX
        );
      }

    } catch (error) {
      console.error('Worker loop error:', error);
      // On error, use max interval to avoid hammering
      pollInterval = CONFIG.POLL_INTERVAL_MAX;
    }

    // Wait before next poll
    if (!isShuttingDown) {
      await sleep(pollInterval);
    }
  }

  console.log('Worker loop stopped');
}

async function checkStuckRuns(): Promise<void> {
  const now = Date.now();
  if (now - lastStuckCheck < CONFIG.STUCK_CHECK_INTERVAL) {
    return;
  }

  lastStuckCheck = now;
  await resetStuckRuns(CONFIG.STUCK_RUN_TIMEOUT);
}

// ============================================================================
// Startup & Shutdown
// ============================================================================

async function startup(): Promise<void> {
  console.log('========================================');
  console.log('ReleasePass Worker Starting');
  console.log('========================================');

  // Environment check
  console.log('Environment:');
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'MISSING'}`);
  console.log(`  SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Set' : 'MISSING'}`);
  console.log(`  PAGE_SPEED_API_KEY: ${process.env.PAGE_SPEED_API_KEY ? 'Set' : 'MISSING'}`);

  // Test database connection
  try {
    const queued = await getQueuedCount();
    const running = await getRunningCount();
    console.log(`Database connected. Queued: ${queued}, Running: ${running}`);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  // Reset any stuck runs from previous session
  await resetStuckRuns(CONFIG.STUCK_RUN_TIMEOUT);

  console.log('========================================');
  console.log('Worker ready, entering main loop');
  console.log('========================================');
}

async function shutdown(): Promise<void> {
  console.log('Shutdown signal received, stopping worker...');
  isShuttingDown = true;

  // Give time for current job to complete
  await sleep(2000);

  // Disconnect from database
  await prisma.$disconnect();
  console.log('Worker stopped');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ============================================================================
// Entry Point
// ============================================================================

startup()
  .then(() => workerLoop())
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
